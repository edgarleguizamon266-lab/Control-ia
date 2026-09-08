-- =========================================================
-- CONTROL IA — Migración 004: Motor Financiero Central
--
-- HALLAZGO CRÍTICO DE AUDITORÍA: accounts.saldo_inicial se usaba en
-- el frontend como si fuera el saldo ACTUAL de la cuenta, pero ningún
-- gasto/ingreso/transferencia lo actualizaba jamás. El saldo mostrado
-- quedaba congelado en el valor cargado al crear la cuenta.
--
-- CORRECCIÓN: el saldo real de una cuenta nunca se almacena ni se
-- muta — se DERIVA siempre, en vivo, de saldo_inicial + movimientos
-- reales. Esto garantiza que editar o eliminar un movimiento
-- recalcule automáticamente el saldo en todas las pantallas (sección
-- 4 y 5 de la auditoría), sin código especial en cada lugar.
--
-- Estas funciones son "security invoker" (comportamiento por
-- defecto): NO se saltan RLS. Corren con los permisos del usuario que
-- las llama, así que la separación entre usuarios sigue intacta.
--
-- Fuente única de verdad (sección 13): dashboard, reportes, negocio
-- e IA llaman EXACTAMENTE a estas mismas funciones. Ninguno vuelve a
-- calcular la fórmula por su cuenta.
-- =========================================================

-- ---------- Saldo de una cuenta ----------
create or replace function public.fn_account_balance(p_account_id uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce(a.saldo_inicial, 0)
    + coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'ingreso'), 0)
    - coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'gasto'), 0)
    - coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'transferencia'), 0)
    + coalesce((select sum(t.monto) from public.transactions t where t.transferencia_cuenta_destino_id = p_account_id and t.tipo = 'transferencia'), 0)
  from public.accounts a
  where a.id = p_account_id;
$$;

-- ---------- Todas las cuentas de un workspace, con saldo real ----------
create or replace function public.fn_accounts_with_balance(p_workspace_id uuid)
returns table (
  id uuid, nombre text, tipo text, moneda text,
  limite_credito numeric, dia_cierre integer, dia_vencimiento integer, institucion text,
  saldo numeric
)
language sql
stable
as $$
  select a.id, a.nombre, a.tipo, a.moneda, a.limite_credito, a.dia_cierre, a.dia_vencimiento, a.institucion,
         public.fn_account_balance(a.id) as saldo
  from public.accounts a
  where a.workspace_id = p_workspace_id and a.activa = true
  order by a.created_at;
$$;

-- ---------- Saldo total disponible de un workspace ----------
create or replace function public.fn_workspace_balance(p_workspace_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(public.fn_account_balance(a.id)), 0)
  from public.accounts a
  where a.workspace_id = p_workspace_id and a.activa = true;
$$;

-- ---------- Ingresos/gastos/desglose por categoría de un período ----------
-- Usado por dashboard, reportes y la IA (get_report) — misma fórmula, siempre.
create or replace function public.fn_period_report(p_workspace_id uuid, p_desde date, p_hasta date)
returns table (ingresos numeric, gastos numeric, gastos_por_categoria jsonb)
language sql
stable
as $$
  with base as (
    select t.tipo, t.monto, coalesce(tc.nombre, 'Otros') as categoria
    from public.transactions t
    left join public.transaction_categories tc on tc.id = t.category_id
    where t.workspace_id = p_workspace_id and t.fecha between p_desde and p_hasta
  )
  select
    coalesce((select sum(monto) from base where tipo = 'ingreso'), 0),
    coalesce((select sum(monto) from base where tipo = 'gasto'), 0),
    coalesce(
      (select jsonb_object_agg(categoria, total) from (
        select categoria, sum(monto) as total from base where tipo = 'gasto' group by categoria
      ) x),
      '{}'::jsonb
    );
$$;

-- ---------- Serie mensual ingresos/gastos de un año (para el gráfico) ----------
create or replace function public.fn_monthly_series(p_workspace_id uuid, p_anio integer)
returns table (mes integer, ingresos numeric, gastos numeric)
language sql
stable
as $$
  select
    extract(month from t.fecha)::integer as mes,
    coalesce(sum(t.monto) filter (where t.tipo = 'ingreso'), 0),
    coalesce(sum(t.monto) filter (where t.tipo = 'gasto'), 0)
  from public.transactions t
  where t.workspace_id = p_workspace_id and extract(year from t.fecha) = p_anio
  group by extract(month from t.fecha)
  order by mes;
