"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";

type Mov = {
  id: string;
  tipo: "gasto" | "ingreso" | "transferencia";
  monto: number;
  fecha: string;
  transaction_categories: { nombre: string } | null;
};

function etiquetaFecha(fecha: string) {
  const hoy = new Date().toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (fecha === hoy) return "Hoy";
  if (fecha === ayer) return "Ayer";
  return new Date(fecha).toLocaleDateString("es-PY", { day: "numeric", month: "short" });
}

// Sección 13 de la auditoría de UX: confirmar de un vistazo que lo
// que se acaba de registrar realmente se guardó.
export default function UltimosMovimientos({ refreshKey }: { refreshKey: number }) {
  const supabase = createClient();
  const { workspaceActual, workspaces, seleccion, moneda, mostrarSaldos } = useWorkspace();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const ids = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (ids.length === 0) {
      setCargando(false);
      return;
    }
    (async () => {
      setCargando(true);
      const { data } = await supabase
        .from("transactions")
        .select("id, tipo, monto, fecha, transaction_categories(nombre)")
        .in("workspace_id", ids)
        .order("created_at", { ascending: false })
        .limit(5);
      setMovs((data as unknown as Mov[]) ?? []);
      setCargando(false);
    })();
  }, [workspaceActual, workspaces, seleccion, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return null;
  if (movs.length === 0) return null; // el empty state general ya lo cubre el dashboard

  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-medium text-sm">Últimos movimientos</span>
        <Link href="/dashboard/movimientos" className="text-xs text-brand-600 font-medium">Ver todos</Link>
      </div>
      <div className="divide-y divide-black/5">
        {movs.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{m.tipo === "transferencia" ? "Transferencia" : m.transaction_categories?.nombre ?? "Sin categoría"}</div>
              <div className="text-xs text-black/40">{etiquetaFecha(m.fecha)}</div>
            </div>
            <div className={`text-sm font-medium ${m.tipo === "ingreso" ? "text-brand-600" : m.tipo === "gasto" ? "text-red-500" : "text-black/60"}`}>
              {m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "-" : ""}
              {formatMoney(m.monto, moneda, !mostrarSaldos)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
