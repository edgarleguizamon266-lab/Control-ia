import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { procesarMensajeIA, ErrorMotorIA } from "@/lib/ia/motor";

// Wrapper delgado: la lógica real vive en src/lib/ia/motor.ts, compartida
// con el webhook de WhatsApp (mismo cerebro, distintos canales de entrada).
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { mensaje, historial, workspace_id, workspace_tipo } = await req.json();
  if (!workspace_id) {
    return NextResponse.json({ error: "Elegí un espacio (Personal o Negocio) antes de hablar con la IA." }, { status: 400 });
  }

  try {
    const resultado = await procesarMensajeIA({
      supabase,
      userId: user.id,
      workspaceId: workspace_id,
      workspaceTipo: workspace_tipo,
      mensaje,
      historial,
      origen: "app",
    });
    return NextResponse.json(resultado);
  } catch (e: any) {
    // Nunca exponer el error técnico crudo del proveedor al cliente (hallazgo de auditoría).
    if (e instanceof ErrorMotorIA) {
      return NextResponse.json({ error: e.amigable, tipoError: "ia_no_disponible" }, { status: 503 });
    }
    console.error("[api/ia] Error inesperado:", e);
    return NextResponse.json({ error: "No pude procesar tu mensaje ahora. Probá de nuevo en un momento." }, { status: 500 });
  }
}

