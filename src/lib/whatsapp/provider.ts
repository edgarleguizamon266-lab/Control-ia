// =========================================================
// CONTROL IA — Abstracción de proveedor de WhatsApp (sección 43)
//
// Esta interfaz permite usar Meta directo como Tech Provider, un BSP
// oficial, u otro proveedor compatible en el futuro, sin acoplar el
// resto de la aplicación a uno en particular.
//
// IMPORTANTE (sección 83 — "No fingir integraciones"): mientras no
// existan credenciales reales de Meta (App ID, App Secret, Config ID
// de Embedded Signup, verify token del webhook), estas funciones
// deben fallar de forma clara y explícita. Nunca deben devolver un
// estado "connected" simulado.
// =========================================================

export type EstadoConexionWhatsapp =
  | "not_connected"
  | "connecting"
  | "connected"
  | "requires_attention"
  | "disconnected";

export interface ConexionWhatsapp {
  workspaceId: string;
  wabaId?: string;
  phoneNumberId?: string;
  normalizedPhone?: string;
  displayName?: string;
  status: EstadoConexionWhatsapp;
  lastError?: string;
}

export interface WhatsappProvider {
  /** Inicia el flujo oficial de Embedded Signup y devuelve la URL/config para abrirlo. */
  startEmbeddedSignup(workspaceId: string): Promise<{ signupUrl: string } | never>;
  /** Recibe el resultado del Embedded Signup (código de autorización de Meta) y lo intercambia por tokens server-side. */
  completeEmbeddedSignup(workspaceId: string, authCode: string): Promise<ConexionWhatsapp>;
  /** Registra el número de teléfono en la WABA correspondiente. */
  registerPhone(workspaceId: string): Promise<void>;
  /** Suscribe el webhook de la app al WABA del cliente. */
  subscribeWebhook(wabaId: string): Promise<void>;
  /** Envía un mensaje de texto libre (dentro de la ventana de 24hs). */
  sendMessage(phoneNumberId: string, to: string, texto: string): Promise<void>;
  /** Envía un mensaje de plantilla (fuera de la ventana de 24hs). */
  sendTemplate(phoneNumberId: string, to: string, plantilla: string, params: string[]): Promise<void>;
  /** Descarga un archivo multimedia (ej. nota de voz) entregado por Meta a partir de su media id. */
  downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }>;
  /** Desconecta el número (revoca el webhook/suscripción). */
  disconnectNumber(workspaceId: string): Promise<void>;
  /** Consulta el estado real de la conexión contra el proveedor (nunca solo lo que dice la base local). */
  getConnectionStatus(workspaceId: string): Promise<ConexionWhatsapp>;
}

class CredencialesFaltantesError extends Error {
  constructor(faltantes: string[]) {
    super(
      `WhatsApp no está configurado todavía. Faltan las siguientes variables de entorno: ${faltantes.join(
        ", "
      )}. Consultá el README (sección "WhatsApp") para completarlas antes de habilitar esta función.`
    );
    this.name = "CredencialesFaltantesError";
  }
}

function variablesFaltantes(): string[] {
  const requeridas = ["WHATSAPP_APP_ID", "WHATSAPP_APP_SECRET", "WHATSAPP_CONFIG_ID", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
  return requeridas.filter((v) => !process.env[v]);
}

export function credencialesWhatsappCompletas(): boolean {
  return variablesFaltantes().length === 0;
}

/**
 * Implementación real contra Meta directo (Tech Provider), usando
 * WhatsApp Business Platform Embedded Signup.
 *
 * Todavía NO tiene credenciales cargadas en este proyecto — cada
 * método revisa `variablesFaltantes()` y falla explícitamente en vez
 * de simular una conexión. Cuando se completen las variables de
 * entorno, implementar cada método contra la Graph API de Meta:
 * https://developers.facebook.com/docs/whatsapp/embedded-signup
 */
export class MetaDirectProvider implements WhatsappProvider {
  private verificarCredenciales() {
    const faltantes = variablesFaltantes();
    if (faltantes.length > 0) throw new CredencialesFaltantesError(faltantes);
  }

  async startEmbeddedSignup(_workspaceId: string): Promise<{ signupUrl: string }> {
    this.verificarCredenciales();
    // TODO (cuando haya credenciales): construir la URL del Facebook Login for Business
    // con el WHATSAPP_CONFIG_ID y el App ID, siguiendo el flujo de Embedded Signup.
    throw new Error("startEmbeddedSignup: implementar contra la Graph API una vez configuradas las credenciales.");
  }

  async completeEmbeddedSignup(_workspaceId: string, _authCode: string): Promise<ConexionWhatsapp> {
    this.verificarCredenciales();
    throw new Error("completeEmbeddedSignup: implementar intercambio de código por token de acceso server-side.");
  }

  async registerPhone(_workspaceId: string): Promise<void> {
    this.verificarCredenciales();
    throw new Error("registerPhone: implementar llamada a /phone_numbers de la Graph API.");
  }

  async subscribeWebhook(_wabaId: string): Promise<void> {
    this.verificarCredenciales();
    throw new Error("subscribeWebhook: implementar suscripción de la app al WABA.");
  }

  async sendMessage(_phoneNumberId: string, _to: string, _texto: string): Promise<void> {
    this.verificarCredenciales();
    throw new Error("sendMessage: implementar envío vía Graph API /messages.");
  }

  async downloadMedia(_mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    this.verificarCredenciales();
    // TODO (cuando haya credenciales): 1) GET https://graph.facebook.com/v21.0/{media-id}
    // con el access token de la conexión para obtener la URL temporal del archivo;
    // 2) GET a esa URL (también con el access token) para bajar los bytes.
    // Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
    throw new Error("downloadMedia: implementar descarga de medios vía Graph API.");
  }

  async sendTemplate(_phoneNumberId: string, _to: string, _plantilla: string, _params: string[]): Promise<void> {
    this.verificarCredenciales();
    throw new Error("sendTemplate: implementar envío de plantilla vía Graph API /messages.");
  }

  async disconnectNumber(_workspaceId: string): Promise<void> {
    this.verificarCredenciales();
    throw new Error("disconnectNumber: implementar revocación de suscripción/token.");
  }

  async getConnectionStatus(_workspaceId: string): Promise<ConexionWhatsapp> {
    // Esta consulta SÍ puede responder sin credenciales: siempre refleja la
    // verdad (no conectado) en vez de fallar, porque la UI necesita poder
    // mostrar el estado real incluso sin Meta configurado.
    return { workspaceId: _workspaceId, status: "not_connected" };
  }
}

export function getWhatsappProvider(): WhatsappProvider {
  return new MetaDirectProvider();
}
