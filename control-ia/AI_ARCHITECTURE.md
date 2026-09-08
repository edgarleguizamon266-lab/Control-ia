# AI_ARCHITECTURE — CONTROL IA

## Flujo

```
Usuario (chat web / WhatsApp texto / WhatsApp audio)
   │
   ▼
src/lib/ia/motor.ts → procesarMensajeIA()   ← ÚNICO cerebro, un solo lugar
   │
   ▼
Anthropic Claude (claude-sonnet-4-5-20250929), vía llamarAnthropicSeguro()
   │  (tool-use loop, máx. 5 vueltas)
   ▼
ejecutarTool(nombre, input) → llama a src/lib/financial-engine.ts o
                               hace un insert/update/delete real en Supabase
   │
   ▼
Resultado real de la base de datos ← nunca inventado
   │
   ▼
Respuesta de texto al usuario + auditoría (audit_logs) si fue una escritura
```

`/api/ia/route.ts` (chat web) y `/api/whatsapp/webhook/route.ts` (WhatsApp,
sin activar aún) son ambos wrappers delgados sobre `procesarMensajeIA()`.
No existe una segunda implementación del motor.

## Modelo y proveedor

- Modelo: `claude-sonnet-4-5-20250929` (Anthropic Messages API).
- No hay una abstracción multi-proveedor (`AIProvider` genérico) implementada
  todavía — el acoplamiento a Anthropic está aislado en `motor.ts` y
  `llamarAnthropicSeguro()`, lo que facilitaría cambiar de proveedor sin
  tocar el resto del sistema, pero la interfaz formal (`parseFinancialIntent`,
  etc.) no se construyó como capa separada.

## Las 14 herramientas (tools)

**Lectura (no requieren confirmación):**
`get_accounts`, `get_balance`, `get_transactions`, `get_report`, `get_budget`,
`get_debts`, `get_business_summary`, `get_receivables_payables`, `get_subscription_status`.

**Escritura simple:**
`create_transaction`, `create_budget`, `create_debt`, `create_sale`.

**Sensibles (requieren confirmación explícita previa del usuario, exigida por el system prompt):**
`update_transaction`, `delete_transaction`.

`create_transaction` tiene dos salvaguardas explícitas:
1. Si la categoría mencionada no matchea ninguna existente, la tool devuelve
   `requiere_confirmacion_categoria: true` en vez de crearla sola — el
   system prompt le exige a la IA preguntar antes de reintentar con
   `categoria_confirmada: true`.
2. Si hay más de una cuenta y ninguna es la predeterminada ni fue
   mencionada, devuelve `requiere_eleccion_cuenta: true` con las opciones.

## Cuenta predeterminada

`workspace_preferences.cuenta_predeterminada_gasto_id` /
`cuenta_predeterminada_ingreso_id`, configurable desde Cuentas → "Cuentas
predeterminadas". `create_transaction` la usa antes de preguntar.

## System prompt — reglas explícitas incluidas

- Nunca inventar montos, saldos, porcentajes.
- Interpretar expresiones paraguayas ("85 mil", "1 millón") — "1 palo" se
  trata como ambiguo y se confirma antes de registrar.
- Sé breve, en español paraguayo/rioplatense, "Gs." para guaraníes.

## Manejo de errores (sección crítica de la auditoría)

`ErrorMotorIA` (`src/lib/ia/motor.ts`) envuelve **todas** las llamadas a
Anthropic. Nunca se propaga el error crudo del proveedor:

| Causa real detectada | Mensaje mostrado al usuario |
|---|---|
| `status 400` + "credit balance" | "CONTROL IA está temporalmente sin conexión con el asistente (saldo de la API agotado). Podés registrar tu movimiento manualmente..." |
| `status 401/403` | "CONTROL IA no está configurado correctamente en el servidor todavía." |
| `status 429` | "Hay mucha demanda en este momento. Esperá unos segundos..." |
| Cualquier otro | "No pude procesar tu mensaje ahora mismo..." |

El detalle técnico real se registra con `console.error` (logs de Vercel),
nunca en la respuesta HTTP al cliente. El chat web (`/dashboard/ia`)
muestra estos errores en una burbuja distinta (ámbar, con ícono de alerta)
con botones **Reintentar** y **Registrar manualmente** — nunca como un
mensaje de IA normal.

**Estado real conocido en el momento de este export:** la cuenta de
Anthropic usada por este proyecto llegó a tener **$0,00 de saldo**
durante el desarrollo. Ver `SECRETS_INVENTORY.md` para el estado actual
exacto — no asumir que ya tiene fondos sin verificarlo.

## Costo y límites

`ai_usage` registra cada llamada: `tokens_entrada`, `tokens_salida`,
`modelo`, `origen` (`app`/`whatsapp`/`audio`). No hay todavía un límite
duro por plan que bloquee al usuario al superar su cuota (el campo
`subscription_plans.limite_operaciones_ia` existe en la base pero no se
aplica activamente en `motor.ts`).

## OCR de comprobantes

`/api/ia/comprobante/route.ts` usa Claude Vision: recibe una imagen en
base64, devuelve JSON `{comercio, monto, fecha, categoria_sugerida,
numero_operacion, confianza}`. Se calcula un hash SHA-256 de la imagen
para avisar de posibles duplicados (`transactions.comprobante_hash`).
El formulario de "Nuevo movimiento" usa el resultado para **prellenar
campos editables** — nunca inserta el movimiento automáticamente.

## Transcripción de audio (para WhatsApp)

`src/lib/transcription/provider.ts` — interfaz `TranscriptionProvider`
con una implementación por defecto (`OpenAIWhisperProvider`, usa
`OPENAI_API_KEY`, modelo `whisper-1`, idioma forzado a español). Sin esa
variable configurada, falla explícitamente (`CredencialFaltanteError`),
nunca simula una transcripción.
