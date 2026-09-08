# DATABASE_ARCHITECTURE — CONTROL IA

Postgres 17 gestionado por Supabase. Todas las tablas de usuario tienen
Row Level Security (RLS) real habilitada — la barrera de seguridad
verdadera es `user_id = auth.uid()`, no la UI.

## 1. Dónde se guardan los usuarios

- `auth.users` (esquema propio de Supabase Auth) — email, password hasheado, metadata.
- `public.profiles` — extiende `auth.users` (mismo `id`, FK con `on delete cascade`): nombre, apellido, whatsapp, país, moneda principal, `tipo_uso` (personal/negocio/ambos), `role` (`user`/`super_admin`).
- Trigger `handle_new_user()` (`AFTER INSERT ON auth.users`) crea automáticamente: el/los `workspace(s)` y una cuenta por defecto ("Efectivo" o "Caja") — corregido en `migration_010`, antes NO creaba la cuenta (causa raíz de un bug documentado en `KNOWN_ISSUES.md`).

## 2. Cómo se separa Personal / Negocio

- `public.workspaces`: `id, user_id, tipo ('personal'|'negocio'), nombre`. Un usuario puede tener 0, 1 o 2 workspaces (constraint `unique(user_id, tipo)`).
- **Toda** tabla financiera (`accounts`, `transactions`, `budgets`, `goals`, `debts`, `sales`, `purchases`, `customers`, `suppliers`) tiene una columna `workspace_id` obligatoria.
- Un trigger (`fn_verificar_ownership_workspace`, `migration_004`) verifica en cada INSERT/UPDATE que el `workspace_id` realmente le pertenezca al `user_id` de esa fila — cierra un hueco de integridad (no de seguridad: la seguridad real ya la daba RLS por `user_id`).
- La vista "Todos" en el frontend simplemente consulta ambos `workspace_id` a la vez y suma — **nunca** mezcla las filas en la base.

## 3. Cómo se calcula el saldo (el punto más importante)

**Nunca se guarda un saldo "actual".** `accounts.saldo_inicial` es fijo
(el valor cargado al crear la cuenta). El saldo real siempre se DERIVA
en el momento, sumando/restando los movimientos reales:

```sql
fn_account_balance(cuenta_id) =
  saldo_inicial
  + SUM(ingresos de esa cuenta)
  - SUM(gastos de esa cuenta)
  - SUM(transferencias salientes)
  + SUM(transferencias entrantes)
```

Esto es intencional: así, editar o eliminar un movimiento recalcula el
saldo automáticamente en todas las pantallas, sin código especial en
cada una. Ver `migration_004_financial_engine.sql`.

## 4. Cómo se calculan ingresos, gastos y transferencias

`transactions` es la tabla central: `tipo ('gasto'|'ingreso'|'transferencia')`, `monto`, `account_id`, `category_id`, `workspace_id`, `fecha`, `origen` (`manual`|`ia_texto`|`ia_whatsapp`|`ia_audio`|`comprobante`).

Una transferencia usa la MISMA fila: `account_id` = cuenta origen,
`transferencia_cuenta_destino_id` = cuenta destino. Nunca cuenta como
ingreso ni gasto en los reportes (`fn_period_report` filtra por tipo).

**Ambigüedad de PostgREST (bug real, corregido):** como `transactions`
tiene DOS foreign keys hacia `accounts` (`account_id` y
`transferencia_cuenta_destino_id`), cualquier `select(..., accounts(nombre))`
sin desambiguar falla en silencio. La forma correcta, usada en todo el
código: `accounts!account_id(nombre)`. Documentado con causa raíz completa
en `KNOWN_ISSUES.md`.

## 5. Cómo se calcula la ganancia del negocio

```sql
fn_business_summary(workspace_id, desde, hasta) =
  ventas   = SUM(sales.monto)
  costos   = SUM(sales.costo)
  gastos   = SUM(transactions.monto WHERE tipo='gasto')
  ganancia_neta = ventas - costos - gastos
```

Una venta al contado, además de la fila en `sales`, crea una fila real
en `transactions` (tipo ingreso, categoría "Ventas") — así el dinero de
una venta SÍ afecta el saldo de la cuenta (antes de `migration_005` esto
no pasaba: era otro bug real, ya corregido).

## 6. Cómo se relacionan la IA y los movimientos

La IA (`src/lib/ia/motor.ts`) llama a las MISMAS funciones SQL que usa
el resto de la app (`getAccountsWithBalance`, `getPeriodReport`, etc. —
ver `src/lib/financial-engine.ts`), y su herramienta `create_transaction`
hace el mismo `insert into transactions` que el formulario manual. No
existe una base ni una fórmula separada para el chat.

## 7. Listado completo de tablas (public schema)

| Tabla | Qué guarda |
|---|---|
| `profiles` | Datos de perfil, rol, tipo de uso |
| `workspaces` | Espacios Personal/Negocio por usuario |
| `accounts` | Cuentas y tarjetas (saldo_inicial, límite, cierre, vencimiento) |
| `transaction_categories` | Categorías del sistema y personalizadas |
| `transactions` | Movimientos: gasto/ingreso/transferencia |
| `budgets` | Presupuestos por categoría |
| `goals` | Metas de ahorro |
| `debts` | Deudas (yo debo / me deben) |
| `customers` / `suppliers` | Clientes/proveedores del negocio |
| `sales` / `purchases` | Ventas y compras del negocio |
| `workspace_preferences` | Cuenta predeterminada para gasto/ingreso por workspace |
| `subscription_plans` / `subscriptions` / `payments` | Suscripción SaaS |
| `system_settings` | Configuración editable (QR de pago, precio) |
| `whatsapp_connections` / `whatsapp_events` | Conexión de WhatsApp por workspace + idempotencia de webhooks |
| `ai_usage` | Costo de IA por mensaje (tokens, origen) |
| `audit_logs` | Auditoría de acciones sensibles (creado por IA, admin, etc.) |

## 8. Funciones SQL (Motor Financiero Central + Admin)

Ver el archivo `FINANCIAL_ENGINE.md` para el detalle de cada función
`fn_*`, y `ADMIN_ARCHITECTURE.md` para las funciones `admin_*`.

## 9. Migraciones, en orden real de aplicación

Ver `supabase/` — 15 archivos, `schema.sql` + `migration_002` a
`migration_014`, en el orden exacto en que se aplicaron a producción
(confirmado con `list_migrations` de Supabase, no reconstruido de memoria).

## 10. Storage

Un solo bucket público, `comprobantes` — comprobantes de gasto,
comprobantes de pago de suscripción, y el QR de pago del admin (carpeta
`qr/`). Políticas: cada usuario solo escribe en su propia carpeta
(`{user_id}/archivo`); solo `super_admin` escribe en `qr/`; lectura pública.
