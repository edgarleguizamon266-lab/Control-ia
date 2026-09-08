"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import { getPeriodReport, getPeriodReportMulti, primerYUltimoDiaDelMes, type ReportePeriodo } from "@/lib/financial-engine";

export default function ReportesPage() {
  const supabase = createClient();
  const { workspaceActual, workspaces, seleccion, moneda, cargando: cargandoWs } = useWorkspace();
  const [reporte, setReporte] = useState<ReportePeriodo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (cargandoWs) return;
    const ids = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (ids.length === 0) {
      setCargando(false);
      return;
    }
    (async () => {
      setCargando(true);
      const { desde, hasta } = primerYUltimoDiaDelMes();
      const r = seleccion === "todos" ? await getPeriodReportMulti(supabase, ids, desde, hasta) : await getPeriodReport(supabase, ids[0], desde, hasta);
      setReporte(r);
      setCargando(false);
    })();
  }, [workspaceActual, workspaces, seleccion, cargandoWs]); // eslint-disable-line react-hooks/exhaustive-deps

  const mayoresGastos = useMemo(() => {
    if (!reporte) return [];
    return Object.entries(reporte.gastos_por_categoria)
      .map(([nombre, monto]) => ({ nombre, monto: Number(monto) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [reporte]);

  if (cargando || !reporte) return <div className="text-sm text-black/40">Cargando reportes...</div>;

  const ahorroPorcentaje = reporte.ingresos > 0 ? Math.round(((reporte.ingresos - reporte.gastos) / reporte.ingresos) * 100) : 0;
  const dentroDePresupuesto = reporte.gastos <= reporte.ingresos;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Reportes — este mes</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm text-black/50">Ingresos</div>
          <div className="text-xl font-semibold text-brand-600">{formatMoney(reporte.ingresos, moneda)}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-black/50">Gastos</div>
          <div className="text-xl font-semibold text-red-500">{formatMoney(reporte.gastos, moneda)}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="font-medium mb-3">Tus mayores gastos</div>
        {mayoresGastos.length === 0 && <p className="text-sm text-black/40">Sin gastos registrados este mes.</p>}
        <div className="flex flex-col gap-2">
          {mayoresGastos.map((g, i) => (
            <div key={g.nombre} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                {g.nombre}
              </div>
              <span className="font-medium">{formatMoney(g.monto, moneda)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`card p-5 flex items-center gap-3 ${dentroDePresupuesto ? "" : "border-red-200"}`}>
        <span className="text-xl">{dentroDePresupuesto ? "✅" : "⚠️"}</span>
        <div>
          <div className="font-medium text-sm">{dentroDePresupuesto ? "Tranquilidad" : "Atención"}</div>
          <div className="text-sm text-black/60">
            {dentroDePresupuesto
              ? `Conservaste aproximadamente el ${ahorroPorcentaje}% de tus ingresos este mes. ¡Seguí así!`
              : "Tus gastos superaron tus ingresos este mes."}
          </div>
        </div>
      </div>
    </div>
  );
}
