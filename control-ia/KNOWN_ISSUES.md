# KNOWN_ISSUES — CONTROL IA

Sin ocultar nada. Cada item indica causa raíz real (verificada, no
supuesta) y si está corregido o pendiente.

## Corregidos durante esta etapa de desarrollo

### 1. [CORREGIDO] Dashboard mostraba movimientos, Movimientos aparecía vacío
**Causa raíz real:** `transactions` tiene dos foreign keys hacia `accounts`
(`account_id` y `transferencia_cuenta_destino_id`, por las transferencias).
La consulta de Movimientos pedía `accounts(nombre)` sin desambiguar cuál
de las dos relaciones usar — PostgREST no puede resolverlo solo y
devuelve un error de "relación ambigua". El código descartaba ese error
silenciosamente (`const { data } = await supabase...`, sin leer `error`),
mostrando "no hay movimientos" en vez de un error real. El Dashboard
nunca lo sufrió porque su consulta es solo un conteo, sin pedir el
nombre de la cuenta.
**Verificación:** se simuló la consulta con RLS real activado
(`set local request.jwt.claims`) contra la base de producción — con la
sintaxis vieja fallaba, con `accounts!account_id(nombre)` devolvía las
5 filas esperadas.
**Corrección:** `accounts!account_id(nombre)` en `src/app/dashboard/movimientos/page.tsx`
y en `src/lib/ia/motor.ts` (la herramienta `get_transactions` de la IA
tenía el mismo bug — significa que preguntarle a la IA "¿cuánto gasté?"
también devolvía una lista vacía en silencio).

### 2. [CORREGIDO] Saldo de cuenta nunca se actualizaba
**Causa raíz:** `accounts.saldo_inicial` se usaba en el frontend como si
fuera el saldo actual, pero ningún gasto/ingreso/transferencia lo
actualizaba jamás.
**Corrección:** Motor Financiero Central — el saldo siempre se deriva
en vivo (`fn_account_balance`), nunca se almacena. Ver `FINANCIAL_ENGINE.md`.

### 3. [CORREGIDO] Onboarding no creaba ninguna cuenta
**Causa raíz:** el trigger de registro creaba el/los workspace(s) pero
nunca una cuenta dentro. Sin cuenta, ni la IA ni el formulario manual
podían registrar nada — lo que aparentaba ser "la IA no funciona" era
en realidad un hueco de onboarding.
**Verificación:** se confirmó `accounts_count: 0` para la cuenta real
del usuario en producción antes de corregir.
**Corrección:** `migration_010` — cuenta "Efectivo"/"Caja" automática
al crear cada workspace, + reparación retroactiva de cuentas ya
existentes sin ninguna cuenta.

### 4. [CORREGIDO] Ventas de negocio no afectaban el saldo real
**Causa raíz:** `sales` calculaba la ganancia, pero nunca generaba una
fila en `transactions` — el dinero de una venta no aparecía en el saldo
de ninguna cuenta.
**Corrección:** `migration_005` — una venta al contado ahora crea también
el movimiento real correspondiente.

### 5. [CORREGIDO] Errores técnicos de Anthropic mostrados al usuario
**Antes:** el chat mostraba literalmente `400 invalid_request_error:
Your credit balance is too low...` — texto crudo del proveedor.
**Corrección:** clase `ErrorMotorIA` (`src/lib/ia/motor.ts`) traduce
cualquier error del proveedor a un mensaje amigable; el detalle técnico
real queda solo en logs de servidor (`console.error`). El chat muestra
una burbuja distinta con botones Reintentar/Registrar manualmente.

### 6. [CORREGIDO] "Usuario 2 no se puede seleccionar" en Admin
**Causa raíz:** no existía la ruta `/admin/usuarios/[id]` — la lista
solo tenía acciones inline, sin ningún link de detalle.
**Corrección:** ver `ADMIN_ARCHITECTURE.md`, sección dedicada. Se
encontraron y corrigieron además 2 bugs SQL reales (columna `plan_id`
ambigua) en el camino.

