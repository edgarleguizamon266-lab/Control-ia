# ADMIN_ARCHITECTURE — CONTROL IA

## Roles y protección

`profiles.role` — solo dos valores: `user` (default) / `super_admin`.
**Doble verificación**, ninguna confía solo en el frontend:
1. `src/middleware.ts` — cualquier ruta `/admin/*` sin `role='super_admin'` se redirige a `/dashboard` antes de renderizar nada.
2. `src/app/admin/layout.tsx` (server component) — vuelve a consultar el rol server-side, por si el middleware fuera bypaseado.
3. A nivel de base: toda función `admin_*` empieza con `if not public.is_super_admin() then raise exception`. Aunque alguien llamara la función RPC directamente sin pasar por la UI, la base la rechaza.

## Pantallas existentes

| Ruta | Qué hace |
|---|---|
| `/admin` | Resumen: usuarios totales, activos, pagos pendientes, ingreso del mes (consultas directas, no vía función admin_*). |
| `/admin/usuarios` | Lista completa vía `admin_list_users()` (incluye email desde `auth.users`, nunca password). Buscador. Acciones rápidas inline: Activar/Suspender/+30 días. **Cada fila es clickeable** → navega a `/admin/usuarios/[id]`. |
| `/admin/usuarios/[id]` | **Corregido en esta etapa — antes no existía.** Detalle real de un usuario específico (nombre, email, WhatsApp conectado, plan, vencimiento, mensajes de IA usados). Acciones: Activar, Suspender, Renovar +30 días, Agregar días personalizados, Cambiar plan. Nunca muestra los movimientos financieros del usuario (separación explícita entre administración de cuenta y datos financieros privados). |
| `/admin/pagos` | Aprobar/rechazar comprobantes de pago subidos por clientes. Aprobar ejecuta `admin_aprobar_pago()` — función atómica que marca el pago aprobado Y renueva la suscripción en la misma transacción. |
| `/admin/planes` | CRUD de `subscription_plans` — precio y límite de IA editables sin redeploy. |
| `/admin/configuracion` | Edita `system_settings.pago_qr` (titular, banco, cuenta, instrucciones, precio, imagen del QR) — se refleja al instante en la pantalla de Suscripción de todos los clientes. |

## El bug de "Usuario 2 no se puede seleccionar" — causa real y corrección

**Causa:** no era un bug de lógica ni de datos — directamente **no existía
la ruta** `/admin/usuarios/[id]`. La lista de usuarios solo tenía botones
de acción inline (Activar/Suspender/+30 días vía `prompt` o clic directo),
sin ningún link a una vista de detalle. "Usuario 2" (o cualquiera que no
fuera el primero de la lista) no tenía forma de abrirse individualmente
porque esa pantalla nunca se había construido.

**Corrección (`migration_012`, `013`, `014` + `src/app/admin/usuarios/[id]/page.tsx`):**
1. Se agregó la función `admin_get_user_detail(p_user_id uuid)`.
2. Se hicieron las filas de la tabla clickeables (`router.push` a la ruta dinámica).
3. Se construyó la página de detalle completa.
4. **Se encontraron y corrigieron 2 bugs SQL reales en el camino** (columna `plan_id` ambigua entre el parámetro de salida de la función y la columna de la tabla `subscriptions` — ver `migration_013` y `014` para el historial exacto de cada intento).
5. Se verificó con evidencia real: se abrió el detalle de dos usuarios distintos (el dueño de la cuenta y un usuario de prueba) y se confirmó que cada uno trae sus propios datos — nada hardcodeado al primer usuario de la lista.

## Privacidad admin (sección explícitamente pedida)

El panel Admin **nunca** muestra automáticamente los movimientos, saldos
ni categorías de gasto de un usuario — solo datos de cuenta/suscripción
(plan, vencimiento, WhatsApp conectado, cantidad de mensajes de IA usados).
No existe todavía un mecanismo de "acceso de soporte autorizado y auditado"
a los datos financieros de un cliente — si se necesita en el futuro, debe
construirse como una función aparte con su propio registro en `audit_logs`.

## Funciones `admin_*` (todas `security definer`, todas verifican `is_super_admin()` internamente)

- `admin_list_users()`
- `admin_get_user_detail(uuid)`
- `admin_aprobar_pago(uuid, integer)`
- `admin_rechazar_pago(uuid)`
- `admin_actualizar_suscripcion(uuid, text, integer, uuid)`

Todas revocadas de `PUBLIC` y `anon`; solo `authenticated` puede
invocarlas (y la verificación interna filtra a los no-admin). Ver
`migration_007` y `008` para el historial de este endurecimiento — la
primera versión dejó el permiso abierto a nivel del rol `PUBLIC` por un
descuido real, corregido en la misma sesión de auditoría de seguridad.

## Qué NO existe todavía en Admin

- Pantalla de Suscripciones separada de Usuarios (hoy se ve embebido en el detalle de cada usuario).
- Logs / auditoría visible en UI (los eventos SÍ se graban en `audit_logs`, pero no hay pantalla que los liste).
- Seguridad (2FA, sesiones activas) — no implementado en ningún nivel, ni cliente ni admin.
- Uso de IA agregado por plan con límites duros aplicados.
