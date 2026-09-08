import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================
// CONTROL IA — Motor Financiero Central (sección 13)
//
// Única capa que calcula saldos, ingresos, gastos, presupuestos y
// ganancia del negocio. Dashboard, Reportes, Mi Negocio y la IA llaman
// SIEMPRE a estas mismas funciones (que a su vez llaman a las
// funciones SQL de migration_004, la verdadera fuente de cálculo).
//
// Nunca dupliques esta lógica sumando movimientos "a mano" en un
// componente — si falta un dato acá, se agrega acá, no en el componente.
// =========================================================

export type CuentaConSaldo = {
  id: string;
  nombre: string;
  tipo: string;
  moneda: string;
  limite_credito: number | null;
  dia_cierre: number | null;
  dia_vencimiento: number | null;
  institucion: string | null;
  saldo: number;
};

export type ReportePeriodo = {
  ingresos: number;
  gastos: number;
  gastos_por_categoria: Record<string, number>;
};

export type SerieMensual = { mes: number; ingresos: number; gastos: number };
export type UsoPresupuesto = { budget_id: string; category_id: string; categoria: string; limite: number; gastado: number };
export type ResumenNegocio = { ventas: number; costos: number; gastos: number; ganancia_neta: number };
export type TotalesDeuda = { yo_debo: number; me_deben: number };
export type CuentasPorCobrarPagar = { por_cobrar: number; por_pagar: number };

