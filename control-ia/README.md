# CONTROL IA — Tu dinero. Bajo control.

SaaS financiero con IA conversacional. Personal + Negocio. Paraguay primero,
arquitectura preparada para escalar a otros países y proveedores.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage) con Row Level Security real
- **Anthropic Claude** (tool-use) como motor de IA — 13 herramientas, sin acceso SQL libre
- **Recharts** para gráficos

## ✅ Tu Supabase ya está migrado

Tu proyecto propio **`control-ia`** ya existe en tu cuenta (`edgarleguizamon266@gmail.com`,
organización `zzncagundalddjazlmiw`, región São Paulo). Ya se aplicaron **9 migraciones**
(tablas, RLS, motor financiero, endurecimiento de seguridad, bucket de Storage). No hace
falta que ejecutes nada de SQL a mano — `.env.local` ya viene con tu URL y tu anon key reales.

Lo único que falta:
1. Completar `ANTHROPIC_API_KEY` en `.env.local` con tu propia key de Anthropic.
2. Registrarte en la app (`/register`) — eso crea tu usuario real.
3. Avisarme tu email de registro para que te convierta en `super_admin` desde acá
   (yo tengo acceso directo a tu proyecto vía el conector).

<details>
<summary>Referencia: qué hace cada migración (ya aplicadas, no hace falta correrlas)</summary>

1. `schema.sql` — tablas base, RLS, trigger de onboarding
2. `migration_002_fase1_gaps.sql` — roles, tarjetas, system_settings, WhatsApp, ai_usage
3. `migration_003_admin_helpers.sql` — funciones del Panel Admin
4. `migration_004_financial_engine.sql` — saldo derivado en vivo (Motor Financiero Central)
5. `migration_005_mi_negocio.sql` — compras, trazabilidad venta↔movimiento, reportes de negocio
6. `migration_006_security_hardening.sql` — search_path fijo, is_super_admin sin fuga de info
7. `migration_007_revoke_anon_admin_functions.sql` — cierre de superficie de ataque en funciones admin
8. `migration_008_revoke_public_execute.sql` — corrección del grant real (rol PUBLIC)
9. `migration_009_storage_bucket.sql` — bucket `comprobantes` + políticas de Storage

</details>

## 1. Si alguna vez necesitás migrar a OTRO proyecto de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutá en este orden:
   1. `supabase/schema.sql`
   2. `supabase/migration_002_fase1_gaps.sql`
   3. `supabase/migration_003_admin_helpers.sql`
   4. `supabase/migration_004_financial_engine.sql`
   5. `supabase/migration_005_mi_negocio.sql`
   6. `supabase/migration_006_security_hardening.sql`
   7. `supabase/migration_009_storage_bucket.sql` (el 007/008 quedan solo como historial, ya incluidos en el 006 si armás todo desde cero)
3. En **Storage**, creá un bucket público llamado `comprobantes` (o dejá que la migración 009 lo haga).
4. Copiá **Project URL**, **anon public key** y **service_role key** desde Settings → API.
5. Convertí tu propio usuario en administrador (después de registrarte en la app):
   ```sql

   update public.profiles set role = 'super_admin' where id = 'TU-USER-ID';
   ```

## 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
y `SUPABASE_SERVICE_ROLE_KEY` (necesaria solo para el webhook de WhatsApp).
Las 4 variables `WHATSAPP_*` quedan vacías hasta que tengas credenciales de Meta — ver sección WhatsApp más abajo.

## 3. Instalar y correr

```bash
npm install
npm run dev
```

## Flujo completo que ya funciona

Registro → onboarding (Personal/Negocio/Ambos) → cuentas → registrar
ingreso/gasto (manual, por IA o por foto de comprobante con vista previa
editable) → transferencias entre cuentas → presupuestos con alerta →
metas → deudas (yo debo / me deben) → tarjetas → dashboard con gráficos
reales → Mi Negocio (ventas, costos, ganancia real) → reportes → chat con
la IA (lectura, creación, corrección y eliminación de movimientos, siempre
con datos reales, nunca inventados) → suscripción con QR configurable →
comprobante de pago → **Admin revisa y aprueba/rechaza** → suscripción se
renueva automáticamente → panel de usuarios y planes editable sin tocar código.

## Panel Admin

Ruta `/admin` (protegida por rol `super_admin` en middleware **y** en el
layout server-side — doble verificación, sección 8).

- **Resumen**: usuarios totales, activos, pagos pendientes, ingreso del mes.
- **Usuarios**: listado con email (vía función `admin_list_users`, nunca expone contraseñas), activar/suspender/agregar días.
- **Pagos**: aprobar o rechazar comprobantes subidos por los clientes. Aprobar renueva la suscripción automáticamente (función `admin_aprobar_pago`, atómica). **Nunca se activa una suscripción solo por subir una imagen** — siempre pasa por esta aprobación manual mientras no haya una pasarela de pago real (sección 4).
- **Planes**: precios y límites de IA editables sin redeploy.
- **Configuración**: titular, banco, cuenta, instrucciones y QR de pago — se reflejan al instante en la pantalla de suscripción de todos los clientes.

