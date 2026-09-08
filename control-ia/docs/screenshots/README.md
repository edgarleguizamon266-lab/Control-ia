# docs/screenshots — Nota honesta

**No existe ninguna carpeta `public/` ni ningún archivo de imagen (logo,
favicon, íconos de PWA) dentro del código fuente de CONTROL IA.**

Verificado con `find` sobre el proyecto completo antes de escribir esto
— cero coincidencias de `.png`, `.svg`, `.ico` fuera de `node_modules`.

Esto es consistente con lo documentado en `KNOWN_ISSUES.md`: la app no
tiene manifest de PWA, no tiene service worker, y el logo "CONTROL IA"
que se ve en la interfaz es texto renderizado (Tailwind + un ícono de
`lucide-react`, componente `LineChart`), no una imagen.

Durante el desarrollo se compartieron numerosas capturas de pantalla en
la conversación con Claude (de la app funcionando, de Vercel, de GitHub,
de Supabase) para diagnosticar problemas paso a paso — esas capturas
viven en el historial de esa conversación, no como artefactos del
proyecto en sí, y por eso no se incluyen en este export de código.

**Recomendación para la auditoría:** si se necesita referencia visual
real de la interfaz actual, la forma más fiel es correr el proyecto
(`DEPLOYMENT.md`) y navegarlo directamente, o pedir capturas nuevas —
cualquier captura vieja podría no reflejar el estado exacto de este
código exportado.
