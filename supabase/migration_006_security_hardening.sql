-- =========================================================
-- CONTROL IA — Migración 006: Endurecimiento de seguridad
-- Hallazgos del linter de seguridad de Supabase (get_advisors) tras
-- migrar al proyecto propio. Ninguno era explotable (is_super_admin
-- ya bloqueaba a los no-admin), pero se corrigen por buenas prácticas.
-- =========================================================

-- ---------- 1) is_super_admin sin parámetro: evita que un usuario
-- pueda consultar el rol de OTRO usuario llamando a la función con
-- un uid ajeno. Ahora siempre chequea auth.uid() (el propio). ----------
drop function if exists public.is_super_admin(uuid) cascade;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

-- Reemplazar todas las policies que llamaban a is_super_admin(auth.uid())
drop policy if exists "solo super_admin escribe configuracion" on public.system_settings;
create policy "solo super_admin escribe configuracion" on public.system_settings for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "solo super_admin ve eventos whatsapp" on public.whatsapp_events;
create policy "solo super_admin ve eventos whatsapp" on public.whatsapp_events for select
  using (public.is_super_admin());

drop policy if exists "super_admin lee profiles" on public.profiles;
create policy "super_admin lee profiles" on public.profiles for select using (public.is_super_admin());
drop policy if exists "super_admin actualiza profiles" on public.profiles;
create policy "super_admin actualiza profiles" on public.profiles for update using (public.is_super_admin());

drop policy if exists "super_admin lee payments" on public.payments;
create policy "super_admin lee payments" on public.payments for select using (public.is_super_admin());
drop policy if exists "super_admin actualiza payments" on public.payments;
create policy "super_admin actualiza payments" on public.payments for update using (public.is_super_admin());

drop policy if exists "super_admin lee subscriptions" on public.subscriptions;
create policy "super_admin lee subscriptions" on public.subscriptions for select using (public.is_super_admin());
drop policy if exists "super_admin actualiza subscriptions" on public.subscriptions;
create policy "super_admin actualiza subscriptions" on public.subscriptions for all using (public.is_super_admin());

drop policy if exists "solo super_admin escribe planes" on public.subscription_plans;
create policy "solo super_admin escribe planes" on public.subscription_plans for insert with check (public.is_super_admin());
drop policy if exists "solo super_admin actualiza planes" on public.subscription_plans;
create policy "solo super_admin actualiza planes" on public.subscription_plans for update using (public.is_super_admin());
drop policy if exists "solo super_admin borra planes" on public.subscription_plans;
create policy "solo super_admin borra planes" on public.subscription_plans for delete using (public.is_super_admin());

