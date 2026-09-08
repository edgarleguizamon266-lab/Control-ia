"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Plan = { id: string; nombre: string; precio_mensual: number; limite_operaciones_ia: number };

export default function AdminPlanesPage() {
  const supabase = createClient();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState(0);
  const [limiteIA, setLimiteIA] = useState(500);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.from("subscription_plans").select("id, nombre, precio_mensual, limite_operaciones_ia").order("precio_mensual");
    setPlanes(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agregar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!nombre || !precio) return;
    setGuardando(true);
    await supabase.from("subscription_plans").insert({ nombre, precio_mensual: precio, limite_operaciones_ia: limiteIA });
    setNombre("");
    setPrecio(0);
    setLimiteIA(500);
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function actualizarPrecio(plan: Plan, nuevoPrecio: number) {
    await supabase.from("subscription_plans").update({ precio_mensual: nuevoPrecio }).eq("id", plan.id);
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este plan?")) return;
    await supabase.from("subscription_plans").delete().eq("id", id);
    cargar();
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Planes</h1>
      <p className="text-sm text-black/50">Editables sin tocar código, como pide la especificación (sección 53).</p>

      <div className="flex flex-col gap-3">
        {planes.map((p) => (
          <div key={p.id} className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.nombre}</div>
              <div className="text-xs text-black/40">{p.limite_operaciones_ia} operaciones de IA/mes</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="input w-32 text-sm"
                value={formatMoney(p.precio_mensual)}
                onChange={(e) => actualizarPrecio(p, parseMoneyInput(e.target.value))}
              />
              <button className="text-xs text-red-500" onClick={() => eliminar(p.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary w-fit">
          <Plus size={16} /> Nuevo plan
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3 max-w-sm">
          <input className="input" placeholder="Nombre (ej. CONTROL IA Pro)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="input" placeholder="Precio mensual" value={precio ? formatMoney(precio) : ""} onChange={(e) => setPrecio(parseMoneyInput(e.target.value))} />
          <input className="input" type="number" placeholder="Límite operaciones IA/mes" value={limiteIA} onChange={(e) => setLimiteIA(Number(e.target.value))} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn-primary flex-1" disabled={guardando} onClick={agregar}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
