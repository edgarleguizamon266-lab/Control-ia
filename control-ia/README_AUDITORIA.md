# README_AUDITORIA — CONTROL IA

**Fecha de exportación:** 8 de septiembre de 2026
**Propósito:** paquete completo y verificable para auditoría técnica externa.
**Regla seguida al exportar:** código y arquitectura reales, sin secretos en texto plano, sin datos personales reales, sin omisiones.

---

## 1. Qué es CONTROL IA

SaaS financiero para Paraguay: "Tu dinero. Bajo control." Permite a una
persona o un pequeño negocio registrar ingresos, gastos, transferencias,
presupuestos, metas, deudas y ventas — a mano, por foto de comprobante, o
hablándole a una IA — y ver todo reflejado en un dashboard y reportes
consistentes. Incluye un panel de administración SaaS (usuarios,
suscripciones, pagos, planes) para quien opera el negocio de CONTROL IA
en sí mismo.

## 2. Arquitectura y stack

- **Frontend + Backend:** Next.js 14 (App Router), TypeScript, Tailwind CSS. Todo corre como una sola app (rutas de página + API routes), sin backend separado.
- **Base de datos / Auth / Storage:** Supabase (Postgres 17 gestionado). Row Level Security real en todas las tablas de usuario.
- **IA:** Anthropic Claude (`claude-sonnet-4-5-20250929`), vía tool-use (13 herramientas), sin acceso SQL libre.
- **OCR de comprobantes:** Claude Vision.
- **Transcripción de audio (WhatsApp):** interfaz lista, implementación por defecto usa OpenAI Whisper (ver `AI_ARCHITECTURE.md`).
- **WhatsApp:** WhatsApp Business Platform (Meta), arquitectura lista, credenciales de Meta pendientes (ver `WHATSAPP_ARCHITECTURE.md`).
- **Hosting:** Vercel (proyecto `control-ia`, dominio `control-ia-beta.vercel.app`).
- **Repositorio:** GitHub, `edgarleguizamon266-lab/Control-ia`, rama `main`, conectado a Vercel para deploy automático.

## 3. Cómo levantarlo desde cero

Ver `DEPLOYMENT.md` — paso a paso completo (Supabase, migraciones, variables de entorno, Vercel).

## 4. Qué funciona (verificado con evidencia real, no solo "compila")

- Registro/login, onboarding con creación automática de cuenta "Efectivo"/"Caja".
- CRUD completo: cuentas, tarjetas, categorías, presupuestos, metas, deudas, transferencias.
- Motor Financiero Central: saldo, ingresos, gastos y ganancia de negocio calculados por funciones SQL únicas, consumidas por Dashboard, Movimientos, Reportes, Mi Negocio y la IA (ver `FINANCIAL_ENGINE.md`).
- Motor de IA compartido entre chat web y (futuro) WhatsApp, con 14 herramientas, confirmación antes de crear categorías nuevas o acciones sensibles, y errores del proveedor siempre sanitizados antes de llegar al usuario.
- Mi Negocio: ventas (con trazabilidad a movimiento real de caja), compras, clientes, proveedores, cuentas por cobrar/pagar.
- Panel Admin: resumen, usuarios con **detalle individual real** (`/admin/usuarios/[id]`, corregido en esta etapa — antes no existía), pagos (aprobar/rechazar con renovación atómica), planes editables, configuración de QR.
- Registro Rápido en el Home + Últimos Movimientos + navegación móvil completa (antes inexistente en mobile).
- Pruebas de extremo a extremo ejecutadas directamente contra la base de producción (crear → editar → eliminar → verificar saldo), documentadas en conversación, no solo afirmadas.

## 5. Qué está incompleto o pendiente

Ver `KNOWN_ISSUES.md` para el detalle completo. Resumen:
- WhatsApp: arquitectura lista, **sin activar** — faltan credenciales de Meta (no es código pendiente).
- Transcripción de audio: interfaz lista, sin `OPENAI_API_KEY` configurada todavía.
- Anthropic: la cuenta de este proyecto llegó a estar en **$0 de saldo** durante el desarrollo — actualmente puede seguir sin fondos, verificar en `SECRETS_INVENTORY.md`.
- Patrimonio, Inversiones, exportación PDF/Excel de reportes, 2FA, notificaciones: no implementados (sin UI ni tabla dedicada en varios casos).
- Sub-secciones de Admin (Suscripciones separadas de Usuarios, Logs, Seguridad): no implementadas como pantallas propias.
- Historial de Git real: este proyecto se desarrolló sin `git init` local — no existe historial de commits granular más allá de los commits hechos directamente en GitHub vía su interfaz web de "subir archivos". Ver `RECENT_CHANGES.md` para la reconstrucción narrativa de cambios.

## 6. Archivos importantes para empezar a leer

1. `PROJECT_TREE.txt` — estructura completa real.
2. `DATABASE_ARCHITECTURE.md` — qué tabla alimenta qué pantalla.
3. `FINANCIAL_ENGINE.md` — dónde vive cada cálculo financiero.
4. `AI_ARCHITECTURE.md` — cómo funciona el motor de IA.
5. `ADMIN_ARCHITECTURE.md` — panel de administración.
6. `WHATSAPP_ARCHITECTURE.md` — estado real de la integración.
7. `ROUTES.md` / `UI_ACTIONS.md` — inventario de pantallas y botones.
8. `KNOWN_ISSUES.md` — todo lo que no funciona o falta, sin ocultar nada.
9. `SECRETS_INVENTORY.md` — qué variable de entorno existe, sin exponer su valor.
10. `DEPLOYMENT.md` — cómo desplegar de cero.
11. `TEST_STATUS.md` — qué pruebas existen.
12. `RECENT_CHANGES.md` — cronología de cambios de esta etapa de desarrollo.

## 7. Nota de honestidad sobre este export

Este proyecto fue construido **conmigo (Claude) como único desarrollador**,
a lo largo de una conversación larga con el dueño del producto (no técnico).
No hay "otra IA" ni otro desarrollador involucrado — cuando en la conversación
se mencionaron "regresiones", la auditoría real (documentada en `KNOWN_ISSUES.md`
y `RECENT_CHANGES.md`) encontró que la causa casi siempre fue un despliegue
desactualizado (GitHub/Vercel), no código que efectivamente se rompiera solo.
Los dos bugs reales de código encontrados en todo el proceso están documentados
con su causa raíz exacta en `KNOWN_ISSUES.md`.
