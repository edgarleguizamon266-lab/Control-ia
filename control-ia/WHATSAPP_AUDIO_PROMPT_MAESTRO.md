# PROMPT MAESTRO — CONTROL IA por WhatsApp (texto + audio)

## 1. Objetivo

El usuario le manda un audio a su propio número de WhatsApp conectado
(o escribe un mensaje de texto), diciendo algo como:

> "Gasté 85 mil en supermercado"

Y CONTROL IA:
1. Transcribe el audio a texto (si es audio).
2. Interpreta la intención con el mismo motor de IA que ya usa la app web.
3. Ejecuta la acción real contra la base de datos (nunca inventa datos).
4. Responde por WhatsApp confirmando lo que hizo.

**Principio no negociable (ya aplicado en toda la app):** el motor que
interpreta el mensaje debe ser EXACTAMENTE el mismo estén hablando por
WhatsApp, por audio, o escribiendo en el chat de la app web. Un solo
cerebro, tres canales de entrada.

## 2. Arquitectura

```text
WhatsApp (usuario)
   │  (texto o nota de voz)
   ▼
Meta Cloud API ──── webhook POST ───▶ /api/whatsapp/webhook
                                            │
                          ┌─────────────────┴─────────────────┐
                          │                                   │
                    mensaje es audio?                  mensaje es texto
                          │ sí                                │
                          ▼                                   │
              1. Descargar el audio de Meta                   │
                 (Graph API, con el token                     │
                 de la conexión del workspace)                │
                          │                                   │
                          ▼                                   │
              2. Transcribir a texto                          │
                 (proveedor de Speech-to-Text)                │
                          │                                   │
                          └─────────────────┬─────────────────┘
                                            ▼
                          3. Motor de IA central
                             (src/lib/ia/motor.ts)
                             — el MISMO que usa /api/ia
                             — mismas 13 herramientas
                             — mismo Motor Financiero Central
                                            │
                                            ▼
                          4. Ejecuta la acción real en Supabase
                             (create_transaction, get_report, etc.)
                                            │
                                            ▼
                          5. Responder por WhatsApp
                             (provider.sendMessage)
```

## 3. Tablas involucradas (ya existen, migraciones 002/005)

- `whatsapp_connections` — qué número de WhatsApp pertenece a qué `workspace_id`.
- `whatsapp_events` — idempotencia (un mismo mensaje de Meta nunca se procesa dos veces).
- `ai_usage` — costo de cada interacción, con `origen = 'whatsapp'` o `'audio'`.
- Todas las tablas financieras de siempre (`transactions`, `accounts`, etc.) — sin cambios.

## 4. Requisitos previos para activar esto de verdad

### 4.1. Credenciales de Meta (WhatsApp Business Platform)
Nadie puede saltarse este paso — es una verificación real de Meta, no algo que se resuelva con código:

1. Crear una cuenta en **business.facebook.com** (Meta Business Suite).
2. Crear una app en **developers.facebook.com** con el producto "WhatsApp".
3. Completar el **Embedded Signup** (esto vincula el número de WhatsApp real del usuario).
4. Obtener: `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_CONFIG_ID`.
5. Configurar el webhook (`https://tu-dominio.vercel.app/api/whatsapp/webhook`) con un `WHATSAPP_WEBHOOK_VERIFY_TOKEN` elegido por vos.

### 4.2. Credenciales de transcripción de audio
Anthropic Claude (el motor de IA que ya usás) **no transcribe audio directamente** vía API — necesita un servicio de Speech-to-Text aparte. La opción más simple y barata es **OpenAI Whisper API**:

1. Crear cuenta en **platform.openai.com**.
2. Generar una API key.
3. Cargarla como `OPENAI_API_KEY`.

(La arquitectura queda armada con una interfaz intercambiable — el día de mañana se puede cambiar a otro proveedor sin tocar el resto del código.)

## 5. Reglas de seguridad (igual que en la app web y el chat de la IA)

- El motor NUNCA inventa un monto, saldo o porcentaje — todo sale de una consulta real (Motor Financiero Central).
- Las acciones sensibles (`update_transaction`, `delete_transaction`) requieren que el usuario haya confirmado explícitamente en un mensaje anterior — igual que en el chat de la app.
- Cada número de WhatsApp está atado a UN SOLO `workspace_id`. Un mensaje que llega de un número no vinculado a ningún workspace se descarta (nunca se ejecuta "a ciegas").
- Idempotencia real: si Meta reintenta la entrega de un mensaje (algo común en su infraestructura), `whatsapp_events` evita procesarlo dos veces.

## 6. Casos borde que el motor debe manejar

| Caso | Comportamiento esperado |
|---|---|
| Audio inentendible / silencio | Responder pidiendo que lo repita, sin inventar un movimiento |
| Número no vinculado a ningún workspace | No responder nada (o loguear para revisión), nunca crear datos |
| Usuario menciona un monto sin categoría | El motor pregunta la categoría antes de registrar (igual que en el chat web) |
| Mensaje ambiguo para editar/eliminar | Pedir confirmación explícita antes de ejecutar (nivel 3 de acciones) |
| Falla la transcripción (proveedor caído) | Responder avisando el problema, nunca "inventar" qué dijo el audio |
| Usuario sin suscripción activa | Responder indicando que renueve, sin ejecutar la acción |

## 7. Plan de implementación (lo que se hace HOY vs. lo que activa Meta)

**Implementado hoy (código lista, sin credenciales todavía):**
- ✅ Motor de IA extraído a un módulo compartido (`src/lib/ia/motor.ts`)
- ✅ Interfaz de transcripción de audio (`src/lib/transcription/provider.ts`)
- ✅ Webhook de WhatsApp completo: recibe texto Y audio, transcribe, llama al motor, responde
- ✅ Resolución multi-tenant por número de teléfono
- ✅ Tracking de costo (`ai_usage`) por mensaje de WhatsApp

**Falta para que funcione de punta a punta (depende de vos, no de mí):**
- ⏳ Completar las 4 variables `WHATSAPP_*` (Embedded Signup con Meta)
- ⏳ Completar `OPENAI_API_KEY` (o el proveedor de transcripción que seas eligas)
- ⏳ Implementar los métodos reales de la Graph API en `MetaDirectProvider` (marcados con `TODO` explícitos — son ~5 funciones, cada una es una llamada HTTP a un endpoint documentado de Meta)

## 8. Checklist de activación (cuando tengas las credenciales)

1. [ ] Cargar `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` en Vercel
2. [ ] Cargar `OPENAI_API_KEY` en Vercel
3. [ ] Implementar los 6 métodos de `MetaDirectProvider` en `src/lib/whatsapp/provider.ts` (siguiendo la documentación oficial de cada endpoint, ya referenciada en los comentarios del código)
4. [ ] Configurar la URL del webhook en el panel de Meta for Developers
5. [ ] Probar con `Configuración > WhatsApp` en la app → "Conectar mi WhatsApp"
6. [ ] Enviar un mensaje de texto de prueba → confirmar que responde
7. [ ] Enviar una nota de voz de prueba → confirmar que transcribe y registra
