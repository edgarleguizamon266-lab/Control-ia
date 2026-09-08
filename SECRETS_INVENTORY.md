# SECRETS_INVENTORY — CONTROL IA

Ningún valor real de ninguna credencial aparece en este documento ni en
ningún otro archivo de este ZIP. Esto describe QUÉ existe, no CUÁL es.

| Variable | Servicio | Para qué se usa | Dónde está configurada | Consumida en | Presente | Estado funcional conocido |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | URL del proyecto (pública por diseño) | Vercel (Production) + `.env.local` local | `src/lib/supabase/client.ts`, `server.ts` | Sí | Funcionando |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Clave anónima cliente (pública por diseño, protegida por RLS) | Vercel (Production) + `.env.local` local | `src/lib/supabase/client.ts`, `server.ts` | Sí | Funcionando |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Bypass de RLS — solo para el webhook de WhatsApp (recibe eventos sin sesión de usuario) | **No confirmada en Vercel** al momento de este export | `src/app/api/whatsapp/webhook/route.ts` | Sin confirmar | No aplica todavía (WhatsApp inactivo) |
| `ANTHROPIC_API_KEY` | Anthropic | Motor de IA (chat, OCR de comprobantes) | Vercel (Production) | `src/lib/ia/motor.ts`, `src/app/api/ia/comprobante/route.ts` | Sí | **En un punto de esta etapa, saldo $0,00.** Sin verificar si se recargó fondos después. Con saldo insuficiente, el sistema responde con el mensaje amigable (ver `AI_ARCHITECTURE.md`), nunca rompe la app. |
| `OPENAI_API_KEY` | OpenAI | Transcripción de audio de WhatsApp (Whisper) | No configurada | `src/lib/transcription/provider.ts` | No | No aplica todavía (WhatsApp inactivo) |
| `WHATSAPP_APP_ID` | Meta | Embedded Signup | No configurada | `src/lib/whatsapp/provider.ts` | No | Pendiente — requiere alta en Meta for Developers |
| `WHATSAPP_APP_SECRET` | Meta | Embedded Signup | No configurada | `src/lib/whatsapp/provider.ts` | No | Pendiente |
| `WHATSAPP_CONFIG_ID` | Meta | Embedded Signup | No configurada | `src/lib/whatsapp/provider.ts` | No | Pendiente |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Meta | Verificación del webhook | No configurada | `src/app/api/whatsapp/webhook/route.ts` | No | Pendiente |

## Credenciales de infraestructura (no son variables de entorno de la app, pero son parte del stack)

| Credencial | Servicio | Estado |
|---|---|---|
| Cuenta de Supabase | `edgarleguizamon266@gmail.com`, organización propia, proyecto `control-ia` (región São Paulo) | Activa, migrada correctamente a cuenta propia del dueño del proyecto (no compartida con terceros) |
| Cuenta de Vercel | `edgarleguizamon266-7893` | Activa, plan Hobby |
| Cuenta de GitHub | `edgarleguizamon266-lab`, repo `Control-ia` (público) | Activa, conectada a Vercel para deploy automático |
| Contraseña de la cuenta de auditoría/prueba | `auditoria@controlia.test` | Existe únicamente para pruebas — ver sección de dataset de auditoría más abajo. Se puede eliminar en cualquier momento con `delete from auth.users where email = 'auditoria@controlia.test';` (cascada automática a todos sus datos) |

## Dataset de auditoría (sin datos reales)

Se creó un usuario de prueba `auditoria@controlia.test` directamente en
la base de producción, con datos 100% ficticios y prefijo `[TEST-AUDITORIA]`
en cada descripción, cubriendo: cuentas Personal y Negocio, movimientos,
presupuesto, meta, deuda, venta y gasto comercial. Los mismos valores
están reconstruidos como script SQL portable en `supabase/seed_auditoria.sql`
(dentro de este export) para poder recrearlos en cualquier otro proyecto
de Supabase sin depender de la base de producción real.

**Ningún dato de un cliente real de CONTROL IA está incluido en este ZIP.**
