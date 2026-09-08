"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Deuda = {
  id: string;
  tipo: "yo_debo" | "me_deben";
  persona: string;
  monto_total: number;
  saldo_pendiente: number;
  fecha_vencimiento: string | null;
};

export default function DeudasPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda, mostrarSaldos } = useWorkspace();
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [tab, setTab] = useState<"yo_debo" | "me_deben">("yo_debo");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [persona, setPersona] = useState("");
  const [monto, setMonto] = useState(0);
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const { data } = await supabase
      .from("debts")
      .select("id, tipo, persona, monto_total, saldo_pendiente, fecha_vencimiento")
      .eq("workspace_id", workspaceActual.id)
      .order("created_at", { ascending: false });
    setDeudas(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregar() {
    if (!workspaceActual || !persona || !monto) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("debts").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      tipo: tab,
      persona,
      monto_total: monto,
      saldo_pendiente: monto,
      fecha_vencimiento: vencimiento || null,
    });

    setPersona("");
    setMonto(0);
    setVencimiento("");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function registrarPago(d: Deuda) {
    const valor = prompt(`¿Cuánto pagó/pagaste de la deuda con ${d.persona}?`);
    const pago = valor ? parseMoneyInput(valor) : 0;
    if (pago <= 0) return;
    const nuevoSaldo = Math.max(0, Number(d.saldo_pendiente) - pago);
    await supabase.from("debts").update({ saldo_pendiente: nuevoSaldo }).eq("id", d.id);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus deudas.</div>;
  }

  const filtradas = deudas.filter((d) => d.tipo === tab);

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-lg font-semibold">Deudas</h1>

      <div className="flex bg-brand-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("yo_debo")}
          className={`px-3 py-1.5 text-sm rounded-md transition ${tab === "yo_debo" ? "bg-brand-600 text-white" : "text-brand-800"}`}
        >
          Yo debo
        </button>
        <button
          onClick={() => setTab("me_deben")}
          className={`px-3 py-1.5 text-sm rounded-md transition ${tab === "me_deben" ? "bg-brand-600 text-white" : "text-brand-800"}`}
        >
          Me deben
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {filtradas.length === 0 && <div className="card p-6 text-sm text-black/40 text-center">No hay registros acá.</div>}
        {filtradas.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{d.persona}</div>
                <div className="text-xs text-black/40">
                  Total: {formatMoney(d.monto_total, moneda, !mostrarSaldos)}
                  {d.fecha_vencimiento && ` · Vence ${new Date(d.fecha_vencimiento).toLocaleDateString("es-PY")}`}
                </div>
              </div>
              <div className={`font-medium text-sm ${tab === "yo_debo" ? "text-red-500" : "text-brand-600"}`}>
                {formatMoney(d.saldo_pendiente, moneda, !mostrarSaldos)}
              </div>
            </div>
            {Number(d.saldo_pendiente) > 0 && (
              <button className="text-xs text-brand-600 font-medium mt-2" onClick={() => registrarPago(d)}>
                + Registrar pago
              </button>
            )}
            {Number(d.saldo_pendiente) === 0 && <div className="text-xs text-brand-600 mt-2">✅ Saldada</div>}
          </div>
        ))}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary">
          <Plus size={16} /> {tab === "yo_debo" ? "Registrar que debo" : "Registrar que me deben"}
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <input className="input" placeholder="Persona o entidad" value={persona} onChange={(e) => setPersona(e.target.value)} />
          <input
            className="input"
            placeholder="Monto"
            value={monto ? formatMoney(monto, moneda) : ""}
            onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
          />
          <input className="input" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
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
