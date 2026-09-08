"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";

type Mov = {
  id: string;
  tipo: "gasto" | "ingreso" | "transferencia";
  monto: number;
  fecha: string;
  descripcion: string | null;
  transaction_categories: { nombre: string } | null;
  accounts: { nombre: string } | null;
};

type Filtro = "todos" | "ingreso" | "gasto" | "transferencia";

// Sección "Nivel Alto 5": el empty state debe reflejar el filtro activo, no un mensaje genérico.
const EMPTY_STATE: Record<Filtro, { mensaje: string; boton: string; href: string }> = {
  todos: { mensaje: "Todavía no registraste movimientos.", boton: "Nuevo movimiento", href: "/dashboard/movimientos/nuevo" },
  ingreso: { mensaje: "Todavía no registraste ingresos.", boton: "Registrar ingreso", href: "/dashboard/movimientos/nuevo?tipo=ingreso" },
  gasto: { mensaje: "Todavía no registraste gastos.", boton: "Registrar gasto", href: "/dashboard/movimientos/nuevo?tipo=gasto" },
  transferencia: { mensaje: "Todavía no realizaste transferencias.", boton: "Realizar transferencia", href: "/dashboard/movimientos/transferencia" },
};

export default function MovimientosPage() {
  const supabase = createClient();
  const { workspaceActual, workspaces, seleccion, moneda, mostrarSaldos, cargando: cargandoWs } = useWorkspace();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    const ids = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (ids.length === 0) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    const { data, error } = await supabase
      .from("transactions")
      .select("id, tipo, monto, fecha, descripcion, transaction_categories(nombre), accounts!account_id(nombre)")
      .in("workspace_id", ids)
      .order("fecha", { ascending: false })
      .limit(150);

    if (error) {
      // Nunca disfrazar un error real de base de datos como "no hay movimientos" —
      // eso fue exactamente la causa del bug Dashboard-vs-Movimientos.
      console.error("[movimientos] Error al cargar:", error);
      setErrorCarga("No se pudieron cargar tus movimientos. Probá recargar la página.");
      setMovs([]);
      setCargando(false);
      return;
    }

    setMovs((data as unknown as Mov[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    if (cargandoWs) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual, workspaces, seleccion, cargandoWs]);

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) return;
    await supabase.from("transactions").delete().eq("id", id);
    cargar();
  }

  const movsFiltrados = movs.filter((m) => {
    if (filtro !== "todos" && m.tipo !== filtro) return false;
    if (busqueda) {
      const texto = `${m.transaction_categories?.nombre ?? ""} ${m.descripcion ?? ""} ${m.accounts?.nombre ?? ""}`.toLowerCase();
      if (!texto.includes(busqueda.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold">Movimientos</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/movimientos/transferencia" className="btn-secondary text-sm">
            <ArrowLeftRight size={16} /> Transferir
          </Link>
          <Link href="/dashboard/movimientos/nuevo" className="btn-primary text-sm">
            <Plus size={16} /> Nuevo movimiento
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex bg-brand-100 rounded-lg p-1">
          {(["todos", "ingreso", "gasto", "transferencia"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition ${
                filtro === f ? "bg-brand-600 text-white" : "text-brand-800 hover:bg-white/60"
              }`}
            >
              {f === "todos" ? "Todos" : f === "ingreso" ? "Ingresos" : f === "gasto" ? "Gastos" : "Transferencias"}
            </button>
          ))}
        </div>
        <input
          className="input max-w-[220px]"
          placeholder="Buscar por categoría, cuenta..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card divide-y divide-black/5">
        {cargando && <div className="p-4 text-sm text-black/40">Cargando...</div>}
        {!cargando && errorCarga && (
          <div className="p-8 text-center text-sm flex flex-col gap-3 items-center">
            <span className="text-red-600">⚠️ {errorCarga}</span>
            <button onClick={cargar} className="btn-secondary text-sm">Reintentar</button>
          </div>
        )}
        {!cargando && !errorCarga && movsFiltrados.length === 0 && (
          <div className="p-8 text-center text-black/40 text-sm flex flex-col gap-3 items-center">
            {EMPTY_STATE[filtro].mensaje}
            <Link href={EMPTY_STATE[filtro].href} className="btn-primary text-sm w-fit">
              {EMPTY_STATE[filtro].boton}
            </Link>
          </div>
        )}
        {movsFiltrados.map((m) => (
          <div key={m.id} className="group flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-sm">
                {m.tipo === "transferencia" ? "Transferencia" : m.transaction_categories?.nombre ?? "Sin categoría"}
              </div>
              <div className="text-xs text-black/40">
                {new Date(m.fecha).toLocaleDateString("es-PY")} · {m.accounts?.nombre ?? ""}
                {m.descripcion ? ` · ${m.descripcion}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`font-medium text-sm ${m.tipo === "ingreso" ? "text-brand-600" : m.tipo === "gasto" ? "text-red-500" : "text-black/60"}`}>
                {m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "-" : ""}
                {formatMoney(m.monto, moneda, !mostrarSaldos)}
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                {m.tipo !== "transferencia" && (
                  <Link href={`/dashboard/movimientos/${m.id}/editar`} className="p-1.5 text-black/40 hover:text-brand-600" title="Editar">
                    <Pencil size={14} />
                  </Link>
                )}
                <button onClick={() => eliminar(m.id)} className="p-1.5 text-black/40 hover:text-red-500" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
