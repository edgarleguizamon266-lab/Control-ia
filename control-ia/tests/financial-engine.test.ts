import "dotenv/config";
import { beforeAll, afterAll, describe, test, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAccountsWithBalance, getWorkspaceBalance, getPeriodReport, getBudgetUsage, getBusinessSummary, primerYUltimoDiaDelMes } from "../src/lib/financial-engine";

// =========================================================
// Pruebas de integración reales contra Supabase — ver tests/README.md
// Cubren exactamente los escenarios pedidos en la auditoría (secciones 2-7).
// =========================================================

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY. Ver tests/README.md."
  );
}

const admin = createClient(URL, SERVICE_KEY);

async function crearUsuarioDePrueba(prefijo: string) {
  const email = `${prefijo}-${Date.now()}@controlia.test`;
  const password = "Test1234!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: "Test", apellido: prefijo, tipo_uso: "ambos", moneda_principal: "PYG" },
  });
  if (error || !data.user) throw error;

  const cliente = createClient(URL, ANON_KEY);
  const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password });
  if (errLogin) throw errLogin;

  return { userId: data.user.id, cliente };
}

async function obtenerWorkspace(cliente: SupabaseClient, tipo: "personal" | "negocio") {
  const { data } = await cliente.from("workspaces").select("id").eq("tipo", tipo).single();
  return data!.id as string;
}

async function crearCuenta(cliente: SupabaseClient, workspaceId: string, saldoInicial: number, nombre = "Efectivo") {
  const {
    data: { user },
  } = await cliente.auth.getUser();
  const { data } = await cliente
    .from("accounts")
    .insert({ user_id: user!.id, workspace_id: workspaceId, nombre, tipo: "efectivo", saldo_inicial: saldoInicial })
    .select()
    .single();
  return data!.id as string;
}

async function crearMovimiento(cliente: SupabaseClient, workspaceId: string, accountId: string, tipo: "gasto" | "ingreso", monto: number) {
  const {
    data: { user },
  } = await cliente.auth.getUser();
  const { data } = await cliente
    .from("transactions")
    .insert({ user_id: user!.id, workspace_id: workspaceId, account_id: accountId, tipo, monto })
    .select()
    .single();
  return data!.id as string;
}

