// =========================================================
// CONTROL IA — Abstracción de transcripción de audio (Speech-to-Text)
//
// Anthropic Claude no transcribe audio directamente vía API — hace
// falta un proveedor de Speech-to-Text aparte. Esta interfaz permite
// cambiar de proveedor sin tocar el resto del código (igual patrón
// que src/lib/whatsapp/provider.ts).
//
// Implementación por defecto: OpenAI Whisper API (barata y simple).
// Requiere OPENAI_API_KEY. Sin esa variable, falla explícitamente —
// nunca "inventa" una transcripción falsa.
// =========================================================

export interface TranscriptionProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<string>;
}

class CredencialFaltanteError extends Error {
  constructor() {
    super(
      "La transcripción de audio todavía no está configurada: falta OPENAI_API_KEY en el servidor. Ver WHATSAPP_AUDIO_PROMPT_MAESTRO.md, sección 4.2."
    );
    this.name = "CredencialFaltanteError";
  }
}

export function transcripcionDisponible(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

class OpenAIWhisperProvider implements TranscriptionProvider {
  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) throw new CredencialFaltanteError();

    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "m4a";

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `nota-de-voz.${extension}`);
    form.append("model", "whisper-1");
    form.append("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`No se pudo transcribir el audio (${res.status}): ${detalle.slice(0, 200)}`);
    }

    const data = await res.json();
    return (data.text ?? "").trim();
  }
}

export function getTranscriptionProvider(): TranscriptionProvider {
  return new OpenAIWhisperProvider();
}
