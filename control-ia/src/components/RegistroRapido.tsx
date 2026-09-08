"use client";

import { hoyParaguay } from "@/lib/utils/fecha";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Cuenta = { id: string; nombre: string };
type Categoria = { id: string; nombre: string };

// Registro Rápido — sección 9 de la auditoría de UX.
// Objetivo: un gasto habitual se registra en 3 acciones — monto,
// categoría/cuenta, guardar. Todo lo demás (fecha, descripción,
// comprobante) queda oculto bajo "Agregar detalles".
export default function RegistroRapido({ onGuardado }: { onGuardado: () => void }) {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda } = useWorkspace();

  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [monto, setMonto] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [fecha, setFecha] = useState(() => hoyParaguay());
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{ monto: number; categoria: string; cuenta: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceActual) return;
    (async () => {
      const [{ data: cta }, { data: cat }] = await Promise.all([
        supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceActual.id).eq("activa", true),
        supabase.from("transaction_categories").select("id, nombre").eq("tipo", tipo).eq("workspace_tipo", workspaceActual.tipo),
      ]);
      setCuentas(cta ?? []);
      setCategorias(cat ?? []);
      // Preseleccionar cuenta única automáticamente (menos fricción).
      if (cta && cta.length === 1) setCuentaId(cta[0].id);
    })();
  }, [workspaceActual, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!workspaceActual || guardando) return;
    setError(null);

    if (!monto || !categoriaId || !cuentaId) {
      setError("Completá el monto, la categoría y la cuenta.");
      return;
    }

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: errInsert } = await supabase.from("transactions").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      account_id: cuentaId,
      category_id: categoriaId,
      tipo,
      monto,
      fecha,
      descripcion: descripcion || null,
      origen: "manual",
    });

    setGuardando(false);

    if (errInsert) {
      setError("No se pudo guardar. Probá de nuevo.");
      return;
    }

    const categoria = categorias.find((c) => c.id === categoriaId)?.nombre ?? "";
    const cuenta = cuentas.find((c) => c.id === cuentaId)?.nombre ?? "";
    setConfirmacion({ monto, categoria, cuenta });

    // Reset — listo para el próximo registro sin recargar la página.
    setMonto(0);
    setDescripcion("");
    setMostrarDetalles(false);
    onGuardado();
    setTimeout(() => setConfirmacion(null), 3500);
  }

  if (seleccion === "todos") return null; // el registro rápido necesita un espacio concreto (Personal o Negocio)
  if (!workspaceActual) return null;

  return (
    <div className="card p-4">
      <div className="font-medium text-sm mb-3">Registrar movimiento</div>

      {confirmacion && (
        <div className="mb-3 text-sm bg-brand-100 text-brand-800 rounded-lg p-3">
          ✅ {tipo === "gasto" ? "Gasto" : "Ingreso"} registrado — {formatMoney(confirmacion.monto, moneda)} · {confirmacion.categoria} · {confirmacion.cuenta}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => { setTipo("gasto"); setCategoriaId(""); }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tipo === "gasto" ? "bg-red-500 text-white" : "bg-black/5 text-black/60"}`}
        >
          − Gasto
        </button>
        <button
          onClick={() => { setTipo("ingreso"); setCategoriaId(""); }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tipo === "ingreso" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}
        >
          + Ingreso
        </button>
      </div>

      <input
        className="input text-2xl font-semibold text-center mb-3"
        inputMode="numeric"
        placeholder="Gs. 0"
        value={monto ? formatMoney(monto, moneda) : ""}
        onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
      />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <select className="input text-sm" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select className="input text-sm" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">Cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {cuentas.length === 0 && <p className="text-xs text-amber-600 mb-3">Todavía no tenés cuentas. Se te creó "Efectivo" automáticamente — si no la ves, recargá la página.</p>}

      <button onClick={() => setMostrarDetalles((v) => !v)} className="flex items-center gap-1 text-xs text-black/40 mb-3">
        {mostrarDetalles ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Agregar detalles
      </button>

      {mostrarDetalles && (
        <div className="flex flex-col gap-2 mb-3">
          <input type="date" className="input text-sm" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <input className="input text-sm" placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button onClick={guardar} disabled={guardando} className="btn-primary w-full">
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