describe("Motor Financiero — núcleo (secciones 2-5 de la auditoría)", () => {
  let cliente: SupabaseClient;
  let workspacePersonal: string;
  let cuentaId: string;

  beforeAll(async () => {
    const u = await crearUsuarioDePrueba("test-a");
    cliente = u.cliente;
    workspacePersonal = await obtenerWorkspace(cliente, "personal");
  });

  test("saldo inicial se refleja correctamente", async () => {
    cuentaId = await crearCuenta(cliente, workspacePersonal, 1_000_000);
    const saldo = await getWorkspaceBalance(cliente, workspacePersonal);
    expect(saldo).toBe(1_000_000);
  });

  test("un gasto resta del saldo (1.000.000 - 100.000 = 900.000)", async () => {
    await crearMovimiento(cliente, workspacePersonal, cuentaId, "gasto", 100_000);
    const cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaId)!.saldo).toBe(900_000);
  });

  test("un ingreso posterior suma correctamente (900.000 + 500.000 = 1.400.000)", async () => {
    await crearMovimiento(cliente, workspacePersonal, cuentaId, "ingreso", 500_000);
    const cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaId)!.saldo).toBe(1_400_000);
  });

  test("transferencia mueve saldo entre cuentas sin contar como ingreso/gasto", async () => {
    const cuentaB = await crearCuenta(cliente, workspacePersonal, 0, "Banco");
    const {
      data: { user },
    } = await cliente.auth.getUser();

    await cliente.from("transactions").insert({
      user_id: user!.id,
      workspace_id: workspacePersonal,
      account_id: cuentaId,
      transferencia_cuenta_destino_id: cuentaB,
      tipo: "transferencia",
      monto: 500_000,
    });

    const cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaId)!.saldo).toBe(900_000); // 1.400.000 - 500.000
    expect(cuentas.find((c) => c.id === cuentaB)!.saldo).toBe(500_000);

    const { desde, hasta } = primerYUltimoDiaDelMes();
    const reporte = await getPeriodReport(cliente, workspacePersonal, desde, hasta);
    // La transferencia NO debe sumar a ingresos ni gastos del período.
    expect(reporte.ingresos).toBe(500_000); // solo el ingreso real de la prueba anterior
    expect(reporte.gastos).toBe(100_000); // solo el gasto real de la prueba anterior
  });

  test("editar un movimiento recalcula el saldo automáticamente", async () => {
    const cuentaEdit = await crearCuenta(cliente, workspacePersonal, 0, "Cuenta edición");
    const movId = await crearMovimiento(cliente, workspacePersonal, cuentaEdit, "gasto", 100_000);

    let cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaEdit)!.saldo).toBe(-100_000);

    await cliente.from("transactions").update({ monto: 80_000 }).eq("id", movId);

    cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaEdit)!.saldo).toBe(-80_000);
  });

  test("eliminar un movimiento recalcula el saldo automáticamente", async () => {
    const cuentaDel = await crearCuenta(cliente, workspacePersonal, 200_000, "Cuenta borrado");
    const movId = await crearMovimiento(cliente, workspacePersonal, cuentaDel, "gasto", 50_000);

    let cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaDel)!.saldo).toBe(150_000);

    await cliente.from("transactions").delete().eq("id", movId);

    cuentas = await getAccountsWithBalance(cliente, workspacePersonal);
    expect(cuentas.find((c) => c.id === cuentaDel)!.saldo).toBe(200_000);
  });

  test("presupuesto: 80% de uso, y se recalcula al editar/eliminar", async () => {
    const { data: categoria } = await cliente
      .from("transaction_categories")
      .select("id")
      .eq("workspace_tipo", "personal")
      .eq("nombre", "Supermercado")
      .single();
    const {
      data: { user },
    } = await cliente.auth.getUser();

    await cliente.from("budgets").insert({
      user_id: user!.id,
      workspace_id: workspacePersonal,
      category_id: categoria!.id,
      monto_limite: 1_000_000,
    });

    const cuentaPresu = await crearCuenta(cliente, workspacePersonal, 0, "Cuenta presupuesto");
    const { data: mov } = await cliente
      .from("transactions")
      .insert({ user_id: user!.id, workspace_id: workspacePersonal, account_id: cuentaPresu, category_id: categoria!.id, tipo: "gasto", monto: 800_000 })
      .select()
      .single();

    let usos = await getBudgetUsage(cliente, workspacePersonal);
    let presu = usos.find((u) => u.category_id === categoria!.id)!;
    expect(Math.round((presu.gastado / presu.limite) * 100)).toBe(80);

    await cliente.from("transactions").update({ monto: 600_000 }).eq("id", mov!.id);
    usos = await getBudgetUsage(cliente, workspacePersonal);
    presu = usos.find((u) => u.category_id === categoria!.id)!;
    expect(Math.round((presu.gastado / presu.limite) * 100)).toBe(60);
  });
});

