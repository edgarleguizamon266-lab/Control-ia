"use client";

import { useEffect, useState } from "react";
import { Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import ModalMontoCuenta from "@/components/ModalMontoCuenta";

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
  const [metaOperacion, setMetaOperacion] = useState<{ meta: Meta; tipo: "aportar" | "retirar" } | null>(null);

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

  // Fase 3.7: aportar/retirar ahora mueve dinero real de/hacia una cuenta —
  // antes "monto_ahorrado" era un número que se inflaba solo, sin respaldo real.
  async function confirmarOperacion(monto: number, cuentaId: string) {
    if (!metaOperacion) return;
    const fn = metaOperacion.tipo === "aportar" ? "fn_aportar_meta" : "fn_retirar_meta";
    const { error } = await supabase.rpc(fn, { p_goal_id: metaOperacion.meta.id, p_monto: monto, p_account_id: cuentaId });
    if (error) throw new Error(error.message);
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
                <div className="flex gap-3">
                  {Number(m.monto_ahorrado) > 0 && (
                    <button className="text-xs text-black/50 font-medium" onClick={() => setMetaOperacion({ meta: m, tipo: "retirar" })}>
                      Retirar
                    </button>
                  )}
                  <button className="text-xs text-brand-600 font-medium" onClick={() => setMetaOperacion({ meta: m, tipo: "aportar" })}>
                    + Aportar
                  </button>
                </div>
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

      {metaOperacion && workspaceActual && (
        <ModalMontoCuenta
          titulo={`${metaOperacion.tipo === "aportar" ? "Aportar a" : "Retirar de"} — ${metaOperacion.meta.nombre}`}
          workspaceId={workspaceActual.id}
          montoMaximo={metaOperacion.tipo === "retirar" ? Number(metaOperacion.meta.monto_ahorrado) : undefined}
          textoBoton={metaOperacion.tipo === "aportar" ? "Aportar" : "Retirar"}
          onConfirmar={confirmarOperacion}
          onCerrar={() => setMetaOperacion(null)}
        />
      )}
    </div>
  );
}
