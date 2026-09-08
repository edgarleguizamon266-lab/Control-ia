# FINANCIAL_ENGINE — CONTROL IA

**Regla de diseño explícita del proyecto:** ninguna pantalla ni la IA
calculan una fórmula financiera por su cuenta. Todas llaman a las mismas
funciones. Este documento existe para que quede imposible tener dos
fórmulas distintas sin que se note.

## Capas

```
Pantallas (Dashboard, Movimientos, Reportes, Negocio) ┐
Motor de IA (src/lib/ia/motor.ts)                     ├──▶ src/lib/financial-engine.ts (TypeScript)
                                                       ┘         │
                                                                 ▼
                                          Funciones SQL fn_* (Postgres, migration_004/005)
```

`src/lib/financial-engine.ts` es un wrapper delgado: cada función hace
`supabase.rpc('fn_...', params)` y tipa el resultado. No reimplementa
ninguna suma en JavaScript.

## Funciones y de dónde sale cada número

| Función SQL | Qué calcula | Quién la usa |
|---|---|---|
| `fn_account_balance(account_id)` | Saldo real de UNA cuenta (derivado, nunca almacenado) | Cuentas, Tarjetas, IA (`get_accounts`, `get_balance`) |
| `fn_accounts_with_balance(workspace_id)` | Todas las cuentas de un workspace con su saldo | Cuentas, Tarjetas, Dashboard |
| `fn_workspace_balance(workspace_id)` | Suma de todas las cuentas activas de un workspace | Dashboard ("Disponible"), IA |
| `fn_period_report(workspace_id, desde, hasta)` | Ingresos, gastos y desglose por categoría de un período | Dashboard, Reportes, IA (`get_report`) |
| `fn_monthly_series(workspace_id, año)` | Serie mensual ingresos/gastos (para el gráfico) | Dashboard |
| `fn_budget_usage(workspace_id)` | Límite vs. gastado por categoría, mes actual | Presupuestos, IA (`get_budget`) |
| `fn_business_summary(workspace_id, desde, hasta)` | Ventas, costos, gastos, ganancia neta del negocio | Mi Negocio, IA (`get_business_summary`) |
| `fn_debt_totals(workspace_id)` | Total "yo debo" / "me deben" | Deudas, IA (`get_debts`) |
| `fn_business_receivables_payables(workspace_id)` | Cuentas por cobrar/pagar del negocio | Mi Negocio, IA |
| `fn_top_clientes` / `fn_top_proveedores` | Ranking del mes | Mi Negocio |

## Fórmulas exactas

**Saldo de una cuenta:**
```
saldo = saldo_inicial
      + Σ(ingresos de esa cuenta)
      − Σ(gastos de esa cuenta)
      − Σ(transferencias salientes)
      + Σ(transferencias entrantes)
```
Nunca se guarda un "saldo actual" en una columna — siempre se deriva en
el momento de la consulta. Consecuencia directa: editar o eliminar un
movimiento recalcula el saldo automáticamente, sin lógica extra.

**Ganancia del negocio:**
```
ganancia_neta = ventas (sales.monto) − costos (sales.costo) − gastos (transactions tipo=gasto)
```
La IA nunca calcula esto "de memoria": siempre llama a `fn_business_summary`
y explica el resultado real devuelto.

**Presupuesto:**
```
% usado = gastado_en_esa_categoria_este_mes / monto_limite
```

## Historial de bugs reales encontrados y corregidos en esta capa

1. **El más grave:** `accounts.saldo_inicial` se usaba en 4 lugares del
   frontend como si fuera el saldo actual, pero nada lo actualizaba
   jamás. Corregido migrando TODO a saldo derivado vía `fn_account_balance`
   (`migration_004`).
2. Las ventas de negocio no generaban un movimiento real en `transactions`
   — la ganancia se calculaba, pero el dinero nunca aparecía en el saldo
   de la cuenta. Corregido en `migration_005` (trazabilidad venta↔movimiento).
3. Onboarding no creaba ninguna cuenta — sin cuenta, ningún movimiento
   podía registrarse (ni manual ni por IA), lo que aparentaba ser un bug
   de IA cuando en realidad era un hueco de onboarding. Corregido en
   `migration_010`.
4. `transactions` tiene dos FK hacia `accounts` (cuenta origen y cuenta
   destino de transferencia). Pedir `accounts(nombre)` sin desambiguar
   hace que PostgREST falle en silencio y la pantalla de Movimientos
   parezca vacía aunque el Dashboard sí muestre datos. Corregido usando
   `accounts!account_id(nombre)` en los dos lugares afectados
   (`src/app/dashboard/movimientos/page.tsx` y `src/lib/ia/motor.ts`).

Todas las pruebas que verifican esta capa están documentadas con
resultados reales (no solo afirmados) en `TEST_STATUS.md`.