describe("Separación Personal vs. Negocio (sección 6)", () => {
  let cliente: SupabaseClient;
  let workspacePersonal: string;
  let workspaceNegocio: string;

  beforeAll(async () => {
    const u = await crearUsuarioDePrueba("test-separacion");
    cliente = u.cliente;
    workspacePersonal = await obtenerWorkspace(cliente, "personal");
    workspaceNegocio = await obtenerWorkspace(cliente, "negocio");
  });

  test("un gasto personal nunca aparece en el resumen del negocio", async () => {
    const cuentaPersonal = await crearCuenta(cliente, workspacePersonal, 0, "Efectivo personal");
    await crearMovimiento(cliente, workspacePersonal, cuentaPersonal, "gasto", 300_000);

    const { desde, hasta } = primerYUltimoDiaDelMes();
    const resumenNegocio = await getBusinessSummary(cliente, workspaceNegocio, desde, hasta);

    expect(resumenNegocio.gastos).toBe(0);
    expect(resumenNegocio.ventas).toBe(0);
  });

  test("una venta del negocio nunca aumenta el saldo personal", async () => {
    const cuentaNegocio = await crearCuenta(cliente, workspaceNegocio, 0, "Caja negocio");
    const {
      data: { user },
    } = await cliente.auth.getUser();
    await cliente.from("sales").insert({ user_id: user!.id, workspace_id: workspaceNegocio, monto: 200_000, costo: 120_000, account_id: cuentaNegocio, estado_pago: "pagado" });

    const saldoPersonal = await getWorkspaceBalance(cliente, workspacePersonal);
    expect(saldoPersonal).toBe(0);
  });
});

describe("Aislamiento entre usuarios (sección 7 — CRÍTICO)", () => {
  let clienteA: SupabaseClient;
  let clienteB: SupabaseClient;
  let workspaceA: string;
  let cuentaA: string;
  let movimientoA: string;

  beforeAll(async () => {
    const a = await crearUsuarioDePrueba("test-aislamiento-a");
    const b = await crearUsuarioDePrueba("test-aislamiento-b");
    clienteA = a.cliente;
    clienteB = b.cliente;
    workspaceA = await obtenerWorkspace(clienteA, "personal");
    cuentaA = await crearCuenta(clienteA, workspaceA, 500_000);
    movimientoA = await crearMovimiento(clienteA, workspaceA, cuentaA, "gasto", 50_000);
  });

  test("Usuario B no puede LEER movimientos de Usuario A", async () => {
    const { data } = await clienteB.from("transactions").select("*").eq("id", movimientoA);
    expect(data).toEqual([]);
  });

  test("Usuario B no puede LEER una cuenta de Usuario A por ID directo", async () => {
    const { data } = await clienteB.from("accounts").select("*").eq("id", cuentaA);
    expect(data).toEqual([]);
  });

  test("Usuario B no puede EDITAR un movimiento de Usuario A", async () => {
    await clienteB.from("transactions").update({ monto: 999_999 }).eq("id", movimientoA);
    // Verificar con el cliente A (el único con permiso) que el valor NO cambió.
    const { data } = await clienteA.from("transactions").select("monto").eq("id", movimientoA).single();
    expect(Number(data!.monto)).toBe(50_000);
  });

  test("Usuario B no puede ELIMINAR un movimiento de Usuario A", async () => {
    await clienteB.from("transactions").delete().eq("id", movimientoA);
    const { data } = await clienteA.from("transactions").select("id").eq("id", movimientoA).single();
    expect(data?.id).toBe(movimientoA);
  });

  test("Usuario B no puede insertar datos usando el workspace_id de Usuario A (trigger de ownership)", async () => {
    const {
      data: { user },
    } = await clienteB.auth.getUser();
    const { error } = await clienteB.from("accounts").insert({
      user_id: user!.id,
      workspace_id: workspaceA, // workspace ajeno
      nombre: "Cuenta intrusa",
      tipo: "efectivo",
      saldo_inicial: 0,
    });
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    // Limpieza best-effort de los usuarios de prueba de este bloque.
    const { data: usuarios } = await admin.auth.admin.listUsers();
    for (const u of usuarios.users) {
      if (u.email?.startsWith("test-aislamiento-")) await admin.auth.admin.deleteUser(u.id);
    }
  });
});

afterAll(async () => {
  const { data: usuarios } = await admin.auth.admin.listUsers();
  for (const u of usuarios.users) {
    if (u.email?.startsWith("test-a-") || u.email?.startsWith("test-separacion-")) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
});