$$;

-- ---------- Uso real de presupuestos del mes actual ----------
create or replace function public.fn_budget_usage(p_workspace_id uuid)
returns table (budget_id uuid, category_id uuid, categoria text, limite numeric, gastado numeric)
language sql
stable
as $$
  select
    b.id, b.category_id, tc.nombre, b.monto_limite,
    coalesce((
      select sum(t.monto) from public.transactions t
      where t.workspace_id = p_workspace_id and t.category_id = b.category_id and t.tipo = 'gasto'
        and t.fecha >= date_trunc('month', current_date)::date
    ), 0)
  from public.budgets b
  left join public.transaction_categories tc on tc.id = b.category_id
  where b.workspace_id = p_workspace_id;
$$;

-- ---------- Resumen de Negocio: ventas, costos, gastos, ganancia neta ----------
-- Usado por el dashboard de Mi Negocio, sus reportes y la IA (get_business_summary).
create or replace function public.fn_business_summary(p_workspace_id uuid, p_desde date, p_hasta date)
returns table (ventas numeric, costos numeric, gastos numeric, ganancia_neta numeric)
language sql
stable
as $$
  with v as (
    select coalesce(sum(monto), 0) as ventas, coalesce(sum(costo), 0) as costos
    from public.sales where workspace_id = p_workspace_id and fecha between p_desde and p_hasta
  ),
  g as (
    select coalesce(sum(monto), 0) as gastos
    from public.transactions
    where workspace_id = p_workspace_id and tipo = 'gasto' and fecha between p_desde and p_hasta
  )
  select v.ventas, v.costos, g.gastos, (v.ventas - v.costos - g.gastos) as ganancia_neta
  from v, g;
$$;

-- ---------- Totales de deudas (yo debo / me deben) ----------
create or replace function public.fn_debt_totals(p_workspace_id uuid)
returns table (yo_debo numeric, me_deben numeric)
language sql
stable
as $$
  select
    coalesce((select sum(saldo_pendiente) from public.debts where workspace_id = p_workspace_id and tipo = 'yo_debo'), 0),
    coalesce((select sum(saldo_pendiente) from public.debts where workspace_id = p_workspace_id and tipo = 'me_deben'), 0);
$$;

-- ---------- Cuentas por cobrar/pagar del negocio (clientes/proveedores) ----------
create or replace function public.fn_business_receivables_payables(p_workspace_id uuid)
returns table (por_cobrar numeric, por_pagar numeric)
language sql
stable
as $$
  select
    coalesce((select sum(saldo_pendiente) from public.customers where workspace_id = p_workspace_id), 0),
    coalesce((select sum(deuda_pendiente) from public.suppliers where workspace_id = p_workspace_id), 0);
$$;

-- =========================================================
-- HALLAZGO DE AUDITORÍA (sección 7 — aislamiento): la barrera real de
-- seguridad es user_id vía RLS (confirmado correcto). Pero nada
-- impedía insertar una fila con workspace_id de OTRO workspace válido
-- aunque no perteneciera al usuario, generando datos inconsistentes.
-- Se cierra con un trigger que verifica que workspace_id pertenezca
-- realmente al mismo user_id de la fila, en todas las tablas
-- que se particionan por workspace.
-- =========================================================
create or replace function public.fn_verificar_ownership_workspace()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.workspaces w where w.id = new.workspace_id and w.user_id = new.user_id
  ) then
    raise exception 'El workspace_id no pertenece al usuario de esta fila.';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['accounts','transactions','budgets','goals','debts','sales','customers','suppliers']
  loop
    execute format('drop trigger if exists trg_verificar_workspace on public.%I', t);
    execute format(
      'create trigger trg_verificar_workspace before insert or update of workspace_id, user_id on public.%I
       for each row execute function public.fn_verificar_ownership_workspace()', t
    );
  end loop;
end $$;

-- ---------- Metas: nunca permitir saldos negativos ni "de más" silenciosos ----------
alter table public.goals add constraint goals_monto_ahorrado_no_negativo check (monto_ahorrado >= 0);
