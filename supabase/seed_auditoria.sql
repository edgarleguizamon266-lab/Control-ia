-- =========================================================
-- Dataset de auditoría — 100% ficticio, sin datos de clientes reales.
-- Reproduce el mismo escenario usado para verificar el Motor Financiero
-- Central en producción (ver KNOWN_ISSUES.md y FINANCIAL_ENGINE.md).
--
-- Requiere haber corrido schema.sql + todas las migraciones antes.
-- Requiere pgcrypto (ya se habilita en migration de creación de usuario).
-- =========================================================

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_ws_personal uuid;
  v_ws_negocio uuid;
  v_cuenta_efectivo uuid;
  v_cuenta_ueno uuid;
  v_cuenta_caja uuid;
  v_venta_tx uuid;
  v_cat_sueldo uuid;
  v_cat_super uuid;
  v_cat_combustible uuid;
  v_cat_servicios uuid;
  v_cat_ventas uuid;
  v_cat_compras uuid;
begin
  -- ---------- Usuario de auditoría ----------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    'auditoria@controlia.test',
    crypt('CAMBIAR-ESTA-CLAVE', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"es_prueba":true}'::jsonb,
    '{"nombre":"Auditoría","apellido":"Control IA [TEST]","tipo_uso":"ambos","pais":"PY","moneda_principal":"PYG"}'::jsonb,
    now(), now(), '', '', '', '', false, false
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'auditoria@controlia.test'),
    'email', now(), now(), now());

  -- El trigger handle_new_user ya crea los workspaces + cuenta Efectivo/Caja por defecto.
  select id into v_ws_personal from public.workspaces where user_id = v_user_id and tipo = 'personal';
  select id into v_ws_negocio from public.workspaces where user_id = v_user_id and tipo = 'negocio';

  select id into v_cat_sueldo from public.transaction_categories where workspace_tipo='personal' and nombre='Sueldo';
  select id into v_cat_super from public.transaction_categories where workspace_tipo='personal' and nombre='Supermercado';
  select id into v_cat_combustible from public.transaction_categories where workspace_tipo='personal' and nombre='Combustible';
  select id into v_cat_servicios from public.transaction_categories where workspace_tipo='personal' and nombre='Servicios';
  select id into v_cat_ventas from public.transaction_categories where workspace_tipo='negocio' and nombre='Ventas';
  select id into v_cat_compras from public.transaction_categories where workspace_tipo='negocio' and nombre='Compras';

  -- ---------- Cuentas Personal ----------
  update public.accounts set saldo_inicial = 1000000 where workspace_id = v_ws_personal and nombre = 'Efectivo'
  returning id into v_cuenta_efectivo;

  insert into public.accounts (user_id, workspace_id, nombre, tipo, saldo_inicial, moneda)
  values (v_user_id, v_ws_personal, 'Ueno Test', 'banco', 2000000, 'PYG')
  returning id into v_cuenta_ueno;

  -- ---------- Movimientos Personal ----------
  insert into public.transactions (user_id, workspace_id, account_id, category_id, tipo, monto, descripcion, origen) values
    (v_user_id, v_ws_personal, v_cuenta_ueno, v_cat_sueldo, 'ingreso', 3000000, '[TEST-AUDITORIA] Sueldo', 'manual'),
    (v_user_id, v_ws_personal, v_cuenta_efectivo, v_cat_super, 'gasto', 350000, '[TEST-AUDITORIA] Supermercado', 'manual'),
    (v_user_id, v_ws_personal, v_cuenta_efectivo, v_cat_combustible, 'gasto', 200000, '[TEST-AUDITORIA] Combustible', 'manual'),
    (v_user_id, v_ws_personal, v_cuenta_efectivo, v_cat_servicios, 'gasto', 120000, '[TEST-AUDITORIA] Servicios', 'manual');

  -- ---------- Presupuesto / Meta / Deuda ----------
  insert into public.budgets (user_id, workspace_id, category_id, monto_limite)
  values (v_user_id, v_ws_personal, v_cat_super, 1200000);

  insert into public.goals (user_id, workspace_id, nombre, monto_objetivo, monto_ahorrado)
  values (v_user_id, v_ws_personal, '[TEST-AUDITORIA] Notebook', 6000000, 2000000);

  insert into public.debts (user_id, workspace_id, tipo, persona, monto_total, saldo_pendiente)
  values (v_user_id, v_ws_personal, 'yo_debo', '[TEST-AUDITORIA] Prestamista', 1000000, 700000);

  -- ---------- Negocio: venta con trazabilidad real + gasto comercial ----------
  select id into v_cuenta_caja from public.accounts where workspace_id = v_ws_negocio and nombre = 'Caja';

  insert into public.transactions (user_id, workspace_id, account_id, category_id, tipo, monto, descripcion, origen)
  values (v_user_id, v_ws_negocio, v_cuenta_caja, v_cat_ventas, 'ingreso', 500000, '[TEST-AUDITORIA] Venta', 'manual')
  returning id into v_venta_tx;

  insert into public.sales (user_id, workspace_id, producto, monto, costo, forma_pago, account_id, transaction_id, estado_pago)
  values (v_user_id, v_ws_negocio, '[TEST-AUDITORIA] Producto de prueba', 500000, 300000, 'contado', v_cuenta_caja, v_venta_tx, 'pagado');

  insert into public.transactions (user_id, workspace_id, account_id, category_id, tipo, monto, descripcion, origen)
  values (v_user_id, v_ws_negocio, v_cuenta_caja, v_cat_compras, 'gasto', 50000, '[TEST-AUDITORIA] Gasto comercial', 'manual');

  raise notice 'Usuario de auditoría creado: %', v_user_id;
end $$;

-- ---------- Resultado esperado (verificado en producción, ver FINANCIAL_ENGINE.md) ----------
-- Saldo total Personal:      Gs. 5.330.000
-- Ingresos del mes Personal: Gs. 3.000.000
-- Gastos del mes Personal:   Gs.   670.000
-- Ganancia neta Negocio:     Gs.   150.000  (Venta 500k − Costo 300k − Gasto 50k)
-- Saldo Caja Negocio:        Gs.   450.000

-- ---------- Para eliminar todo el dataset de auditoría ----------
-- delete from auth.users where email = 'auditoria@controlia.test';
-- (cascada automática: profile, workspaces, cuentas, movimientos, presupuesto, meta, deuda, venta)
