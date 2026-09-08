-- =========================================================
-- CONTROL IA — Migración 002
-- Cierra gaps de Prioridad 1 (Base sólida): tarjetas, roles,
-- system_settings para pagos/QR admin, whatsapp_connections
-- (arquitectura real, sin datos falsos), ai_usage.
-- Ejecutar DESPUÉS de supabase/schema.sql
-- =========================================================

-- ---------- Roles (sección 9) ----------
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','super_admin'));

-- Función security definer para evitar recursión de RLS al chequear el rol
-- (una policy sobre profiles NO puede volver a consultar profiles directamente).
create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'super_admin');
$$;

-- ---------- Tarjetas: extender accounts (sección 20) ----------
alter table public.accounts add column if not exists limite_credito numeric(14,2);
alter table public.accounts add column if not exists dia_cierre integer check (dia_cierre between 1 and 31);
alter table public.accounts add column if not exists dia_vencimiento integer check (dia_vencimiento between 1 and 31);
alter table public.accounts add column if not exists institucion text;

-- ---------- Movimientos: permitir edición (auditoría) + detección de duplicados (sección 39) ----------
alter table public.transactions add column if not exists updated_at timestamptz not null default now();
alter table public.transactions add column if not exists comprobante_hash text;
create index if not exists idx_transactions_comprobante_hash on public.transactions(comprobante_hash) where comprobante_hash is not null;

-- ---------- system_settings: QR y datos de pago editables sin redeploy (sección 54) ----------
create table if not exists public.system_settings (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.system_settings enable row level security;
create policy "solo super_admin lee configuracion" on public.system_settings for select
  using (public.is_super_admin(auth.uid()));
create policy "solo super_admin escribe configuracion" on public.system_settings for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

insert into public.system_settings (clave, valor) values
  ('pago_qr', '{"titular": "", "banco": "", "cuenta": "", "instrucciones": "Escaneá el QR y realizá el pago.", "qr_url": null, "precio_mensual": 25000}')
on conflict (clave) do nothing;

-- ---------- whatsapp_connections (secciones 40-46) ----------
-- Arquitectura real preparada. NO se activa "conectado" hasta que exista
-- una respuesta válida del proveedor oficial (Embedded Signup / BSP).
create table if not exists public.whatsapp_connections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'meta_direct' check (provider in ('meta_direct','bsp')),
  waba_id text,
  phone_number_id text,
  normalized_phone text,
  display_name text,
  status text not null default 'not_connected' check (
    status in ('not_connected','connecting','connected','requires_attention','disconnected')
  ),
  provider_metadata jsonb,
  credential_ref text, -- referencia a secreto gestionado externamente, NUNCA el token en texto plano
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);
alter table public.whatsapp_connections enable row level security;
create policy "own whatsapp connection" on public.whatsapp_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Idempotencia de eventos entrantes (sección 46)
create table if not exists public.whatsapp_events (
  id text primary key, -- id del evento/mensaje que entrega el proveedor
  connection_id uuid references public.whatsapp_connections(id) on delete cascade,
  payload jsonb,
  procesado_en timestamptz not null default now()
);
alter table public.whatsapp_events enable row level security;
create policy "solo super_admin ve eventos whatsapp" on public.whatsapp_events for select
  using (public.is_super_admin(auth.uid()));

-- ---------- ai_usage: costo de IA por usuario (sección 66) ----------
create table if not exists public.ai_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  mensajes integer not null default 1,
  tokens_entrada integer default 0,
  tokens_salida integer default 0,
  modelo text,
  origen text default 'app' check (origen in ('app','whatsapp','audio')),
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
create policy "own ai_usage" on public.ai_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Admin: policies de solo-lectura ampliadas ----------
-- El SUPER_ADMIN necesita ver (no editar libremente) usuarios, pagos y suscripciones
-- para aprobar comprobantes (sección 50-52), sin ver contraseñas (viven en auth.users, fuera de alcance).
create policy "super_admin lee profiles" on public.profiles for select
  using (public.is_super_admin(auth.uid()));
create policy "super_admin actualiza profiles" on public.profiles for update
  using (public.is_super_admin(auth.uid()));
create policy "super_admin lee payments" on public.payments for select
  using (public.is_super_admin(auth.uid()));
create policy "super_admin actualiza payments" on public.payments for update
  using (public.is_super_admin(auth.uid()));
create policy "super_admin lee subscriptions" on public.subscriptions for select
  using (public.is_super_admin(auth.uid()));
create policy "super_admin actualiza subscriptions" on public.subscriptions for all
  using (public.is_super_admin(auth.uid()));
alter table public.subscription_plans enable row level security;
create policy "cualquiera lee planes" on public.subscription_plans for select using (true);
create policy "solo super_admin escribe planes" on public.subscription_plans for insert
  with check (public.is_super_admin(auth.uid()));
create policy "solo super_admin actualiza planes" on public.subscription_plans for update
  using (public.is_super_admin(auth.uid()));
create policy "solo super_admin borra planes" on public.subscription_plans for delete
  using (public.is_super_admin(auth.uid()));