-- Actualizar las funciones de Admin para usar la versión sin parámetro
create or replace function public.admin_list_users()
returns table (
  id uuid, nombre text, apellido text, email text, whatsapp text, role text, tipo_uso text,
  created_at timestamptz, ultimo_acceso timestamptz, suscripcion_estado text, suscripcion_vencimiento date
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_super_admin() then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.nombre, p.apellido, u.email::text, p.whatsapp, p.role, p.tipo_uso, p.created_at,
         u.last_sign_in_at, s.estado, s.fecha_fin
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (select estado, fecha_fin from public.subscriptions where user_id = p.id order by created_at desc limit 1) s on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_aprobar_pago(p_payment_id uuid, p_dias integer default 30)
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid;
begin
  if not public.is_super_admin() then raise exception 'No autorizado'; end if;
  select user_id into v_user_id from public.payments where id = p_payment_id;
  if v_user_id is null then raise exception 'Pago no encontrado'; end if;
  update public.payments set estado = 'aprobado' where id = p_payment_id;
  update public.subscriptions set estado = 'activo', fecha_inicio = current_date, fecha_fin = current_date + (p_dias || ' days')::interval
  where id = (select id from public.subscriptions where user_id = v_user_id order by created_at desc limit 1);
  if not found then
    insert into public.subscriptions (user_id, estado, fecha_inicio, fecha_fin)
    values (v_user_id, 'activo', current_date, current_date + (p_dias || ' days')::interval);
  end if;
  insert into public.audit_logs (user_id, accion, detalle)
  values (auth.uid(), 'admin_aprobo_pago', jsonb_build_object('payment_id', p_payment_id, 'usuario_afectado', v_user_id, 'dias', p_dias));
end;
$$;

create or replace function public.admin_rechazar_pago(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'No autorizado'; end if;
  update public.payments set estado = 'rechazado' where id = p_payment_id;
  insert into public.audit_logs (user_id, accion, detalle) values (auth.uid(), 'admin_rechazo_pago', jsonb_build_object('payment_id', p_payment_id));
end;
$$;

create or replace function public.admin_actualizar_suscripcion(
  p_user_id uuid, p_estado text default null, p_dias_extra integer default null, p_plan_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_sub_id uuid; v_fecha_fin date;
begin
  if not public.is_super_admin() then raise exception 'No autorizado'; end if;
  select id, fecha_fin into v_sub_id, v_fecha_fin from public.subscriptions where user_id = p_user_id order by created_at desc limit 1;
  if v_sub_id is null then
    insert into public.subscriptions (user_id, estado, fecha_inicio, fecha_fin, plan_id)
    values (p_user_id, coalesce(p_estado, 'trial'), current_date, current_date + coalesce(p_dias_extra, 30), p_plan_id)
    returning id into v_sub_id;
  else
    update public.subscriptions set estado = coalesce(p_estado, estado),
      fecha_fin = case when p_dias_extra is not null then coalesce(v_fecha_fin, current_date) + p_dias_extra else fecha_fin end,
      plan_id = coalesce(p_plan_id, plan_id)
    where id = v_sub_id;
  end if;
  insert into public.audit_logs (user_id, accion, detalle)
  values (auth.uid(), 'admin_actualizo_suscripcion', jsonb_build_object('usuario_afectado', p_user_id, 'estado', p_estado, 'dias_extra', p_dias_extra, 'plan_id', p_plan_id));
end;
$$;

-- ---------- 2) Fijar search_path en todas las funciones del motor financiero ----------
create or replace function public.fn_account_balance(p_account_id uuid) returns numeric language sql stable set search_path = public as $$
  select coalesce(a.saldo_inicial, 0)
    + coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'ingreso'), 0)
    - coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'gasto'), 0)
    - coalesce((select sum(t.monto) from public.transactions t where t.account_id = p_account_id and t.tipo = 'transferencia'), 0)
    + coalesce((select sum(t.monto) from public.transactions t where t.transferencia_cuenta_destino_id = p_account_id and t.tipo = 'transferencia'), 0)
  from public.accounts a where a.id = p_account_id;
$$;

create or replace function public.fn_accounts_with_balance(p_workspace_id uuid)
returns table (id uuid, nombre text, tipo text, moneda text, limite_credito numeric, dia_cierre integer, dia_vencimiento integer, institucion text, saldo numeric)
language sql stable set search_path = public as $$
  select a.id, a.nombre, a.tipo, a.moneda, a.limite_credito, a.dia_cierre, a.dia_vencimiento, a.institucion, public.fn_account_balance(a.id)
  from public.accounts a where a.workspace_id = p_workspace_id and a.activa = true order by a.created_at;
$$;

create or replace function public.fn_workspace_balance(p_workspace_id uuid) returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(public.fn_account_balance(a.id)), 0) from public.accounts a where a.workspace_id = p_workspace_id and a.activa = true;
$$;

create or replace function public.fn_period_report(p_workspace_id uuid, p_desde date, p_hasta date)
returns table (ingresos numeric, gastos numeric, gastos_por_categoria jsonb) language sql stable set search_path = public as $$
  with base as (
    select t.tipo, t.monto, coalesce(tc.nombre, 'Otros') as categoria
    from public.transactions t left join public.transaction_categories tc on tc.id = t.category_id
    where t.workspace_id = p_workspace_id and t.fecha between p_desde and p_hasta
  )
  select coalesce((select sum(monto) from base where tipo = 'ingreso'), 0),
    coalesce((select sum(monto) from base where tipo = 'gasto'), 0),
    coalesce((select jsonb_object_agg(categoria, total) from (select categoria, sum(monto) as total from base where tipo = 'gasto' group by categoria) x), '{}'::jsonb);
$$;

create or replace function public.fn_monthly_series(p_workspace_id uuid, p_anio integer)
returns table (mes integer, ingresos numeric, gastos numeric) language sql stable set search_path = public as $$
  select extract(month from t.fecha)::integer, coalesce(sum(t.monto) filter (where t.tipo = 'ingreso'), 0), coalesce(sum(t.monto) filter (where t.tipo = 'gasto'), 0)
  from public.transactions t where t.workspace_id = p_workspace_id and extract(year from t.fecha) = p_anio
  group by extract(month from t.fecha) order by 1;
