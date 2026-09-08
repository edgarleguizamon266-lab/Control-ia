"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Cuenta = { id: string; nombre: string };

// Transferencia interna entre cuentas del mismo workspace (sección 19).
// Regla crítica: NO es ingreso ni gasto. Se ejecuta como una única fila
// tipo="transferencia" con cuenta origen y destino — atómico por diseño
// (un solo insert, sin pasos intermedios).
export default function TransferenciaPage() {
  const router = useRouter();
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda } = useWorkspace();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [desde, setDesde] = useState("");
  const [hacia, setHacia] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!workspaceActual) return;
    (async () => {
      const { data } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", workspaceActual.id).eq("activa", true);
      setCuentas(data ?? []);
    })();
  }, [workspaceActual]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!workspaceActual) return;
    setError(null);

    if (!desde || !hacia || !monto) {
      setError("Completá cuenta origen, destino y monto.");
      return;
    }
    if (desde === hacia) {
      setError("La cuenta de origen y destino no pueden ser la misma.");
      return;
    }

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: errInsert } = await supabase.from("transactions").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      account_id: desde,
      transferencia_cuenta_destino_id: hacia,
      tipo: "transferencia",
      monto,
      fecha,
      descripcion: nota || null,
    });

    setGuardando(false);
    if (errInsert) {
      setError("No se pudo registrar la transferencia.");
      return;
    }
    setExito(true);
    setTimeout(() => router.push("/dashboard/cuentas"), 900);
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para transferir entre sus cuentas.</div>;
  }

  return (
    <div className="max-w-md">
      <div className="card p-6">
        <h1 className="text-lg font-semibold mb-1">Transferencia entre cuentas</h1>
        <p className="text-sm text-black/50 mb-5">Esto no se cuenta como ingreso ni como gasto.</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Desde</label>
            <select className="input" value={desde} onChange={(e) => setDesde(e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Hacia</label>
            <select className="input" value={hacia} onChange={(e) => setHacia(e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentas.filter((c) => c.id !== desde).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <input
              className="input"
              value={monto ? formatMoney(monto, moneda) : ""}
              onChange={(e) => setMonto(parseMoneyInput(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Nota (opcional)</label>
            <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {exito && <p className="text-sm text-brand-600">Transferencia registrada ✅</p>}

          <button onClick={guardar} disabled={guardando} className="btn-primary mt-2">
            {guardando ? "Transfiriendo..." : "Transferir"}
          </button>
        </div>
      </div>
    </div>
  );
}
