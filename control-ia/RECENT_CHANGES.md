# RECENT_CHANGES — CONTROL IA

**Nota metodológica honesta:** este proyecto se desarrolló íntegramente
dentro de una conversación con Claude, sin `git init` local. Los únicos
commits reales son los hechos por el dueño del proyecto directamente en
la interfaz web de GitHub ("Add files via upload", sin mensajes
descriptivos por archivo). No existe un `git log`/`git diff` granular
para reconstruir línea por línea. Lo que sigue es una cronología
narrativa fiel a lo efectivamente construido, en el orden real.

## Etapa 1 — Fundación del proyecto
Next.js 14 + TypeScript + Tailwind + Supabase desde cero. Auth, registro
con selección Personal/Negocio/Ambos, dashboard inicial, cuentas,
movimientos, categorías, presupuestos, chat de IA con 3 herramientas
iniciales, suscripción con QR, panel Admin básico.

## Etapa 2 — Prioridades 1-4 (base sólida, negocio, WhatsApp arquitectura)
Transferencias, editar/eliminar movimientos, tarjetas, metas, deudas,
ocultar saldos. Motor de IA ampliado a 13 herramientas. Panel Admin con
usuarios/pagos/planes/configuración. Arquitectura de WhatsApp (sin
activar, documentado explícitamente como tal desde el inicio).

## Etapa 3 — Auditoría financiera + Motor Financiero Central
**Hallazgo crítico:** el saldo de cuenta nunca se recalculaba. Se
construyó el Motor Financiero Central (funciones SQL `fn_*` + wrapper
TypeScript), reemplazando saldo almacenado por saldo siempre derivado.
Se descubrió y corrigió que las ventas de negocio no generaban
movimiento real. Se agregaron pruebas de integración reales (Vitest).
Módulo Mi Negocio completo: compras, clientes, proveedores.

## Etapa 4 — Migración a cuenta propia de Supabase
El proyecto vivía en la cuenta de Supabase de un tercero. Se migró
completamente a una cuenta propia del dueño del proyecto: nuevo
proyecto de Supabase, las 9 migraciones existentes hasta ese momento
aplicadas en orden, corrección de 3 hallazgos de seguridad reales del
propio linter de Supabase (funciones sin `search_path` fijo, función
`is_super_admin` que podía filtrar el rol de otros usuarios, permisos
mal cerrados a nivel del rol `PUBLIC`).

## Etapa 5 — Publicación (Vercel) + WhatsApp con audio
Deploy a Vercel. Se intentó usar la CLI de Vercel de forma autónoma —
bloqueado por restricciones de red del entorno de desarrollo (documentado
honestamente, sin fingir que funcionó). Publicación manual exitosa vía
subida de carpeta. Se construyó el motor de IA compartido
(`src/lib/ia/motor.ts`) usado tanto por el chat web como por el futuro
webhook de WhatsApp, más transcripción de audio (interfaz + implementación
por defecto con OpenAI Whisper).

## Etapa 6 — Auditoría de UX + registro de usuario real
Se encontraron y corrigieron: onboarding sin cuenta por defecto (bloqueaba
todo registro), errores de Anthropic mostrados crudos al usuario, falta
de navegación en mobile (`Sidebar` oculto, sin alternativa). Se construyó
Registro Rápido, Últimos Movimientos, empty states por filtro, protección
contra doble clic en 17 formularios.

## Etapa 7 — Cuenta predeterminada + confirmación de categorías
Tabla `workspace_preferences`. La IA ya no crea categorías nuevas en
silencio — pregunta antes. Reforzado el entendimiento de expresiones
paraguayas de monto en el system prompt.

## Etapa 8 — Conexión a GitHub + incidencias de despliegue
Se conectó GitHub (creado manualmente por el dueño, sin herramienta de
GitHub disponible para Claude en este entorno — documentado como
limitación real). Serie de incidencias operativas (no de código): archivos
subidos en múltiples lotes, carpeta duplicada `control-ia/` conviviendo
con los archivos nuevos en la raíz del repo, Root Directory de Vercel
apuntando a la copia vieja. Diagnosticado leyendo el repo público
directamente y corregido dejando el Root Directory de Vercel vacío.

## Etapa 9 — Bug crítico Dashboard vs. Movimientos (con datos reales del usuario)
Investigación de causa raíz con evidencia real contra la base de
producción (no solo del código): se confirmó que los datos eran
correctos y que RLS permitía leerlos — el bug era la relación ambigua
de PostgREST entre `transactions` y `accounts` (dos foreign keys).
Corregido en los dos lugares afectados. Se corrigió además el conteo
"5,00" (decimales en una cantidad, no en dinero).

## Etapa 10 — Panel Admin: detalle de usuario
Se construyó `/admin/usuarios/[id]`, inexistente hasta este punto — la
causa real de que "Usuario 2 no se pueda seleccionar" era la ausencia
total de esa ruta, no un bug de datos. Se encontraron y corrigieron 2
bugs SQL reales (columna `plan_id` ambigua) durante la construcción.
Se corrigió también la pantalla muerta "Todavía no configuraste este
espacio de trabajo" con una acción real.

## Etapa 11 — Este export de auditoría
Reconstrucción de las 8 migraciones que existían solo en producción
(nunca se habían guardado como archivo local), generación de todos los
documentos de arquitectura, y empaquetado completo y verificado.

## Ningún componente ni ruta fue eliminado en ningún punto de este proceso
Todo lo reportado como "desaparecido" en distintos momentos de la
conversación fue, al auditar el código real, o bien nunca construido
(documentado en `KNOWN_ISSUES.md` como pendiente real) o bien una
versión desplegada desactualizada (Etapa 8) — nunca una regresión de
código efectivamente introducida y luego revertida.
