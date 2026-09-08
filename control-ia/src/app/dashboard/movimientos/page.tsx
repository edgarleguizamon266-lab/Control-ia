"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeftRight, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import { getMovimientosEnriquecidos, type MovimientoEnriquecido } from "@/lib/financial-engine";
import { tituloYSubtitulo } from "@/components/UltimosMovimientos";
import ModalDetalleMovimiento from "@/components/ModalDetalleMovimiento";

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
  const router = useRouter();
  const { workspaceActual, workspaces, seleccion, moneda, mostrarSaldos, cargando: cargandoWs } = useWorkspace();
  const [movs, setMovs] = useState<MovimientoEnriquecido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<MovimientoEnriquecido | null>(null);

  async function cargar() {
    const ids = seleccion === "todos" ? workspaces.map((w) => w.id) : workspaceActual ? [workspaceActual.id] : [];
    if (ids.length === 0) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await getMovimientosEnriquecidos(supabase, ids, 150);
      setMovs(data);
    } catch (e) {
      // Nunca disfrazar un error real de base de datos como "no hay movimientos".
      console.error("[movimientos] Error al cargar:", e);
      setErrorCarga("No se pudieron cargar tus movimientos. Probá recargar la página.");
      setMovs([]);
    }
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
    setDetalle(null);
    cargar();
  }

  const movsFiltrados = movs.filter((m) => {
    if (filtro !== "todos" && m.tipo !== filtro) return false;
    if (busqueda) {
      const texto = `${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.cuenta ?? ""} ${m.deuda_persona ?? ""} ${m.deuda_nombre ?? ""}`.toLowerCase();
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
          placeholder="Buscar por categoría, cuenta, persona..."
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
        {movsFiltrados.map((m) => {
          const { titulo, subtitulo } = tituloYSubtitulo(m);
          return (
            <button
              key={m.id}
              onClick={() => setDetalle(m)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/[0.02] transition"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{titulo}</div>
                <div className="text-xs text-black/40 truncate">{subtitulo}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className={`font-medium text-sm ${m.tipo === "ingreso" ? "text-brand-600" : m.tipo === "gasto" ? "text-red-500" : "text-black/60"}`}>
                  {m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "-" : ""}
                  {formatMoney(m.monto, moneda, !mostrarSaldos)}
                </span>
                <ChevronRight size={16} className="text-black/20" />
              </div>
            </button>
          );
        })}
      </div>

      {detalle && (
        <ModalDetalleMovimiento
          mov={detalle}
          onCerrar={() => setDetalle(null)}
          onEditar={
            !detalle.es_pago_deuda && detalle.tipo !== "transferencia"
              ? () => router.push(`/dashboard/movimientos/${detalle.id}/editar`)
              : undefined
          }
          onEliminar={!detalle.es_pago_deuda ? () => eliminar(detalle.id) : undefined}
        />
      )}
    </div>
  );
}
