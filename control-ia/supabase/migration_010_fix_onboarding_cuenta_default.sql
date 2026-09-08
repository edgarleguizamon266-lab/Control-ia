-- =========================================================
-- HALLAZGO DE AUDITORÍA UX: el registro creaba el workspace pero
-- NUNCA una cuenta dentro de él. Un usuario nuevo no podía registrar
-- NINGÚN movimiento (ni por IA ni manual) hasta crear una cuenta a
-- mano. Se corrige creando una cuenta "Efectivo" por defecto,
-- automáticamente, en cada workspace nuevo.
-- =========================================================
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_workspace_personal uuid;
  v_workspace_negocio uuid;
begin
  insert into public.profiles (id, nombre, apellido, whatsapp, pais, moneda_principal, tipo_uso)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.raw_user_meta_data->>'whatsapp', coalesce(new.raw_user_meta_data->>'pais', 'PY'),
    coalesce(new.raw_user_meta_data->>'moneda_principal', 'PYG'), coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal'));

  insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'personal', 'Personal')
  returning id into v_workspace_personal;
  insert into public.accounts (user_id, workspace_id, nombre, tipo, saldo_inicial, moneda)
  values (new.id, v_workspace_personal, 'Efectivo', 'efectivo', 0, coalesce(new.raw_user_meta_data->>'moneda_principal', 'PYG'));

  if coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal') in ('negocio','ambos') then
    insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'negocio', 'Mi Negocio')
    returning id into v_workspace_negocio;
    insert into public.accounts (user_id, workspace_id, nombre, tipo, saldo_inicial, moneda)
    values (new.id, v_workspace_negocio, 'Caja', 'caja_negocio', 0, coalesce(new.raw_user_meta_data->>'moneda_principal', 'PYG'));
  end if;

  return new;
end;
$$;

-- Reparación retroactiva de workspaces existentes sin ninguna cuenta.
insert into public.accounts (user_id, workspace_id, nombre, tipo, saldo_inicial, moneda)
select w.user_id, w.id, case when w.tipo = 'negocio' then 'Caja' else 'Efectivo' end,
       case when w.tipo = 'negocio' then 'caja_negocio' else 'efectivo' end, 0, 'PYG'
from public.workspaces w
where not exists (select 1 from public.accounts a where a.workspace_id = w.id);
