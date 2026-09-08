"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import { getAccountsWithBalance, type CuentaConSaldo } from "@/lib/financial-engine";

type Cuenta = CuentaConSaldo;

const TIPOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Banco" },
  { value: "billetera", label: "Billetera" },
  { value: "tarjeta_debito", label: "Tarjeta de débito" },
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "ahorro", label: "Ahorro" },
  { value: "inversion", label: "Inversión" },
  { value: "otro", label: "Otro" },
];

export default function CuentasPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda } = useWorkspace();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("efectivo");
  const [saldo, setSaldo] = useState(0);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const data = await getAccountsWithBalance(supabase, workspaceActual.id);
    setCuentas(data);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregarCuenta() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!workspaceActual || !nombre) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("accounts").insert({
      user_id: user?.id,
      workspace_id: workspaceActual.id,
      nombre,
      tipo,
      saldo_inicial: saldo,
      moneda,
    });

    setNombre("");
    setSaldo(0);
    setTipo("efectivo");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus cuentas.</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mis cuentas</h1>
      </div>

      <div className="card divide-y divide-black/5">
        {cuentas.length === 0 && <div className="p-6 text-sm text-black/40 text-center">No tenés cuentas todavía.</div>}
        {cuentas.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                <Wallet size={16} />
              </div>
              <div>
                <div className="font-medium text-sm">{c.nombre}</div>
                <div className="text-xs text-black/40">{TIPOS.find((t) => t.value === c.tipo)?.label}</div>
              </div>
            </div>
            <div className={`font-medium text-sm ${c.saldo < 0 ? "text-red-500" : ""}`}>
              {formatMoney(c.saldo, moneda)}
            </div>
          </div>
        ))}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary">
          <Plus size={16} /> Agregar cuenta
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <input className="input" placeholder="Nombre (ej. Itaú)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Saldo inicial"
            value={saldo ? formatMoney(saldo, moneda) : ""}
            onChange={(e) => setSaldo(parseMoneyInput(e.target.value))}
          />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn-primary flex-1" disabled={guardando} onClick={agregarCuenta}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
