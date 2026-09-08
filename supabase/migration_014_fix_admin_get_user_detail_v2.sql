-- Corrección DEFINITIVA del bug de columna ambigua: "plan_id" bare
-- dentro del subquery colisionaba con el parámetro de salida "plan_id"
-- declarado en RETURNS TABLE. Se califica explícitamente sub.plan_id.
create or replace function public.admin_get_user_detail(p_user_id uuid)
returns table (
  id uuid, nombre text, apellido text, email text, whatsapp text, role text, tipo_uso text,
  pais text, moneda_principal text, created_at timestamptz, ultimo_acceso timestamptz,
  suscripcion_estado text, suscripcion_plan text, suscripcion_vencimiento date, plan_id uuid,
  whatsapp_conectado boolean, mensajes_ia_total bigint
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_super_admin() then raise exception 'No autorizado'; end if;

  return query
  select
    p.id, p.nombre, p.apellido, u.email::text, p.whatsapp, p.role, p.tipo_uso, p.pais, p.moneda_principal,
    p.created_at, u.last_sign_in_at,
    s.estado, sp.nombre, s.fecha_fin, s.sub_plan_id,
    exists(select 1 from public.whatsapp_connections wc where wc.user_id = p.id and wc.status = 'connected'),
    coalesce((select count(*) from public.ai_usage a where a.user_id = p.id), 0)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select sub.estado, sub.fecha_fin, sub.plan_id as sub_plan_id
    from public.subscriptions sub where sub.user_id = p.id order by sub.created_at desc limit 1
  ) s on true
  left join public.subscription_plans sp on sp.id = s.sub_plan_id
  where p.id = p_user_id;
end;
$$;
