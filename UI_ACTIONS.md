# UI_ACTIONS — CONTROL IA

Inventario de acciones reales por pantalla. Todos los botones de guardado
tienen protección contra doble clic (`if (guardando) return` + `disabled`
durante el envío) — corregido explícitamente en esta etapa para los 17
formularios de la app.

## Navegación global

- **Barra inferior (mobile, `MobileNav.tsx`):** Inicio / Movimientos / IA / **Más** (abre bottom sheet con secciones agrupadas: Finanzas, Negocio, CONTROL IA, Cuenta — Admin solo si `esAdmin`).
- **Sidebar (desktop, `Sidebar.tsx`):** mismos destinos, siempre visible.
- **Header:** saludo, selector Personal/Negocio/Todos (solo si hay workspace de Negocio), ícono de ojo (ocultar/mostrar saldos — aplica a `formatMoney` en toda la app vía el flag `mostrarSaldos` del contexto), acceso a Admin (solo `esAdmin`), cerrar sesión.

## Dashboard (`/dashboard`)

- **Registro Rápido:** toggle Gasto/Ingreso → monto → categoría → cuenta → "Agregar detalles" (fecha/descripción) → Guardar. Inserta en `transactions`, muestra confirmación inline, dispara refresh del resumen sin recargar la página.
- **Últimos Movimientos:** lista de 5, link "Ver todos" → `/dashboard/movimientos`.
- Acciones rápidas: Comprobante, Preguntar a la IA, Reportes.
- Empty state si 0 movimientos este mes (en vez de gráficos vacíos).
- Si el workspace seleccionado no existe (ej. "Negocio" sin configurar): pantalla "Configurá tu negocio" con botón real que crea el workspace + cuenta "Caja" (antes era un mensaje sin salida — corregido en esta etapa).

## Movimientos (`/dashboard/movimientos`)

- Tabs: Todos/Ingresos/Gastos/Transferencias — cada uno con su propio empty state y botón (antes todos mostraban el mismo mensaje genérico — corregido).
- Buscador por categoría/cuenta/descripción.
- Por fila (hover): Editar, Eliminar (con `confirm()`).
- Botones de cabecera: Transferir, Nuevo movimiento.
- Si la consulta a la base falla, muestra un error real con botón Reintentar — nunca lo confunde con "no hay datos" (esto es exactamente lo que corrigió el bug de la relación ambigua).

## Cuentas / Tarjetas

- Alta de cuenta/tarjeta (nombre, tipo, saldo inicial; tarjeta además: institución, límite, día de cierre/vencimiento).
- Sección "Cuentas predeterminadas" (para gasto y para ingreso) — la usa la IA para no preguntar cada vez.

## Presupuestos / Metas / Deudas

- Alta con formulario mínimo. Metas: botón "+ Agregar ahorro" (prompt). Deudas: tabs Yo debo/Me deben, botón "+ Registrar pago" que crea el movimiento real y reduce el saldo pendiente.

## Mi Negocio

- Accesos: + Nueva venta, + Nueva compra, Clientes, Proveedores.
- Venta: contado (crea movimiento real) o crédito (aumenta cuenta por cobrar del cliente).
- Compra: pagado (crea movimiento real) o pendiente (aumenta deuda del proveedor).
- Clientes/Proveedores: alta + botón "Registrar cobro/pago" (crea movimiento + reduce saldo).

## CONTROL IA (`/dashboard/ia`)

- Chips de sugerencia (clicables, deshabilitados mientras se envía un mensaje).
- Burbujas de error diferenciadas (ámbar, ícono de alerta) con botones **Reintentar** y **Registrar manualmente** — nunca muestra el JSON del proveedor.

## Suscripción

- "Ya pagué" → subir comprobante → estado "Verificando pago" (nunca se activa sola con solo subir la imagen).

## Admin

- Usuarios: fila clickeable → detalle. Detalle: Activar, Suspender, Renovar +30, Agregar días personalizados, Cambiar plan (select).
- Pagos: Aprobar (renueva suscripción atómicamente) / Rechazar.
- Planes: alta/edición de precio inline.
- Configuración: edición de datos del QR + subida de imagen.

## Botones/CTAs mencionados en prompts pero NO implementados todavía

Duplicar movimiento, exportar PDF/CSV/Excel, "Analizar con CONTROL IA" desde
Reportes, gestión de 2FA/sesiones activas, eliminar cuenta de usuario
(self-service), Patrimonio (+Activo/+Pasivo), Inversiones.
