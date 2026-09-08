-- Nadie sin sesión (rol anon) necesita llamar nunca a estas funciones de Admin.
-- Ya estaban bloqueadas por la verificación interna is_super_admin(), pero
-- reducimos la superficie de ataque quitando el permiso de ejecución directo.
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_aprobar_pago(uuid, integer) from anon;
revoke execute on function public.admin_rechazar_pago(uuid) from anon;
revoke execute on function public.admin_actualizar_suscripcion(uuid, text, integer, uuid) from anon;
