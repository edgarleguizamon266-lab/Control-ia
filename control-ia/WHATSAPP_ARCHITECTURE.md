# WHATSAPP_ARCHITECTURE — CONTROL IA

## Estado real, sin fingir nada

**La integración NO está activa.** Esto es intencional y documentado
desde el principio (ver `WHATSAPP_AUDIO_PROMPT_MAESTRO.md` en la raíz del
proyecto). La arquitectura está completa; lo que falta son credenciales
reales de Meta, que solo el dueño del proyecto puede obtener (proceso de
verificación de negocio, no código).

## Qué es código real (no solo UI decorativa)

| Pieza | Archivo | Estado |
|---|---|---|
| Abstracción de proveedor | `src/lib/whatsapp/provider.ts` | Interfaz completa (`startEmbeddedSignup`, `registerPhone`, `subscribeWebhook`, `sendMessage`, `sendTemplate`, `downloadMedia`, `disconnectNumber`, `getConnectionStatus`). Implementación `MetaDirectProvider`: cada método real está marcado con `TODO` explícito y falla con `CredencialesFaltantesError` si faltan las 4 variables `WHATSAPP_*`. `getConnectionStatus` es la única excepción — responde honestamente `not_connected` sin fallar. |
| Inicio de conexión | `src/app/api/whatsapp/signup/route.ts` | Si faltan credenciales, responde `501` con mensaje claro. Nunca devuelve una URL de conexión falsa. |
| Webhook | `src/app/api/whatsapp/webhook/route.ts` | `GET` implementa la verificación oficial de Meta (`hub.challenge`). `POST` recibe eventos, con **idempotencia real** (`whatsapp_events.id` = id del mensaje de Meta, PK duplicada = evento ignorado) y enrutamiento multi-tenant por `phone_number_id` → `workspace_id`. Distingue texto vs. audio; para audio, descarga + transcribe + llama al mismo motor de IA que el chat web. |
| Pantalla del cliente | `src/app/dashboard/configuracion/whatsapp/page.tsx` | Muestra siempre el estado real desde `whatsapp_connections` (`not_connected` por defecto). El botón "Conectar mi WhatsApp" existe y llama a `/api/whatsapp/signup`; si responde 501, muestra el mensaje de credenciales faltantes en un recuadro ámbar — nunca simula éxito. |
| Tablas | `whatsapp_connections` (una por workspace, `unique(workspace_id)`), `whatsapp_events` (idempotencia) | Completas, con RLS y trigger de ownership. |

## Multiusuario / enrutamiento

Cada número de WhatsApp está atado a **un solo `workspace_id`** vía
`whatsapp_connections.phone_number_id`. El webhook resuelve el
`workspace_id` y `user_id` a partir de `phone_number_id` antes de llamar
al motor de IA — un mensaje de un número no vinculado a ningún workspace
se descarta sin ejecutar nada.

## Qué falta para activarlo (credenciales, no código)

1. Cuenta en Meta Business Suite + app en Meta for Developers con el producto WhatsApp Business Platform.
2. Completar el flujo de Embedded Signup (Facebook Login for Business) para obtener `WHATSAPP_CONFIG_ID`.
3. Variables de entorno: `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Implementar los ~6 métodos de `MetaDirectProvider` contra la Graph API real (cada uno documentado con el endpoint exacto en un comentario `TODO`).
5. Conectar el webhook al envío real de respuestas (`provider.sendMessage`) — el enrutamiento y la llamada al motor de IA ya están, falta solo el envío de vuelta una vez que `sendMessage` esté implementado contra la Graph API real.
6. `OPENAI_API_KEY` para que la transcripción de audio funcione (ver `AI_ARCHITECTURE.md`).

## Checklist de activación (copiado de WHATSAPP_AUDIO_PROMPT_MAESTRO.md)

1. [ ] Cargar las 4 variables `WHATSAPP_*` en Vercel
2. [ ] Cargar `OPENAI_API_KEY` en Vercel
3. [ ] Implementar los métodos reales de `MetaDirectProvider`
4. [ ] Configurar la URL del webhook en el panel de Meta for Developers
5. [ ] Probar conexión desde `Configuración > WhatsApp`
6. [ ] Probar mensaje de texto
7. [ ] Probar nota de voz
