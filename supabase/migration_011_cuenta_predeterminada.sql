-- Cuenta predeterminada para gastos e ingresos, por workspace.
-- No va en "profiles" porque un usuario tiene Personal y Negocio con cuentas distintas.
create table if not exists public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cuenta_predeterminada_gasto_id uuid references public.accounts(id) on delete set null,
  cuenta_predeterminada_ingreso_id uuid references public.accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.workspace_preferences enable row level security;
create policy "own workspace_preferences" on public.workspace_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_verificar_workspace on public.workspace_preferences;
create trigger trg_verificar_workspace before insert or update of workspace_id, user_id on public.workspace_preferences
  for each row execute function public.fn_verificar_ownership_workspace();
