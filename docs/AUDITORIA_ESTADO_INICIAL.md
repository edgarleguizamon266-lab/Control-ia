# AUDITORIA_ESTADO_INICIAL — Fase 0

**Fecha:** 8 de septiembre de 2026

## Estado del deploy antes de esta fase

- **Repositorio:** `edgarleguizamon266-lab/Control-ia`, rama `main`, código en la raíz del repo (corregido en una incidencia previa donde había quedado duplicado en una subcarpeta — ver `RECENT_CHANGES.md` del export de auditoría anterior).
- **Vercel:** proyecto `control-ia`, Root Directory vacío (correcto), deploy automático conectado a GitHub.
- **Supabase:** proyecto `control-ia` (región São Paulo), 14 migraciones aplicadas (`001` a `014`, confirmado con `list_migrations`, no de memoria).
- **Build:** compila limpio, 34 rutas, sin errores de TypeScript.

## Comparación código vs. producción

No se encontró ninguna función que exista en código y no esté desplegada
— el deploy actual de Vercel corresponde al último commit de `main`. La
única discrepancia código-vs-producción real que existió en esta etapa
del proyecto fue una incidencia de configuración (Root Directory
apuntando a una copia vieja), ya documentada y corregida en una etapa
anterior. No se repite acá para no duplicar información — ver el ZIP de
auditoría anterior, `KNOWN_ISSUES.md`, punto E.

## Punto de partida para esta Fase (P0 — seguridad)

Se procede directo a auditar RLS real contra la base de producción,
sin asumir nada del código: cada hallazgo de esta fase fue **reproducido
con una prueba real** antes de corregirse, y **re-verificado después**
de corregir. Ver el reporte de Fase 1 para el detalle exacto de cada
prueba y su resultado.
