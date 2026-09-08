# Pruebas automatizadas — CONTROL IA

Estas son **pruebas de integración reales**, no mocks: crean usuarios de
verdad (temporales) en tu propio proyecto de Supabase, ejecutan operaciones
financieras reales a través del mismo cliente que usa la app (`@supabase/supabase-js`,
sujeto a RLS), y verifican los resultados exactos. Al final, se borran los
datos de prueba.

Por qué así y no con mocks: la lógica crítica (saldos, RLS, aislamiento entre
usuarios) vive en Postgres, no en JavaScript. Un mock nunca hubiera detectado
el bug real de saldo que encontramos en la auditoría — solo una prueba contra
la base de datos real lo hace.

## Requisitos

1. Un proyecto de Supabase con `schema.sql` + las 5 migraciones ya ejecutadas.
2. Variables de entorno (podés reusar tu `.env.local`, o crear un proyecto de
   Supabase aparte solo para tests):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   El service role se usa SOLO para crear/borrar los usuarios de prueba
   (evita el paso de confirmación de email). Nunca se usa para saltarse RLS
   en las aserciones — esas siempre se hacen con el cliente del usuario.

## Ejecutar

```bash
npm install
npm run test
```

⚠️ Corré esto contra un proyecto de desarrollo/staging, no contra producción
con usuarios reales — las pruebas crean y borran cuentas, movimientos y dos
usuarios temporales (`test-a-*@controlia.test`, `test-b-*@controlia.test`).

## Qué cubre (`financial-engine.test.ts`)

1. Ingreso y gasto recalculan el saldo de la cuenta correctamente.
2. Transferencia entre cuentas: no es ingreso ni gasto, mueve saldo, es atómica.
3. Editar un movimiento recalcula saldo y presupuesto automáticamente.
4. Eliminar un movimiento recalcula saldo automáticamente.
5. Presupuesto: porcentaje correcto y recalculado tras editar/eliminar.
6. Personal vs. Negocio: un gasto personal nunca aparece en el resumen del negocio.
7. Aislamiento entre usuarios: Usuario A no puede leer, editar ni eliminar
   nada de Usuario B (ownership_workspace + RLS), aunque conozca sus IDs.
