-- =========================================================
-- CONTROL IA — Migración 003
-- Funciones de soporte para el Panel Admin (secciones 50-52).
-- Ejecutar DESPUÉS de migration_002_fase1_gaps.sql
-- =========================================================

-- system_settings (sección 54): el QR y el precio deben poder MOSTRARSE
-- a cualquier usuario logueado (para ver su suscripción), pero solo
-- super_admin puede escribirlos. Migración 002 lo dejó demasiado
-- restrictivo (solo-admin también en lectura) — lo corregimos acá.
drop policy if exists "solo super_admin lee configuracion" on public.system_settings;
create policy "cualquier usuario logueado lee configuracion" on public.system_settings
  for select using (auth.uid() is not null);

-- ---------- admin_list_users: usuarios + email (auth.users) + suscripción ----------
-- El email vive en auth.users, fuera del alcance de las tablas públicas.
-- Esta función corre con privilegios del owner (postgres) para poder leerlo,
-- pero verifica explícitamente que quien llama sea super_admin antes de nada.
-- Nunca expone la contraseña ni ningún campo de autenticación sensible (sección 9, 51).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  nombre text,
  apellido text,
  email text,
  whatsapp text,
  role text,
  tipo_uso text,
  created_at timestamptz,
  ultimo_acceso timestamptz,
  suscripcion_estado text,
  suscripcion_vencimiento date
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    p.id,
    p.nombre,
    p.apellido,
    u.email::text,
    p.whatsapp,
    p.role,
    p.tipo_uso,
    p.created_at,
    u.last_sign_in_at,
    s.estado,
    s.fecha_fin
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select estado, fecha_fin from public.subscriptions
    where user_id = p.id
    order by created_at desc
    limit 1
  ) s on true
  order by p.created_at desc;
end;
$$;

-- ---------- admin_aprobar_pago: aprueba comprobante y renueva/activa suscripción ----------
create or replace function public.admin_aprobar_pago(p_payment_id uuid, p_dias integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select user_id into v_user_id from public.payments where id = p_payment_id;
  if v_user_id is null then
    raise exception 'Pago no encontrado';
  end if;

  update public.payments set estado = 'aprobado' where id = p_payment_id;

  -- Renovar la suscripción más reciente si existe, o crear una activa nueva.
  update public.subscriptions
  set estado = 'activo',
      fecha_inicio = current_date,
      fecha_fin = current_date + (p_dias || ' days')::interval
  where id = (
    select id from public.subscriptions where user_id = v_user_id order by created_at desc limit 1
  );

  if not found then
    insert into public.subscriptions (user_id, estado, fecha_inicio, fecha_fin)
    values (v_user_id, 'activo', current_date, current_date + (p_dias || ' days')::interval);
  end if;

  insert into public.audit_logs (user_id, accion, detalle)
  values (auth.uid(), 'admin_aprobo_pago', jsonb_build_object('payment_id', p_payment_id, 'usuario_afectado', v_user_id, 'dias', p_dias));
end;
$$;

-- ---------- admin_rechazar_pago ----------
create or replace function public.admin_rechazar_pago(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  update public.payments set estado = 'rechazado' where id = p_payment_id;

  insert into public.audit_logs (user_id, accion, detalle)
  values (auth.uid(), 'admin_rechazo_pago', jsonb_build_object('payment_id', p_payment_id));
end;
$$;

-- ---------- admin_actualizar_suscripcion: activar/suspender/agregar días/cambiar plan ----------
create or replace function public.admin_actualizar_suscripcion(
  p_user_id uuid,
  p_estado text default null,
  p_dias_extra integer default null,
  p_plan_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_fecha_fin date;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select id, fecha_fin into v_sub_id, v_fecha_fin
  from public.subscriptions where user_id = p_user_id order by created_at desc limit 1;

  if v_sub_id is null then
    insert into public.subscriptions (user_id, estado, fecha_inicio, fecha_fin, plan_id)
    values (p_user_id, coalesce(p_estado, 'trial'), current_date, current_date + coalesce(p_dias_extra, 30), p_plan_id)
    returning id into v_sub_id;
  else
    update public.subscriptions
    set estado = coalesce(p_estado, estado),
        fecha_fin = case when p_dias_extra is not null then coalesce(v_fecha_fin, current_date) + p_dias_extra else fecha_fin end,
        plan_id = coalesce(p_plan_id, plan_id)
    where id = v_sub_id;
  end if;

  insert into public.audit_logs (user_id, accion, detalle)
  values (auth.uid(), 'admin_actualizo_suscripcion', jsonb_build_object(
    'usuario_afectado', p_user_id, 'estado', p_estado, 'dias_extra', p_dias_extra, 'plan_id', p_plan_id
  ));
end;
$$;
