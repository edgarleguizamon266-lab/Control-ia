"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { subirComprobante } from "@/lib/supabase/comprobantes";
import { useWorkspace } from "@/lib/workspace-context";
import { parseMoneyInput, formatMoney } from "@/lib/utils/currency";

type Cuenta = { id: string; nombre: string };
type Categoria = { id: string; nombre: string };
type Extraido = {
  comercio: string | null;
  monto: number | null;
  fecha: string | null;
  categoria_sugerida: string | null;
  numero_operacion: string | null;
  confianza: "alta" | "media" | "baja";
};

export default function NuevoMovimientoPage() {
  return (
    <Suspense fallback={<div className="text-sm text-black/40">Cargando...</div>}>
      <NuevoMovimientoForm />
    </Suspense>
  );
}

function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function NuevoMovimientoForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { workspaceActual, seleccion } = useWorkspace();

  const [tipo, setTipo] = useState<"gasto" | "ingreso">(params.get("tipo") === "ingreso" ? "ingreso" : "gasto");
  const [monto, setMonto] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteHash, setComprobanteHash] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [extraido, setExtraido] = useState<Extraido | null>(null);
  const [posibleDuplicado, setPosibleDuplicado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

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

  async function analizarComprobante(file: File) {
    setAnalizando(true);
    setExtraido(null);
    try {
      const base64 = await archivoABase64(file);
      const res = await fetch("/api/ia/comprobante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen_base64: base64, media_type: file.type }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setExtraido(data.extraido);
      setPosibleDuplicado(Boolean(data.posible_duplicado));
      setComprobanteHash(data.comprobante_hash);

      // Prellenar SOLO como sugerencia editable — nunca se registra ciegamente (sección 38).
      if (data.extraido.monto) setMonto(Math.round(data.extraido.monto));
      if (data.extraido.fecha) setFecha(data.extraido.fecha);
      if (data.extraido.comercio) setDescripcion(data.extraido.comercio);
      if (data.extraido.categoria_sugerida) {
        const match = categorias.find((c) => c.nombre.toLowerCase().includes(String(data.extraido.categoria_sugerida).toLowerCase()));
        if (match) setCategoriaId(match.id);
      }
    } catch {
      setError("No se pudo analizar el comprobante. Podés completar los datos manualmente.");
    } finally {
      setAnalizando(false);
    }
  }

  function onArchivoSeleccionado(file: File | null) {
    setComprobante(file);
    setExtraido(null);
    setComprobanteHash(null);
    if (file && file.type.startsWith("image/")) {
      analizarComprobante(file);
    }
  }

  async function guardar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!workspaceActual) return;
    setError(null);

    if (!monto || !cuentaId || !categoriaId) {
      setError("Completá monto, categoría y cuenta.");
      return;
    }

    setGuardando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let comprobante_url: string | null = null;
    if (comprobante && user) {
      comprobante_url = await subirComprobante(supabase, user.id, comprobante);
    }

    const { error: errInsert } = await supabase.from("transactions").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      account_id: cuentaId,
      category_id: categoriaId,
      tipo,
      monto,
      fecha,
      descripcion: descripcion || null,
      comprobante_url,
      comprobante_hash: comprobanteHash,
      origen: comprobante ? "comprobante" : "manual",
    });

    setGuardando(false);

    if (errInsert) {
      setError("No se pudo guardar el movimiento. Intentá de nuevo.");
      return;
    }

    setExito(true);
    setTimeout(() => router.push("/dashboard"), 900);
  }

  if (seleccion === "todos") {
    return (
      <div className="card p-6 text-black/60 text-sm">
        Elegí "Personal" o "Negocio" arriba para registrar un movimiento en ese espacio.
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="card p-6">
        <h1 className="text-lg font-semibold mb-5">Registrar movimiento</h1>

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
            <label className="text-sm font-medium mb-1 block">Comprobante (opcional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => onArchivoSeleccionado(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {analizando && (
              <p className="text-xs text-brand-600 mt-1 flex items-center gap-1">
                <Sparkles size={12} /> Analizando comprobante...
              </p>
            )}
            {extraido && !analizando && (
              <div className="mt-2 text-xs bg-brand-100 text-brand-800 rounded-lg p-2">
                <div className="font-medium flex items-center gap-1">
                  <Sparkles size={12} /> CONTROL IA detectó estos datos — revisalos antes de guardar
                </div>
                <div>Confianza: {extraido.confianza}</div>
                {extraido.numero_operacion && <div>Operación: {extraido.numero_operacion}</div>}
              </div>
            )}
            {posibleDuplicado && (
              <p className="text-xs text-amber-600 mt-1">⚠️ Este comprobante podría haber sido registrado anteriormente.</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <input
              className="input text-lg"
              inputMode="numeric"
              placeholder="Gs. 0"
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
            {cuentas.length === 0 && <p className="text-xs text-black/40 mt-1">No tenés cuentas todavía. Creá una en "Cuentas".</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Descripción (opcional)</label>
            <input
              className="input"
              placeholder="Ej. Supermercado, ANDE..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {exito && <p className="text-sm text-brand-600">Movimiento guardado ✅</p>}

          <button onClick={guardar} disabled={guardando} className="btn-primary mt-2">
            {guardando ? "Guardando..." : "Confirmar y registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
