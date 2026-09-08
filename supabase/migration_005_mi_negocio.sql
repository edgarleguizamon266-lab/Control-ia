-- =========================================================
-- CONTROL IA — Migración 005: Mi Negocio completo
--
-- HALLAZGO DE AUDITORÍA: "sales" calculaba la ganancia del negocio,
-- pero nunca tocaba una cuenta real ni la tabla "transactions". Una
-- venta cobrada en efectivo NUNCA aparecía en el saldo de "Efectivo"
-- ni en el dashboard general. Se corrige agregando la trazabilidad
-- venta → movimiento real, y venta a crédito → cuenta por cobrar.
-- =========================================================

alter table public.sales add column if not exists account_id uuid references public.accounts(id);
alter table public.sales add column if not exists transaction_id uuid references public.transactions(id);
alter table public.sales add column if not exists estado_pago text not null default 'pagado' check (estado_pago in ('pagado','pendiente','parcial'));
alter table public.sales add column if not exists cantidad numeric(14,2) default 1;

-- ---------- Compras del negocio (sección 20) ----------
create table if not exists public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  concepto text not null,
  cantidad numeric(14,2) default 1,
  importe numeric(14,2) not null,
  account_id uuid references public.accounts(id),
  transaction_id uuid references public.transactions(id),
  comprobante_url text,
  estado_pago text not null default 'pagado' check (estado_pago in ('pagado','pendiente','parcial')),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
create policy "own purchases" on public.purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_verificar_workspace on public.purchases;
create trigger trg_verificar_workspace before insert or update of workspace_id, user_id on public.purchases
  for each row execute function public.fn_verificar_ownership_workspace();

-- ---------- Clientes/Proveedores: última compra (para reportes, sección 22-23) ----------
alter table public.customers add column if not exists ultima_compra date;
alter table public.customers add column if not exists total_comprado numeric(14,2) not null default 0;
alter table public.customers add column if not exists notas text;
alter table public.suppliers add column if not exists ultimo_movimiento date;
alter table public.suppliers add column if not exists total_comprado numeric(14,2) not null default 0;
alter table public.suppliers add column if not exists notas text;

-- ---------- Categoría del sistema para el ingreso de ventas (si no existe) ----------
insert into public.transaction_categories (workspace_tipo, nombre, tipo, es_sistema)
select 'negocio', 'Ventas', 'ingreso', true
where not exists (
  select 1 from public.transaction_categories where workspace_tipo = 'negocio' and nombre = 'Ventas' and tipo = 'ingreso'
);
insert into public.transaction_categories (workspace_tipo, nombre, tipo, es_sistema)
select 'negocio', 'Compras', 'gasto', true
where not exists (
  select 1 from public.transaction_categories where workspace_tipo = 'negocio' and nombre = 'Compras' and tipo = 'gasto'
);

-- ---------- fn_business_summary ahora también resta compras pagadas como costo (ya cubierto vía transactions.tipo='gasto', sin cambios necesarios) ----------

-- ---------- Reportes de negocio: mejores clientes / proveedores / gastos (sección 26) ----------
create or replace function public.fn_top_clientes(p_workspace_id uuid, p_desde date, p_hasta date, p_limite integer default 5)
returns table (customer_id uuid, nombre text, total numeric)
language sql stable as $$
  select c.id, c.nombre, coalesce(sum(s.monto), 0) as total
  from public.customers c
  join public.sales s on s.customer_id = c.id and s.fecha between p_desde and p_hasta
  where c.workspace_id = p_workspace_id
  group by c.id, c.nombre
  order by total desc
  limit p_limite;
$$;

create or replace function public.fn_top_proveedores(p_workspace_id uuid, p_desde date, p_hasta date, p_limite integer default 5)
returns table (supplier_id uuid, nombre text, total numeric)
language sql stable as $$
  select s.id, s.nombre, coalesce(sum(p.importe), 0) as total
  from public.suppliers s
  join public.purchases p on p.supplier_id = s.id and p.fecha between p_desde and p_hasta
  where s.workspace_id = p_workspace_id
  group by s.id, s.nombre
  order by total desc
  limit p_limite;
$$;
