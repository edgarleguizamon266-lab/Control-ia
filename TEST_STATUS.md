# TEST_STATUS — CONTROL IA

## Pruebas automatizadas (`tests/financial-engine.test.ts`, Vitest)

**14 pruebas de integración real** (no mocks — crean usuarios reales
temporales contra un proyecto de Supabase real vía `@supabase/supabase-js`,
sujetas a RLS real). Documentadas en `tests/README.md`.

| Suite | Prueba | Qué verifica |
|---|---|---|
| Motor Financiero — núcleo | saldo inicial se refleja correctamente | Cuenta nueva arranca en su `saldo_inicial` |
| | un gasto resta del saldo | 1.000.000 − 100.000 = 900.000 |
| | un ingreso suma correctamente | 900.000 + 500.000 = 1.400.000 |
| | transferencia mueve saldo sin contar como ingreso/gasto | Atomicidad + exclusión de reportes |
| | editar recalcula el saldo automáticamente | Sin código especial por edición |
| | eliminar recalcula el saldo automáticamente | Sin código especial por borrado |
| | presupuesto 80% → 60% al editar | Recalculo de porcentaje en vivo |
| Separación Personal/Negocio | gasto personal nunca aparece en resumen del negocio | Aislamiento por `workspace_id` |
| | venta del negocio nunca aumenta saldo personal | Idem |
| Aislamiento entre usuarios (CRÍTICO) | Usuario B no puede leer movimientos de A | RLS real |
| | Usuario B no puede leer cuenta de A por ID directo | RLS real |
| | Usuario B no puede editar movimiento de A | RLS real |
| | Usuario B no puede eliminar movimiento de A | RLS real |
| | Usuario B no puede insertar con `workspace_id` de A | Trigger `fn_verificar_ownership_workspace` |

**Estado real de ejecución:** estas pruebas requieren credenciales de un
proyecto de Supabase real (`SUPABASE_SERVICE_ROLE_KEY` incluida) para
correr — **no se ejecutaron dentro de este entorno de desarrollo**
porque ese entorno no tiene salida de red hacia `supabase.co`. Se
verificó manualmente la lógica que estas pruebas cubren ejecutando
consultas SQL equivalentes directamente contra la base de producción
real (ver `KNOWN_ISSUES.md` y `FINANCIAL_ENGINE.md` para los resultados
exactos obtenidos: crear → 200.000, editar → 150.000, eliminar → 0,
saldo total 5.330.000, ganancia negocio 150.000, etc.) — coincidieron
exactamente con lo esperado en cada caso. Para tener el `PASS`/`FAIL`
formal de Vitest, correr `npm run test` con `.env.local` apuntando a un
proyecto de Supabase real (de prueba, no producción).

## Áreas sin cobertura automatizada

- Motor de IA (`src/lib/ia/motor.ts`) — sin tests unitarios ni de
  integración; se verificó manualmente que sus herramientas usan las
  mismas funciones SQL que las pruebas de arriba cubren, pero el loop
  de tool-use con Anthropic en sí no tiene test automatizado.
- OCR de comprobantes.
- Webhook de WhatsApp (no puede probarse de punta a punta sin credenciales de Meta).
- Panel Admin (`admin_get_user_detail`, `admin_aprobar_pago`, etc.) — verificado manualmente vía SQL simulando RLS, sin test automatizado en Vitest.
- Componentes de UI (ningún test de React Testing Library / Playwright).

## Pruebas manuales ejecutadas y documentadas con evidencia real

Ver `KNOWN_ISSUES.md` y `FINANCIAL_ENGINE.md` — cada una fue ejecutada
con consultas SQL reales contra producción (no solo afirmadas), incluyendo
limpieza de los datos de prueba usados en cada caso.
