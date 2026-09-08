"use client";

import { hoyParaguay, fechaParaguay } from "@/lib/utils/fecha";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import { getMovimientosEnriquecidos, type MovimientoEnriquecido } from "@/lib/financial-engine";
import ModalDetalleMovimiento from "@/components/ModalDetalleMovimiento";

function etiquetaFecha(fecha: string) {
  const hoy = hoyParaguay();
  const ayer = fechaParaguay(new Date(Date.now() - 86400000));
  if (fecha === hoy) return "Hoy";
  if (fecha === ayer) return "Ayer";
  return new Date(fecha).toLocaleDateString("es-PY", { day: "numeric", month: "short" });
}

// Título/subtítulo con prioridad: si es un pago de deuda, mostrar quién
// y por qué deuda — nunca solo la categoría genérica "Deudas" (sección
// pedida explícitamente: "nunca preguntarse de qué deuda se trataba").
export function tituloYSubtitulo(m: MovimientoEnriquecido) {
  if (m.es_pago_deuda) {
    const titulo = `${m.deuda_tipo === "yo_debo" ? "Pago de deuda" : "Cobro de deuda"} — ${m.deuda_persona}`;
    const subtitulo = m.deuda_nombre ? `${m.deuda_nombre} · ${etiquetaFecha(m.fecha)}` : etiquetaFecha(m.fecha);
    return { titulo, subtitulo };
  }
  const titulo = m.tipo === "transferencia" ? "Transferencia" : m.categoria ?? "Sin categoría";
  const subtitulo = [etiquetaFecha(m.fecha), m.cuenta, m.descripcion].filter(Boolean).join(" · ");
  return { titulo, subtitulo };
}

export default function UltimosMovimientos({ refreshKey }: { refreshKey: number }) {
  const supabase = createClient();
  const { workspaceActual, workspaces, seleccion, moneda, mostrarSaldos } = useWorkspace();
  const [movs, setMovs] = useState<MovimientoEnriquecido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<MovimientoEnriquecido | null>(null);

  useEffect(() => {
    const ids = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (ids.length === 0) {
      setCargando(false);
      return;
    }
    (async () => {
      setCargando(true);
      const data = await getMovimientosEnriquecidos(supabase, ids, 5);
      setMovs(data);
      setCargando(false);
    })();
  }, [workspaceActual, workspaces, seleccion, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return null;
  if (movs.length === 0) return null;

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-medium text-sm">Últimos movimientos</span>
          <Link href="/dashboard/movimientos" className="text-xs text-brand-600 font-medium">Ver todos</Link>
        </div>
        <div className="divide-y divide-black/5">
          {movs.map((m) => {
            const { titulo, subtitulo } = tituloYSubtitulo(m);
            return (
              <button
                key={m.id}
                onClick={() => setDetalle(m)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] transition"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{titulo}</div>
                  <div className="text-xs text-black/40 truncate">{subtitulo}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <span className={`text-sm font-medium ${m.tipo === "ingreso" ? "text-brand-600" : m.tipo === "gasto" ? "text-red-500" : "text-black/60"}`}>
                    {m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "-" : ""}
                    {formatMoney(m.monto, moneda, !mostrarSaldos)}
                  </span>
                  <ChevronRight size={16} className="text-black/20" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {detalle && <ModalDetalleMovimiento mov={detalle} onCerrar={() => setDetalle(null)} />}
    </>
  );
}
