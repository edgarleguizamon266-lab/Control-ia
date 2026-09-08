"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import { getBudgetUsage, type UsoPresupuesto } from "@/lib/financial-engine";

type Categoria = { id: string; nombre: string };

export default function PresupuestosPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda } = useWorkspace();
  const [presupuestos, setPresupuestos] = useState<UsoPresupuesto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [monto, setMonto] = useState(0);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const [usos, { data: cats }] = await Promise.all([
      getBudgetUsage(supabase, workspaceActual.id),
      supabase.from("transaction_categories").select("id, nombre").eq("workspace_tipo", workspaceActual.tipo).eq("tipo", "gasto"),
    ]);
    setPresupuestos(usos);
    setCategorias(cats ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!workspaceActual || !categoriaId || !monto) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("budgets").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      category_id: categoriaId,
      monto_limite: monto,
    });

    setCategoriaId("");
    setMonto(0);
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus presupuestos.</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-lg font-semibold">Presupuestos</h1>

      <div className="flex flex-col gap-3">
        {presupuestos.length === 0 && (
          <div className="card p-6 text-sm text-black/40 text-center">Todavía no creaste presupuestos.</div>
        )}
        {presupuestos.map((p) => {
          const porcentaje = Math.min(100, Math.round((p.gastado / Number(p.limite)) * 100));
          return (
            <div key={p.budget_id} className="card p-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{p.categoria}</span>
                <span className="text-black/50">
                  {formatMoney(p.gastado, moneda)} / {formatMoney(p.limite, moneda)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${porcentaje >= 90 ? "bg-red-500" : "bg-brand-500"}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <div className="text-xs text-black/40 mt-1">{porcentaje}%</div>
              {porcentaje >= 80 && (
                <div className="text-xs text-amber-600 mt-1">
                  ⚠️ Ya utilizaste el {porcentaje}% de tu presupuesto de {p.categoria?.toLowerCase()}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary">
          <Plus size={16} /> Nuevo presupuesto
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Seleccionar categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Monto límite mensual"
            value={monto ? formatMoney(monto, moneda) : ""}
            onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
          />
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
