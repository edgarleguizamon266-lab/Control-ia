import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// =========================================================
// OCR de comprobantes (sección 38-39)
//
// Analiza una foto/imagen de ticket o comprobante y devuelve una
// EXTRACCIÓN sugerida (no confirmada). El monto NUNCA se registra
// automáticamente: el frontend siempre muestra una vista previa
// editable y el usuario debe confirmar antes de guardar.
// =========================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 500 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { imagen_base64, media_type } = await req.json();
  if (!imagen_base64) return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });

  // Posible duplicado por hash simple del contenido base64 (sección 39).
  const hash = await crypto.subtle.digest("SHA-256", Buffer.from(imagen_base64, "base64")).then((buf) =>
    Buffer.from(buf).toString("hex")
  );
  const { data: previo } = await supabase
    .from("transactions")
    .select("id, fecha")
    .eq("comprobante_hash", hash)
    .maybeSingle();

  const respuesta = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system:
      "Analizás fotos de tickets/comprobantes de pago para CONTROL IA. Respondé ÚNICAMENTE JSON válido, sin texto adicional, con este formato exacto: " +
      '{"comercio": string|null, "monto": number|null, "fecha": "YYYY-MM-DD"|null, "categoria_sugerida": string|null, "numero_operacion": string|null, "confianza": "alta"|"media"|"baja"}. ' +
      "Si no podés leer un campo con claridad, usá null en ese campo. No inventes datos que no se ven en la imagen.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: imagen_base64 } },
          { type: "text", text: "Extraé los datos de este comprobante." },
        ],
      },
    ],
  });

  const texto = respuesta.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

  let extraido;
  try {
    extraido = JSON.parse(texto.replace(/```json|```/g, "").trim());
  } catch {
    extraido = { comercio: null, monto: null, fecha: null, categoria_sugerida: null, numero_operacion: null, confianza: "baja" };
  }

  return NextResponse.json({
    extraido,
    posible_duplicado: Boolean(previo),
    comprobante_hash: hash,
  });
}
