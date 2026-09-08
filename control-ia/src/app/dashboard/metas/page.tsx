"use client";

import { useEffect, useState } from "react";
import { Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Meta = { id: string; nombre: string; monto_objetivo: number; monto_ahorrado: number; fecha_limite: string | null };

export default function MetasPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda, mostrarSaldos } = useWorkspace();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState(0);
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const { data } = await supabase
      .from("goals")
      .select("id, nombre, monto_objetivo, monto_ahorrado, fecha_limite")
      .eq("workspace_id", workspaceActual.id)
      .order("created_at", { ascending: false });
    setMetas(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!workspaceActual || !nombre || !objetivo) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("goals").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      nombre,
      monto_objetivo: objetivo,
      fecha_limite: fecha || null,
    });

    setNombre("");
    setObjetivo(0);
    setFecha("");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function agregarAhorro(meta: Meta, monto: number) {
    await supabase
      .from("goals")
      .update({ monto_ahorrado: Number(meta.monto_ahorrado) + monto })
      .eq("id", meta.id);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus metas.</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-lg font-semibold">Metas</h1>

      <div className="flex flex-col gap-3">
        {metas.length === 0 && <div className="card p-6 text-sm text-black/40 text-center">Todavía no creaste ninguna meta.</div>}
        {metas.map((m) => {
          const porcentaje = Math.min(100, Math.round((Number(m.monto_ahorrado) / Number(m.monto_objetivo)) * 100));
          return (
            <div key={m.id} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target size={16} className="text-brand-600" />
                <span className="font-medium text-sm">{m.nombre}</span>
              </div>
              <div className="text-sm text-black/50 mb-2">
                {formatMoney(m.monto_ahorrado, moneda, !mostrarSaldos)} / {formatMoney(m.monto_objetivo, moneda, !mostrarSaldos)}
                {m.fecha_limite && ` · ${new Date(m.fecha_limite).toLocaleDateString("es-PY")}`}
              </div>
              <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden mb-2">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${porcentaje}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-black/40">{porcentaje}%</span>
                <button
                  className="text-xs text-brand-600 font-medium"
                  onClick={() => {
                    const valor = prompt("¿Cuánto querés agregar a esta meta?");
                    const monto = valor ? parseMoneyInput(valor) : 0;
                    if (monto > 0) agregarAhorro(m, monto);
                  }}
                >
                  + Agregar ahorro
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary">
          <Plus size={16} /> Nueva meta
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <input className="input" placeholder="Nombre (ej. Comprar notebook)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input
            className="input"
            placeholder="Monto objetivo"
            value={objetivo ? formatMoney(objetivo, moneda) : ""}
            onChange={(e) => setObjetivo(parseMoneyInput(e.target.value))}
          />
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn-primary flex-1" disabled={guardando} onClick={agregar}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
