-- El grant real problemático estaba en el rol PUBLIC (heredado por anon
-- y authenticated automáticamente), no en anon/authenticated directamente.
-- Se revoca de PUBLIC y se otorga explícitamente solo donde corresponde.

revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_aprobar_pago(uuid, integer) from public;
revoke execute on function public.admin_rechazar_pago(uuid) from public;
revoke execute on function public.admin_actualizar_suscripcion(uuid, text, integer, uuid) from public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_aprobar_pago(uuid, integer) to authenticated;
grant execute on function public.admin_rechazar_pago(uuid) to authenticated;
grant execute on function public.admin_actualizar_suscripcion(uuid, text, integer, uuid) to authenticated;

-- handle_new_user: solo lo invoca el trigger, nadie debería poder llamarlo por API.
revoke execute on function public.handle_new_user() from public;

-- is_super_admin: necesaria para que las policies de RLS la evalúen como
-- usuario autenticado. Se quita de PUBLIC y anon (no aporta nada a un
-- usuario sin sesión) y se deja solo para authenticated.
revoke execute on function public.is_super_admin() from public;
revoke execute on function public.is_super_admin() from anon;
grant execute on function public.is_super_admin() to authenticated;
