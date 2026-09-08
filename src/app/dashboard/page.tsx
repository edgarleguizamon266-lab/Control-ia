"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, MessageSquareText, BarChart3, LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import SummaryCard from "@/components/SummaryCard";
import RegistroRapido from "@/components/RegistroRapido";
import UltimosMovimientos from "@/components/UltimosMovimientos";
import {
  getPeriodReport,
  getPeriodReportMulti,
  getMonthlySeries,
  getMonthlySeriesMulti,
  getWorkspaceBalance,
  getTotalBalance,
  primerYUltimoDiaDelMes,
  type SerieMensual,
} from "@/lib/financial-engine";

const COLORES = ["#1f9d5f", "#34c777", "#0f4d3f", "#16794f", "#062a24", "#6bdba0"];
const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DashboardPage() {
  const supabase = createClient();
  const { seleccion, workspaceActual, workspaces, moneda, cargando: cargandoWorkspace } = useWorkspace();
  const [ingresosMes, setIngresosMes] = useState(0);
  const [gastosMes, setGastosMes] = useState(0);
  const [gastosPorCategoriaObj, setGastosPorCategoriaObj] = useState<Record<string, number>>({});
  const [serieMensual, setSerieMensual] = useState<SerieMensual[]>([]);
  const [disponible, setDisponible] = useState(0);
  const [movimientosDelMes, setMovimientosDelMes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (cargandoWorkspace) return;
    if (seleccion !== "todos" && !workspaceActual) {
      setCargando(false);
      return;
    }

    const workspaceIds = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (workspaceIds.length === 0) {
      setCargando(false);
      return;
    }

    (async () => {
      setCargando(true);
      const { desde, hasta } = primerYUltimoDiaDelMes();
      const anioActual = new Date().getFullYear();

      const [reporte, saldo, serie, { count }] = await Promise.all([
        seleccion === "todos" ? getPeriodReportMulti(supabase, workspaceIds, desde, hasta) : getPeriodReport(supabase, workspaceIds[0], desde, hasta),
        seleccion === "todos" ? getTotalBalance(supabase, workspaceIds) : getWorkspaceBalance(supabase, workspaceIds[0]),
        seleccion === "todos" ? getMonthlySeriesMulti(supabase, workspaceIds, anioActual) : getMonthlySeries(supabase, workspaceIds[0], anioActual),
        supabase.from("transactions").select("id", { count: "exact", head: true }).in("workspace_id", workspaceIds).gte("fecha", desde).lte("fecha", hasta),
      ]);

      setIngresosMes(reporte.ingresos);
      setGastosMes(reporte.gastos);
      setGastosPorCategoriaObj(reporte.gastos_por_categoria);
      setDisponible(saldo);
      setSerieMensual(serie);
      setMovimientosDelMes(count ?? 0);
      setCargando(false);
    })();
  }, [seleccion, workspaceActual, workspaces, cargandoWorkspace, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { movsPorMes, gastosPorCategoria } = useMemo(() => {
    const mesActual = new Date().getMonth();
    const movsPorMes = Array.from({ length: mesActual + 1 }, (_, i) => {
      const punto = serieMensual.find((s) => s.mes === i + 1);
      return { mes: NOMBRES_MES[i], Ingresos: punto?.ingresos ?? 0, Gastos: punto?.gastos ?? 0 };
    });

    const gastosPorCategoria = Object.entries(gastosPorCategoriaObj)
      .map(([nombre, valor]) => ({ nombre, valor }))
      .sort((a, b) => b.valor - a.valor);

    return { movsPorMes, gastosPorCategoria };
  }, [serieMensual, gastosPorCategoriaObj]);

  if (cargando) {
    return <div className="text-black/40 text-sm">Cargando tu resumen...</div>;
  }

  if (seleccion !== "todos" && !workspaceActual) {
    return (
      <div className="card p-8 text-center text-black/60">
        Todavía no configuraste este espacio de trabajo.
      </div>
    );
  }

  const hayMovimientosEsteMes = movimientosDelMes > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Resumen financiero compacto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard titulo="Ingresos este mes" monto={ingresosMes} moneda={moneda} colorTexto="text-brand-600" />
        <SummaryCard titulo="Gastos este mes" monto={gastosMes} moneda={moneda} colorTexto="text-red-500" />
        <SummaryCard titulo="Disponible" monto={disponible} moneda={moneda} />
        <SummaryCard titulo="Movimientos este mes" monto={movimientosDelMes} esCantidad />
      </div>

      {/* 2. Registro rápido */}
      <RegistroRapido onGuardado={() => setRefreshKey((k) => k + 1)} />

      {/* 3. Últimos movimientos */}
      <UltimosMovimientos refreshKey={refreshKey} />

      {/* 4. Acciones adicionales (compactas) */}
      <div className="grid grid-cols-3 gap-3">
        <AccionRapida href="/dashboard/movimientos/nuevo?comprobante=1" icon={Camera} label="Comprobante" />
        <AccionRapida href="/dashboard/ia" icon={MessageSquareText} label="Preguntar a la IA" />
        <AccionRapida href="/dashboard/reportes" icon={BarChart3} label="Reportes" />
      </div>

      {/* 5. Gráficos — solo si hay datos este mes; si no, empty state compacto */}
      {!hayMovimientosEsteMes ? (
        <div className="card p-6 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-black/50">Todavía no registraste movimientos este mes.</p>
          <p className="text-xs text-black/30">Usá el Registro rápido de arriba para cargar tu primer gasto o ingreso.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="font-medium mb-4">Ingresos vs. Gastos</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movsPorMes}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatMoney(v, moneda)} />
                <Bar dataKey="Ingresos" fill="#34c777" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <div className="font-medium mb-4">Gastos por categoría (este mes)</div>
            {gastosPorCategoria.length === 0 ? (
              <div className="text-sm text-black/40 h-[220px] flex items-center justify-center">Sin gastos este mes.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={gastosPorCategoria} dataKey="valor" nameKey="nombre" innerRadius={55} outerRadius={80}>
                    {gastosPorCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, moneda)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccionRapida({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="card p-3 flex flex-col items-center gap-1.5 text-center hover:border-brand-500 border border-transparent transition">
      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
        <Icon size={18} />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