### 7. [CORREGIDO] Sin navegación en mobile
**Causa raíz:** el `Sidebar` tenía `hidden md:flex` — invisible en
celular, sin ninguna barra alternativa. Cuentas, Tarjetas, Metas,
Deudas, Negocio, Configuración eran inalcanzables desde el teléfono.
**Corrección:** `MobileNav.tsx` — barra inferior + bottom sheet "Más"
agrupado.

### 8. [CORREGIDO] "Movimientos este mes: 5,00" (decimales en un conteo)
**Causa raíz:** `SummaryCard` usaba formato de moneda para un número
que es una cantidad entera.
**Corrección:** prop `esCantidad` que evita el formato de moneda.

### 9. [CORREGIDO] Permisos de funciones Admin abiertos a nivel `PUBLIC`
**Causa raíz:** al revocar `EXECUTE` de `anon`/`authenticated`
directamente, el permiso real seguía activo porque Postgres lo había
otorgado por defecto al rol `PUBLIC` (que ambos heredan).
**Corrección:** `migration_008` — revocado explícitamente de `PUBLIC`,
otorgado explícitamente solo a `authenticated`.

## Pendientes reales (no corregidos, no ocultos)

### A. WhatsApp sin activar
No es un bug — faltan credenciales de Meta que solo el dueño del
proyecto puede obtener. Ver `WHATSAPP_ARCHITECTURE.md`.

### B. Transcripción de audio sin probar en producción
Código listo (`OpenAIWhisperProvider`), pero depende de `OPENAI_API_KEY`
no configurada, y del punto A (WhatsApp) para poder recibir audio real.

### C. Estado del crédito de Anthropic
En un punto de esta etapa la cuenta de Anthropic usada por el proyecto
llegó a $0,00 de saldo, bloqueando el chat de IA (con el mensaje amigable
correcto, ver punto 5). Verificar el estado actual real en
`SECRETS_INVENTORY.md` antes de asumir que ya está resuelto.

### D. Falta de historial de Git granular
El proyecto se desarrolló sin `git init` local — los commits que existen
son los hechos directamente en la interfaz web de GitHub al subir
archivos ("Add files via upload"), sin mensajes descriptivos por cambio.
No hay forma de generar un `git log`/`git diff` línea por línea de todo
el desarrollo. `RECENT_CHANGES.md` reconstruye la cronología de forma
narrativa a partir de lo efectivamente conversado y aplicado.

### E. Deploy desincronizado con GitHub (incidencia operativa, no de código)
Durante el desarrollo, la app en producción quedó mostrando una versión
vieja repetidas veces porque: (1) no se subían todos los archivos nuevos
a GitHub, y luego (2) al subir de nuevo, los archivos quedaron anidados
en una subcarpeta duplicada (`control-ia/` dentro del repo, junto con
los archivos nuevos en la raíz), mientras el "Root Directory" de Vercel
seguía apuntando a esa subcarpeta vieja. Corregido dejando el "Root
Directory" de Vercel vacío (los archivos correctos quedaron en la raíz
del repo). **Esto no era una regresión de código** — el código nuevo
siempre compiló y funcionó correctamente; el problema era puramente de
qué versión del repo estaba usando el hosting.

### F. Sin implementar (mencionados en prompts, no construidos)
Patrimonio, Inversiones, exportación PDF/CSV/Excel, notificaciones,
2FA, sesiones activas, pantalla de Seguridad, sub-panel de Suscripciones
separado en Admin, límites duros de uso de IA por plan, reglas
personalizadas tipo "combustible = Itaú siempre".

## Sobre las "regresiones" reportadas en varios prompts de esta etapa

En más de una ocasión se reportó que "funciones desaparecieron" o que
hubo una "regresión funcional". Al auditar el código real en cada caso,
la causa fue casi siempre el punto E (deploy desincronizado) — el código
en el proyecto nunca perdió una función ya construida. Los únicos
problemas de código real encontrados están numerados del 1 al 9 arriba,
cada uno con su causa raíz verificada, no supuesta.
