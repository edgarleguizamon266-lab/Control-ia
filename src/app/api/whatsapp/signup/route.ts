import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsappProvider, credencialesWhatsappCompletas } from "@/lib/whatsapp/provider";

// Inicia el flujo oficial de Embedded Signup (sección 41).
// Si faltan credenciales de Meta, responde 501 con un mensaje claro —
// nunca simula un signupUrl falso ni marca la conexión como iniciada.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { workspace_id } = await req.json();
  if (!workspace_id) return NextResponse.json({ error: "Falta workspace_id" }, { status: 400 });

  if (!credencialesWhatsappCompletas()) {
    return NextResponse.json(
      {
        error:
          "La conexión con WhatsApp todavía no está disponible: faltan credenciales de Meta (App ID, App Secret, Config ID de Embedded Signup y verify token del webhook) por configurar en el servidor.",
        estado: "not_connected",
      },
      { status: 501 }
    );
  }

  try {
    const provider = getWhatsappProvider();
    const { signupUrl } = await provider.startEmbeddedSignup(workspace_id);
    return NextResponse.json({ signupUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "No se pudo iniciar la conexión." }, { status: 500 });
  }
}
