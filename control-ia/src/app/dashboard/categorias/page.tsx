"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

type Categoria = { id: string; nombre: string; tipo: "gasto" | "ingreso"; es_sistema: boolean };

export default function CategoriasPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion } = useWorkspace();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const { data } = await supabase
      .from("transaction_categories")
      .select("id, nombre, tipo, es_sistema")
      .eq("workspace_tipo", workspaceActual.tipo)
      .order("tipo");
    setCategorias(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregar() {
    if (!workspaceActual || !nombre) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("transaction_categories").insert({
      user_id: user?.id,
      workspace_tipo: workspaceActual.tipo,
      nombre,
      tipo,
    });
    setNombre("");
    setGuardando(false);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus categorías.</div>;
  }

  const gastos = categorias.filter((c) => c.tipo === "gasto");
  const ingresos = categorias.filter((c) => c.tipo === "ingreso");

  return (
    <div className="max-w-lg flex flex-col gap-5">
      <h1 className="text-lg font-semibold">Categorías</h1>

      <div className="card p-4">
        <div className="font-medium text-sm mb-2">Gastos</div>
        <div className="flex flex-wrap gap-2">
          {gastos.map((c) => (
            <span key={c.id} className="text-xs bg-brand-100 text-brand-800 rounded-full px-3 py-1">{c.nombre}</span>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-medium text-sm mb-2">Ingresos</div>
        <div className="flex flex-wrap gap-2">
          {ingresos.map((c) => (
            <span key={c.id} className="text-xs bg-brand-100 text-brand-800 rounded-full px-3 py-1">{c.nombre}</span>
          ))}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="font-medium text-sm">Agregar categoría propia</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select className="input w-32" value={tipo} onChange={(e) => setTipo(e.target.value as "gasto" | "ingreso")}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </div>
        <button className="btn-secondary" disabled={guardando} onClick={agregar}>
          <Plus size={16} /> Agregar
        </button>
      </div>
    </div>
  );
}
