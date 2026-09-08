-- =========================================================
-- CONTROL IA — Schema Fase 1 (Núcleo)
-- Ejecutar en el SQL editor de Supabase
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------- PROFILES ----------
-- Extiende auth.users con datos de CONTROL IA
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  whatsapp text,
  pais text default 'PY',
  moneda_principal text default 'PYG',
  tipo_uso text not null default 'personal' check (tipo_uso in ('personal','negocio','ambos')),
  onboarding_completo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- WORKSPACES ----------
-- Espacio Personal (siempre 1 por usuario) y/o Negocio
create table if not exists public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('personal','negocio')),
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (user_id, tipo)
);

-- ---------- CUENTAS ----------
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('efectivo','banco','billetera','tarjeta_debito','tarjeta_credito','ahorro','inversion','caja_negocio','otro')),
  saldo_inicial numeric(14,2) not null default 0,
  moneda text not null default 'PYG',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CATEGORÍAS ----------
create table if not exists public.transaction_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade, -- null = categoría del sistema
  workspace_tipo text not null check (workspace_tipo in ('personal','negocio')),
  nombre text not null,
  tipo text not null check (tipo in ('gasto','ingreso')),
  icono text,
  es_sistema boolean not null default false
);

-- ---------- MOVIMIENTOS (transactions) ----------
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.transaction_categories(id),
  tipo text not null check (tipo in ('gasto','ingreso','transferencia')),
  monto numeric(14,2) not null,
  moneda text not null default 'PYG',
  descripcion text,
  fecha date not null default current_date,
  comprobante_url text,
  origen text not null default 'manual' check (origen in ('manual','ia_texto','ia_audio','ia_whatsapp','comprobante')),
  transferencia_cuenta_destino_id uuid references public.accounts(id),
  created_at timestamptz not null default now()
);

-- ---------- PRESUPUESTOS ----------
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.transaction_categories(id),
  monto_limite numeric(14,2) not null,
  periodo text not null default 'mensual' check (periodo in ('mensual','semanal','anual')),
  created_at timestamptz not null default now()
);

-- ---------- METAS ----------
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14,2) not null,
  monto_ahorrado numeric(14,2) not null default 0,
  fecha_limite date,
  created_at timestamptz not null default now()
);

-- ---------- DEUDAS ----------
create table if not exists public.debts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('yo_debo','me_deben')),
  persona text not null,
  monto_total numeric(14,2) not null,
  saldo_pendiente numeric(14,2) not null,
  fecha_vencimiento date,
  created_at timestamptz not null default now()
);

-- ---------- NEGOCIO: clientes / proveedores / ventas ----------
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  contacto text,
  saldo_pendiente numeric(14,2) not null default 0
);

create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  contacto text,
  deuda_pendiente numeric(14,2) not null default 0
);

create table if not exists public.sales (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id),
  producto text,
  monto numeric(14,2) not null,
  costo numeric(14,2) not null default 0,
  forma_pago text,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- SUSCRIPCIONES ----------
create table if not exists public.subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  precio_mensual numeric(14,2) not null,
  limite_operaciones_ia integer not null default 500
);

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  estado text not null default 'trial' check (estado in ('trial','activo','vencido','suspendido')),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monto numeric(14,2) not null,
  banco text,
  numero_operacion text,
  comprobante_url text,
  estado text not null default 'verificando' check (estado in ('verificando','aprobado','rechazado')),
  created_at timestamptz not null default now()
);

-- ---------- AUDITORÍA ----------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  accion text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS: cada usuario ve únicamente sus propios datos
-- =========================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.accounts enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.debts enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own workspaces" on public.workspaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own accounts" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own or system categories" on public.transaction_categories for select using (user_id is null or auth.uid() = user_id);
create policy "own categories write" on public.transaction_categories for insert with check (auth.uid() = user_id);
create policy "own categories update" on public.transaction_categories for update using (auth.uid() = user_id);
create policy "own categories delete" on public.transaction_categories for delete using (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own customers" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own suppliers" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sales" on public.sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own payments" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own audit_logs" on public.audit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- Categorías iniciales del sistema (sección 19)
-- =========================================================
insert into public.transaction_categories (workspace_tipo, nombre, tipo, es_sistema) values
  ('personal','Supermercado','gasto',true),
  ('personal','Comida','gasto',true),
  ('personal','Combustible','gasto',true),
  ('personal','Vivienda','gasto',true),
  ('personal','Servicios','gasto',true),
  ('personal','Salud','gasto',true),
  ('personal','Transporte','gasto',true),
  ('personal','Educación','gasto',true),
  ('personal','Entretenimiento','gasto',true),
  ('personal','Ropa','gasto',true),
  ('personal','Deudas','gasto',true),
  ('personal','Otros','gasto',true),
  ('personal','Sueldo','ingreso',true),
  ('personal','Otros ingresos','ingreso',true),
  ('negocio','Mercadería','gasto',true),
  ('negocio','Delivery','gasto',true),
  ('negocio','Publicidad','gasto',true),
  ('negocio','Alquiler','gasto',true),
  ('negocio','Salarios','gasto',true),
  ('negocio','Proveedores','gasto',true),
  ('negocio','Ventas','ingreso',true)
on conflict do nothing;

-- =========================================================
-- Trigger: crear profile + workspace "personal" al registrarse
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, apellido, whatsapp, pais, moneda_principal, tipo_uso)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.raw_user_meta_data->>'whatsapp',
    coalesce(new.raw_user_meta_data->>'pais', 'PY'),
    coalesce(new.raw_user_meta_data->>'moneda_principal', 'PYG'),
    coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal')
  );

  insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'personal', 'Personal');

  if coalesce(new.raw_user_meta_data->>'tipo_uso', 'personal') in ('negocio','ambos') then
    insert into public.workspaces (user_id, tipo, nombre) values (new.id, 'negocio', 'Mi Negocio');
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
