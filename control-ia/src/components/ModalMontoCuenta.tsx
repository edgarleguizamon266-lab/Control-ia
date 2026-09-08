"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Cuenta = { id: string; nombre: string };

// Reemplaza los window.prompt() nativos (Fase 5.4) para cualquier
// operación que necesite "monto + cuenta" — pagar deuda, cobrar
// cliente, pagar proveedor, aportar/retirar de una meta.
export default function ModalMontoCuenta({
  titulo,
  workspaceId,
  montoMaximo,
  textoBoton = "Confirmar",
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  workspaceId: string;
  montoMaximo?: number;
  textoBoton?: string;
  onConfirmar: (monto: number, cuentaId: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const supabase = createClient();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [monto, setMonto] = useState(0);
  const [cuentaId, setCuentaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceId).eq("activa", true);
      setCuentas(data ?? []);
      if (data && data.length === 1) setCuentaId(data[0].id);
    })();
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar() {
    if (enviando) return;
    setError(null);
    if (!monto || monto <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    if (montoMaximo !== undefined && monto > montoMaximo) {
      setError(`No podés superar ${formatMoney(montoMaximo)}.`);
      return;
    }
    if (!cuentaId) {
      setError("Elegí una cuenta.");
      return;
    }
    setEnviando(true);
    try {
      await onConfirmar(monto, cuentaId);
      onCerrar();
    } catch (e: any) {
      setError(e.message ?? "No se pudo completar la operación.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" onClick={onCerrar}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 w-full md:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold">{titulo}</span>
          <button onClick={onCerrar} className="p-1 text-black/40"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <input
              className="input text-lg"
              inputMode="numeric"
              autoFocus
              value={monto ? formatMoney(monto) : ""}
              onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
            />
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 mt-2">
            <button className="btn-secondary flex-1" onClick={onCerrar}>Cancelar</button>
            <button className="btn-primary flex-1" disabled={enviando} onClick={confirmar}>
              {enviando ? "Procesando..." : textoBoton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
