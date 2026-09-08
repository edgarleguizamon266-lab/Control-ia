# ROUTES — CONTROL IA

Estado verificado: compila limpio (`npm run build`, 0 errores) al momento
de este export. "Funciona" abajo significa verificado con evidencia real
en algún punto de la conversación (consultas SQL directas, pruebas
manuales documentadas); no es una afirmación sin respaldo.

## Públicas

| Ruta | Archivo | Rol | Estado |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Público | Funciona — landing, redirige a `/dashboard` si ya hay sesión |
| `/login` | `src/app/login/page.tsx` | Público | Funciona |
| `/register` | `src/app/register/page.tsx` | Público | Funciona — incluye selección Personal/Negocio/Ambos |

## Cliente (requieren sesión — protegidas por `middleware.ts`)

| Ruta | Archivo | Consulta | Estado |
|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | `fn_period_report`, `fn_workspace_balance`, `fn_monthly_series` | Funciona — incluye Registro Rápido y Últimos Movimientos |
| `/dashboard/movimientos` | `dashboard/movimientos/page.tsx` | `transactions` (join `accounts!account_id`, `transaction_categories`) | Funciona — bug de relación ambigua corregido (ver `KNOWN_ISSUES.md`) |
| `/dashboard/movimientos/nuevo` | `.../nuevo/page.tsx` | inserta en `transactions`, integra OCR | Funciona |
| `/dashboard/movimientos/[id]/editar` | `.../[id]/editar/page.tsx` | update en `transactions` | Funciona |
| `/dashboard/movimientos/transferencia` | `.../transferencia/page.tsx` | insert atómico (una fila, dos cuentas) | Funciona |
| `/dashboard/cuentas` | `dashboard/cuentas/page.tsx` | `fn_accounts_with_balance`, `workspace_preferences` | Funciona |
| `/dashboard/tarjetas` | `dashboard/tarjetas/page.tsx` | `fn_accounts_with_balance` filtrado por tipo | Funciona |
| `/dashboard/categorias` | `dashboard/categorias/page.tsx` | `transaction_categories` | Funciona |
| `/dashboard/presupuestos` | `dashboard/presupuestos/page.tsx` | `fn_budget_usage` | Funciona |
| `/dashboard/metas` | `dashboard/metas/page.tsx` | `goals` | Funciona |
| `/dashboard/deudas` | `dashboard/deudas/page.tsx` | `debts`, `fn_debt_totals` | Funciona |
| `/dashboard/reportes` | `dashboard/reportes/page.tsx` | `fn_period_report` | Funciona |
| `/dashboard/ia` | `dashboard/ia/page.tsx` | `/api/ia` | Funciona en su lógica; bloqueado externamente por saldo de Anthropic (ver `SECRETS_INVENTORY.md`) |
| `/dashboard/negocio` | `dashboard/negocio/page.tsx` | `fn_business_summary`, `fn_top_clientes/proveedores` | Funciona — solo visible si el workspace Negocio existe |
| `/dashboard/negocio/ventas/nueva` | `.../ventas/nueva/page.tsx` | insert `sales` + `transactions` | Funciona |
| `/dashboard/negocio/compras/nueva` | `.../compras/nueva/page.tsx` | insert `purchases` + `transactions` | Funciona |
| `/dashboard/negocio/clientes` | `.../clientes/page.tsx` | `customers` | Funciona |
| `/dashboard/negocio/proveedores` | `.../proveedores/page.tsx` | `suppliers` | Funciona |
| `/dashboard/configuracion/whatsapp` | `.../whatsapp/page.tsx` | `whatsapp_connections` | Funciona — siempre muestra estado real, ver `WHATSAPP_ARCHITECTURE.md` |
| `/dashboard/suscripcion` | `dashboard/suscripcion/page.tsx` | `subscriptions`, `system_settings` | Funciona |

## Admin (requieren `role='super_admin'`, doble verificación)

| Ruta | Archivo | Estado |
|---|---|---|
| `/admin` | `admin/page.tsx` | Funciona |
| `/admin/usuarios` | `admin/usuarios/page.tsx` | Funciona — filas clickeables |
| `/admin/usuarios/[id]` | `admin/usuarios/[id]/page.tsx` | **Nuevo en esta etapa.** Funciona, verificado con dos usuarios distintos |
| `/admin/pagos` | `admin/pagos/page.tsx` | Funciona |
| `/admin/planes` | `admin/planes/page.tsx` | Funciona |
| `/admin/configuracion` | `admin/configuracion/page.tsx` | Funciona |

## API routes

| Ruta | Rol requerido | Qué hace |
|---|---|---|
| `POST /api/ia` | Usuario autenticado | Wrapper de `procesarMensajeIA` (chat web) |
| `POST /api/ia/comprobante` | Usuario autenticado | OCR de comprobante vía Claude Vision |
| `POST /api/whatsapp/signup` | Usuario autenticado | Inicia Embedded Signup — 501 si faltan credenciales de Meta |
| `GET/POST /api/whatsapp/webhook` | Ninguno (webhook público de Meta) | Verificación + recepción de eventos, protegido por `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |

## No implementadas (mencionadas en algún prompt, sin ruta propia todavía)

`/dashboard/patrimonio`, `/dashboard/inversiones`, `/dashboard/negocio/ventas`
(listado, solo existe "nueva"), `/dashboard/negocio/compras` (listado, solo
existe "nueva"), `/dashboard/seguridad`, `/admin/suscripciones` (separada
de usuarios), `/admin/logs`.