$$;

create or replace function public.fn_budget_usage(p_workspace_id uuid)
returns table (budget_id uuid, category_id uuid, categoria text, limite numeric, gastado numeric) language sql stable set search_path = public as $$
  select b.id, b.category_id, tc.nombre, b.monto_limite,
    coalesce((select sum(t.monto) from public.transactions t where t.workspace_id = p_workspace_id and t.category_id = b.category_id and t.tipo = 'gasto' and t.fecha >= date_trunc('month', current_date)::date), 0)
  from public.budgets b left join public.transaction_categories tc on tc.id = b.category_id where b.workspace_id = p_workspace_id;
$$;

create or replace function public.fn_business_summary(p_workspace_id uuid, p_desde date, p_hasta date)
returns table (ventas numeric, costos numeric, gastos numeric, ganancia_neta numeric) language sql stable set search_path = public as $$
  with v as (select coalesce(sum(monto), 0) as ventas, coalesce(sum(costo), 0) as costos from public.sales where workspace_id = p_workspace_id and fecha between p_desde and p_hasta),
  g as (select coalesce(sum(monto), 0) as gastos from public.transactions where workspace_id = p_workspace_id and tipo = 'gasto' and fecha between p_desde and p_hasta)
  select v.ventas, v.costos, g.gastos, (v.ventas - v.costos - g.gastos) from v, g;
$$;

create or replace function public.fn_debt_totals(p_workspace_id uuid) returns table (yo_debo numeric, me_deben numeric) language sql stable set search_path = public as $$
  select coalesce((select sum(saldo_pendiente) from public.debts where workspace_id = p_workspace_id and tipo = 'yo_debo'), 0),
    coalesce((select sum(saldo_pendiente) from public.debts where workspace_id = p_workspace_id and tipo = 'me_deben'), 0);
$$;

create or replace function public.fn_business_receivables_payables(p_workspace_id uuid) returns table (por_cobrar numeric, por_pagar numeric) language sql stable set search_path = public as $$
  select coalesce((select sum(saldo_pendiente) from public.customers where workspace_id = p_workspace_id), 0),
    coalesce((select sum(deuda_pendiente) from public.suppliers where workspace_id = p_workspace_id), 0);
$$;

create or replace function public.fn_top_clientes(p_workspace_id uuid, p_desde date, p_hasta date, p_limite integer default 5)
returns table (customer_id uuid, nombre text, total numeric) language sql stable set search_path = public as $$
  select c.id, c.nombre, coalesce(sum(s.monto), 0) from public.customers c
  join public.sales s on s.customer_id = c.id and s.fecha between p_desde and p_hasta
  where c.workspace_id = p_workspace_id group by c.id, c.nombre order by 3 desc limit p_limite;
$$;

create or replace function public.fn_top_proveedores(p_workspace_id uuid, p_desde date, p_hasta date, p_limite integer default 5)
returns table (supplier_id uuid, nombre text, total numeric) language sql stable set search_path = public as $$
  select s.id, s.nombre, coalesce(sum(p.importe), 0) from public.suppliers s
  join public.purchases p on p.supplier_id = s.id and p.fecha between p_desde and p_hasta
  where s.workspace_id = p_workspace_id group by s.id, s.nombre order by 3 desc limit p_limite;
$$;

create or replace function public.fn_verificar_ownership_workspace() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.user_id = new.user_id) then
    raise exception 'El workspace_id no pertenece al usuario de esta fila.';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, apellido, whatsapp, pais, moneda_principal, tipo_uso)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.raw_user_meta_data->>'whatsapp', coalesce(new.raw_user_meta_data->>'pais', 'PY'),
    coalesce(new.raw_user_meta_data->>'moneda_principal', 'PYG'), coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal'));
  insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'personal', 'Personal');
  if coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal') in ('negocio','ambos') then
    insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'negocio', 'Mi Negocio');
  end if;
  return new;
end;
$$;

-- ---------- 3) handle_new_user no debe ser invocable directamente vía API, solo por el trigger ----------
revoke execute on function public.handle_new_user() from anon, authenticated;
