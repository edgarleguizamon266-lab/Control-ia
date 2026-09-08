import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { procesarMensajeIA, ErrorMotorIA } from "@/lib/ia/motor";
import { getWhatsappProvider, credencialesWhatsappCompletas } from "@/lib/whatsapp/provider";
import { getTranscriptionProvider, transcripcionDisponible } from "@/lib/transcription/provider";

// =========================================================
// Webhook de WhatsApp (secciones 45-46, WHATSAPP_AUDIO_PROMPT_MAESTRO.md)
//
// GET  → verificación oficial del webhook ante Meta (hub.challenge).
// POST → recepción de eventos entrantes:
//   texto  → motor de IA directo
//   audio  → descargar de Meta → transcribir → motor de IA
//   ambos  → responder por WhatsApp con el resultado real
//
// Usa el service role de Supabase porque estas llamadas llegan de
// Meta, no de una sesión de usuario autenticada en la app.
// =========================================================

function clienteServicio() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: "WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurado en el servidor todavía." }, { status: 501 });
  }
  if (modo === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verificación de webhook fallida." }, { status: 403 });
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: "WhatsApp todavía no está configurado en este servidor." }, { status: 501 });
  }

  const supabase = clienteServicio();
  const payload = await req.json();
  const entradas = payload.entry ?? [];

  for (const entrada of entradas) {
    for (const cambio of entrada.changes ?? []) {
      const phoneNumberId = cambio.value?.metadata?.phone_number_id;
      const mensajes = cambio.value?.messages ?? [];
      if (!phoneNumberId || mensajes.length === 0) continue;

      const { data: conexion } = await supabase
        .from("whatsapp_connections")
        .select("id, workspace_id, user_id, phone_number_id, workspaces(tipo)")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      // Número no vinculado a ningún workspace conocido: nunca se procesa "a ciegas".
      if (!conexion) continue;

      for (const mensaje of mensajes) {
        const eventoId = mensaje.id as string;
        if (!eventoId) continue;

        // Idempotencia: si Meta reintenta la entrega, el insert falla por PK duplicada y se ignora.
        const { error: errorInsert } = await supabase.from("whatsapp_events").insert({ id: eventoId, connection_id: conexion.id, payload: mensaje });
        if (errorInsert) continue;

        await supabase.from("whatsapp_connections").update({ last_webhook_at: new Date().toISOString() }).eq("id", conexion.id);

        const remitente = mensaje.from as string;
        let textoUsuario: string | null = null;
        let origen: "whatsapp" | "audio" = "whatsapp";

        if (mensaje.type === "text") {
          textoUsuario = mensaje.text?.body ?? null;
        } else if (mensaje.type === "audio") {
          origen = "audio";
          if (!transcripcionDisponible()) {
            await responderSiPosible(phoneNumberId, remitente, "Todavía no tengo activada la transcripción de audio. Escribime el gasto por texto mientras tanto.");
            continue;
          }
          try {
            const provider = getWhatsappProvider();
            const { buffer, mimeType } = await provider.downloadMedia(mensaje.audio.id);
            const transcripcion = await getTranscriptionProvider().transcribe(buffer, mimeType);
            if (!transcripcion) {
              await responderSiPosible(phoneNumberId, remitente, "No pude entender el audio. ¿Podés repetirlo o escribirlo?");
              continue;
            }
            textoUsuario = transcripcion;
          } catch (e: any) {
            await responderSiPosible(phoneNumberId, remitente, "Tuve un problema técnico para procesar el audio. Probá escribiéndolo, por favor.");
            continue;
          }
        } else {
          // Tipo de mensaje no soportado todavía (imagen, ubicación, etc.) — se ignora sin romper nada.
          continue;
        }

        if (!textoUsuario) continue;

        const workspaceTipo = (conexion as any).workspaces?.tipo ?? "personal";

        try {
          const resultado = await procesarMensajeIA({
            supabase,
            userId: conexion.user_id,
            workspaceId: conexion.workspace_id,
            workspaceTipo,
            mensaje: textoUsuario,
            origen,
          });

          let textoRespuesta = resultado.respuesta || "Listo.";
          if (resultado.accion?.tipo === "transaccion_creada") {
            const a = resultado.accion as any;
            textoRespuesta = `✅ Registré tu ${a.tipoMovimiento}.\n${a.categoria} · ${a.cuenta}\n\n${resultado.respuesta ?? ""}`;
          }

          await responderSiPosible(phoneNumberId, remitente, textoRespuesta);
        } catch (e: any) {
          const mensaje = e instanceof ErrorMotorIA ? e.amigable : "Tuve un problema técnico procesando tu mensaje. Probá de nuevo en un momento.";
          if (!(e instanceof ErrorMotorIA)) console.error("[whatsapp-webhook] Error inesperado:", e);
          await responderSiPosible(phoneNumberId, remitente, mensaje);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function responderSiPosible(phoneNumberId: string, para: string, texto: string) {
  if (!credencialesWhatsappCompletas()) return; // sin credenciales de Meta, no hay forma real de responder
  try {
    await getWhatsappProvider().sendMessage(phoneNumberId, para, texto);
  } catch {
    // Falla de envío no debe tumbar el webhook — Meta ya recibió el 200 OK de este POST.
  }
}
