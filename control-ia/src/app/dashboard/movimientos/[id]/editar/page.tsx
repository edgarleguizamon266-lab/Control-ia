"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { parseMoneyInput, formatMoney } from "@/lib/utils/currency";

type Cuenta = { id: string; nombre: string };
type Categoria = { id: string; nombre: string };

export default function EditarMovimientoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { workspaceActual } = useWorkspace();

  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [monto, setMonto] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: mov } = await supabase
        .from("transactions")
        .select("tipo, monto, category_id, account_id, fecha, descripcion")
        .eq("id", params.id)
        .single();

      if (mov) {
        setTipo(mov.tipo as "gasto" | "ingreso");
        setMonto(Number(mov.monto));
        setCategoriaId(mov.category_id ?? "");
        setCuentaId(mov.account_id ?? "");
        setFecha(mov.fecha);
        setDescripcion(mov.descripcion ?? "");
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!workspaceActual) return;
    (async () => {
      const [{ data: cta }, { data: cat }] = await Promise.all([
        supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceActual.id).eq("activa", true),
        supabase.from("transaction_categories").select("id, nombre").eq("tipo", tipo).eq("workspace_tipo", workspaceActual.tipo),
      ]);
      setCuentas(cta ?? []);
      setCategorias(cat ?? []);
    })();
  }, [workspaceActual, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    setError(null);
    if (!monto || !cuentaId || !categoriaId) {
      setError("Completá monto, categoría y cuenta.");
      return;
    }
    setGuardando(true);

    const { error: errUpdate } = await supabase
      .from("transactions")
      .update({
        tipo,
        monto,
        category_id: categoriaId,
        account_id: cuentaId,
        fecha,
        descripcion: descripcion || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    setGuardando(false);
    if (errUpdate) {
      setError("No se pudo actualizar el movimiento.");
      return;
    }
    setExito(true);
    setTimeout(() => router.push("/dashboard/movimientos"), 800);
  }

  if (cargando) return <div className="text-sm text-black/40">Cargando...</div>;

  return (
    <div className="max-w-lg">
      <div className="card p-6">
        <h1 className="text-lg font-semibold mb-5">Editar movimiento</h1>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTipo("gasto")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tipo === "gasto" ? "bg-red-500 text-white" : "bg-black/5 text-black/60"}`}
          >
            Gasto
          </button>
          <button
            onClick={() => setTipo("ingreso")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tipo === "ingreso" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}
          >
            Ingreso
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <input
              className="input text-lg"
              value={monto ? formatMoney(monto) : ""}
              onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Categoría</label>
            <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Seleccionar categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Cuenta</label>
            <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Descripción (opcional)</label>
            <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {exito && <p className="text-sm text-brand-600">Movimiento actualizado ✅</p>}

          <div className="flex gap-2 mt-2">
            <button className="btn-secondary flex-1" onClick={() => router.push("/dashboard/movimientos")}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="btn-primary flex-1">
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