## Motor Financiero Central (sección 13 de la auditoría)

`src/lib/financial-engine.ts` es la ÚNICA capa que calcula saldos, ingresos,
gastos, presupuestos y ganancia del negocio — llama a funciones SQL
(`migration_004_financial_engine.sql`) que a su vez son la única fórmula real.
Dashboard, Reportes, Cuentas, Tarjetas, Presupuestos, Mi Negocio y la IA usan
exactamente las mismas funciones. Ver `tests/README.md` para las pruebas que
verifican esto.

## Motor de IA (13 herramientas, sección 34)

Lectura (sin confirmación): `get_accounts`, `get_balance`, `get_transactions`,
`get_report`, `get_budget`, `get_debts`, `get_business_summary`, `get_subscription_status`.

Escritura simple: `create_transaction`, `create_budget`, `create_debt`, `create_sale`.

Sensibles (requieren que el usuario haya confirmado explícitamente antes,
según el prompt del sistema): `update_transaction`, `delete_transaction`.

La IA nunca calcula un monto "de memoria": todo dato financiero sale de una
consulta real a la base (regla absoluta, sección 72).

## Comprobantes y OCR (sección 38-39)

`/api/ia/comprobante` usa Claude Vision para leer un ticket/comprobante y
devuelve una extracción sugerida. El formulario de "Nuevo movimiento" la
usa para **prellenar campos editables** — nunca registra automáticamente.
Se calcula un hash del archivo para avisar de posibles duplicados.

## WhatsApp — estado real (Fase 4, secciones 40-47)

**Arquitectura lista, integración NO activa** (correctamente, según la sección 83
de la especificación: "no fingir integraciones").

Lo que ya existe:
- `whatsapp_connections` / `whatsapp_events` (con idempotencia real por `id` de mensaje).
- `src/lib/whatsapp/provider.ts`: interfaz de proveedor (`startEmbeddedSignup`,
  `registerPhone`, `subscribeWebhook`, `sendMessage`, etc.) pensada para no
  acoplarse a un único proveedor.
- `/api/whatsapp/signup`: si faltan credenciales de Meta, responde 501 con un
  mensaje claro — nunca simula una URL de conexión falsa.
- `/api/whatsapp/webhook`: verificación oficial (`GET`) + recepción de eventos
  con idempotencia y enrutamiento multi-tenant por `phone_number_id` (`POST`).
- Pantalla `Configuración > WhatsApp`: siempre muestra el estado real
  ("No conectado" por defecto). El botón "Conectar mi WhatsApp" existe pero
  informa honestamente que faltan credenciales hasta que se configuren.

**Lo que falta para activarlo** (credenciales de Meta, no código):
1. Crear una app de Meta for Developers con el producto WhatsApp Business Platform.
2. Configurar Embedded Signup (Facebook Login for Business) y obtener `WHATSAPP_CONFIG_ID`.
3. Completar `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Implementar los métodos de `MetaDirectProvider` contra la Graph API real (están marcados con `TODO` explícitos).
5. Conectar el webhook al motor de IA (marcado con `TODO` en `/api/whatsapp/webhook/route.ts`).

## Pendientes documentados (no ocultos, según sección 68/85)

Quedan preparados en el modelo de datos pero sin UI todavía:
- OCR avanzado con confirmación por WhatsApp/audio (Fase 2)
- Clientes y Proveedores del negocio (tablas ya existen)
- Notificaciones (in-app/email/push) — tabla `notifications` no creada aún
- 2FA, exportación PDF/CSV/Excel de reportes, i18n multi-idioma
- Auditoría visible en UI (los eventos ya se graban en `audit_logs`)

## Estructura

```text
supabase/
  schema.sql                    → tablas base + RLS + trigger de onboarding
  migration_002_fase1_gaps.sql  → roles, tarjetas, system_settings, whatsapp_*, ai_usage
  migration_003_admin_helpers.sql → funciones security definer para el Panel Admin
src/
  app/
    login/ register/
    dashboard/                  → app del cliente
      movimientos/ (+ [id]/editar, + transferencia)
      cuentas/ tarjetas/ categorias/ presupuestos/ metas/ deudas/
      negocio/ reportes/ suscripcion/ ia/
      configuracion/whatsapp/
    admin/                      → panel de administración (protegido por rol)
      usuarios/ pagos/ planes/ configuracion/
    api/
      ia/route.ts                → motor central (13 tools contra Supabase)
      ia/comprobante/route.ts    → OCR con vista previa editable
      whatsapp/signup/route.ts   → inicio de Embedded Signup (real, sin fingir)
      whatsapp/webhook/route.ts  → verificación + recepción idempotente
  lib/
    supabase/ workspace-context.tsx utils/currency.ts
    whatsapp/provider.ts         → abstracción de proveedor .

```