export async function getAccountsWithBalance(supabase: SupabaseClient, workspaceId: string): Promise<CuentaConSaldo[]> {
  const { data, error } = await supabase.rpc("fn_accounts_with_balance", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data ?? [];
}

// "Disponible" = LIQUIDEZ real (efectivo/banco/billetera/débito), nunca
// mezclado con deuda de tarjetas de crédito ni inversiones (Fase 3.1/3.2 —
// bug real confirmado: una tarjeta con deuda restaba directo del efectivo).
export async function getWorkspaceBalance(supabase: SupabaseClient, workspaceId: string): Promise<number> {
  const { data, error } = await supabase.rpc("fn_liquidez_workspace", { p_workspace_id: workspaceId });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Suma el saldo de varios workspaces (para la vista "Todos"). */
export async function getTotalBalance(supabase: SupabaseClient, workspaceIds: string[]): Promise<number> {
  const totales = await Promise.all(workspaceIds.map((id) => getWorkspaceBalance(supabase, id)));
  return totales.reduce((a, b) => a + b, 0);
}

export async function getPeriodReport(supabase: SupabaseClient, workspaceId: string, desde: string, hasta: string): Promise<ReportePeriodo> {
  const { data, error } = await supabase.rpc("fn_period_report", { p_workspace_id: workspaceId, p_desde: desde, p_hasta: hasta }).single();
  if (error) throw error;
  return {
    ingresos: Number((data as any)?.ingresos ?? 0),
    gastos: Number((data as any)?.gastos ?? 0),
    gastos_por_categoria: (data as any)?.gastos_por_categoria ?? {},
  };
}

/** Combina el reporte de varios workspaces sumando ingresos/gastos/categorías (para "Todos"). */
export async function getPeriodReportMulti(supabase: SupabaseClient, workspaceIds: string[], desde: string, hasta: string): Promise<ReportePeriodo> {
  const reportes = await Promise.all(workspaceIds.map((id) => getPeriodReport(supabase, id, desde, hasta)));
  const combinado: ReportePeriodo = { ingresos: 0, gastos: 0, gastos_por_categoria: {} };
  for (const r of reportes) {
    combinado.ingresos += r.ingresos;
    combinado.gastos += r.gastos;
    for (const [cat, monto] of Object.entries(r.gastos_por_categoria)) {
      combinado.gastos_por_categoria[cat] = (combinado.gastos_por_categoria[cat] ?? 0) + Number(monto);
    }
  }
  return combinado;
}

export async function getMonthlySeries(supabase: SupabaseClient, workspaceId: string, anio: number): Promise<SerieMensual[]> {
  const { data, error } = await supabase.rpc("fn_monthly_series", { p_workspace_id: workspaceId, p_anio: anio });
  if (error) throw error;
  return data ?? [];
}

export async function getMonthlySeriesMulti(supabase: SupabaseClient, workspaceIds: string[], anio: number): Promise<SerieMensual[]> {
  const series = await Promise.all(workspaceIds.map((id) => getMonthlySeries(supabase, id, anio)));
  const combinado = new Map<number, SerieMensual>();
  for (const serie of series) {
    for (const punto of serie) {
      const actual = combinado.get(punto.mes) ?? { mes: punto.mes, ingresos: 0, gastos: 0 };
      actual.ingresos += Number(punto.ingresos);
      actual.gastos += Number(punto.gastos);
      combinado.set(punto.mes, actual);
    }
  }
  return Array.from(combinado.values()).sort((a, b) => a.mes - b.mes);
}

export async function getBudgetUsage(supabase: SupabaseClient, workspaceId: string): Promise<UsoPresupuesto[]> {
  const { data, error } = await supabase.rpc("fn_budget_usage", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data ?? [];
}

export async function getBusinessSummary(supabase: SupabaseClient, workspaceId: string, desde: string, hasta: string): Promise<ResumenNegocio> {
  const { data, error } = await supabase.rpc("fn_business_summary", { p_workspace_id: workspaceId, p_desde: desde, p_hasta: hasta }).single();
  if (error) throw error;
  return {
    ventas: Number((data as any)?.ventas ?? 0),
    costos: Number((data as any)?.costos ?? 0),
    gastos: Number((data as any)?.gastos ?? 0),
    ganancia_neta: Number((data as any)?.ganancia_neta ?? 0),
  };
}

export async function getDebtTotals(supabase: SupabaseClient, workspaceId: string): Promise<TotalesDeuda> {
  const { data, error } = await supabase.rpc("fn_debt_totals", { p_workspace_id: workspaceId }).single();
  if (error) throw error;
  return { yo_debo: Number((data as any)?.yo_debo ?? 0), me_deben: Number((data as any)?.me_deben ?? 0) };
}

export async function getBusinessReceivablesPayables(supabase: SupabaseClient, workspaceId: string): Promise<CuentasPorCobrarPagar> {
  const { data, error } = await supabase.rpc("fn_business_receivables_payables", { p_workspace_id: workspaceId }).single();
  if (error) throw error;
  return { por_cobrar: Number((data as any)?.por_cobrar ?? 0), por_pagar: Number((data as any)?.por_pagar ?? 0) };
}

export type TopCliente = { customer_id: string; nombre: string; total: number };
export type TopProveedor = { supplier_id: string; nombre: string; total: number };

export async function getTopClientes(supabase: SupabaseClient, workspaceId: string, desde: string, hasta: string, limite = 5): Promise<TopCliente[]> {
  const { data, error } = await supabase.rpc("fn_top_clientes", { p_workspace_id: workspaceId, p_desde: desde, p_hasta: hasta, p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

export async function getTopProveedores(supabase: SupabaseClient, workspaceId: string, desde: string, hasta: string, limite = 5): Promise<TopProveedor[]> {
  const { data, error } = await supabase.rpc("fn_top_proveedores", { p_workspace_id: workspaceId, p_desde: desde, p_hasta: hasta, p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

export type PatrimonioNeto = {
  liquidez: number;
  inversiones: number;
  deuda_tarjetas: number;
  deudas_pendientes: number;
  patrimonio_neto: number;
};

export async function getPatrimonioNeto(supabase: SupabaseClient, workspaceId: string): Promise<PatrimonioNeto | null> {
  const { data, error } = await supabase.rpc("fn_patrimonio_neto", { p_workspace_id: workspaceId }).maybeSingle();
  if (error) throw error;
  return data as PatrimonioNeto | null;
}

export type MovimientoEnriquecido = {
  id: string;
  tipo: "gasto" | "ingreso" | "transferencia";
  monto: number;
  fecha: string;
  descripcion: string | null;
  origen: string;
  categoria: string | null;
  cuenta: string | null;
  es_pago_deuda: boolean;
  deuda_id: string | null;
  deuda_nombre: string | null;
  deuda_persona: string | null;
  deuda_tipo: "yo_debo" | "me_deben" | null;
  deuda_monto_total: number | null;
  deuda_saldo_pendiente: number | null;
  pago_deuda_monto: number | null;
};

export async function getMovimientosEnriquecidos(supabase: SupabaseClient, workspaceIds: string[], limite = 150): Promise<MovimientoEnriquecido[]> {
  const { data, error } = await supabase.rpc("fn_movimientos_enriquecidos", { p_workspace_ids: workspaceIds, p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

export async function getDeudaPagadoAcumulado(supabase: SupabaseClient, deudaId: string): Promise<number> {
  const { data, error } = await supabase.rpc("fn_deuda_pagado_acumulado", { p_debt_id: deudaId });
  if (error) throw error;
  return Number(data ?? 0);
}

export function primerYUltimoDiaDelMes(fecha = new Date()) {
  const desde = new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString().slice(0, 10);
  const hasta = fecha.toISOString().slice(0, 10);
  return { desde, hasta };
}
