"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import { getAccountsWithBalance, getPatrimonioNeto, type CuentaConSaldo, type PatrimonioNeto } from "@/lib/financial-engine";

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
  const [cuentaGastoDefault, setCuentaGastoDefault] = useState("");
  const [cuentaIngresoDefault, setCuentaIngresoDefault] = useState("");
  const [guardandoPref, setGuardandoPref] = useState(false);
  const [patrimonio, setPatrimonio] = useState<PatrimonioNeto | null>(null);

  async function cargar() {
    if (!workspaceActual) return;
    const [data, { data: pref }, pat] = await Promise.all([
      getAccountsWithBalance(supabase, workspaceActual.id),
      supabase
        .from("workspace_preferences")
        .select("cuenta_predeterminada_gasto_id, cuenta_predeterminada_ingreso_id")
        .eq("workspace_id", workspaceActual.id)
        .maybeSingle(),
      getPatrimonioNeto(supabase, workspaceActual.id),
    ]);
    setPatrimonio(pat);
    setCuentas(data);
    setCuentaGastoDefault(pref?.cuenta_predeterminada_gasto_id ?? "");
    setCuentaIngresoDefault(pref?.cuenta_predeterminada_ingreso_id ?? "");
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

  async function guardarPreferencias() {
    if (guardandoPref || !workspaceActual) return;
    setGuardandoPref(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("workspace_preferences").upsert({
      workspace_id: workspaceActual.id,
      user_id: user?.id,
      cuenta_predeterminada_gasto_id: cuentaGastoDefault || null,
      cuenta_predeterminada_ingreso_id: cuentaIngresoDefault || null,
      updated_at: new Date().toISOString(),
    });

    setGuardandoPref(false);
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus cuentas.</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mis cuentas</h1>
      </div>

      {patrimonio && (patrimonio.deuda_tarjetas > 0 || patrimonio.inversiones > 0 || patrimonio.deudas_pendientes > 0) && (
        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Patrimonio neto</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-black/40 text-xs">Liquidez</div>
              <div className="font-medium">{formatMoney(patrimonio.liquidez, moneda)}</div>
            </div>
            {patrimonio.inversiones > 0 && (
              <div>
                <div className="text-black/40 text-xs">Inversiones</div>
                <div className="font-medium">{formatMoney(patrimonio.inversiones, moneda)}</div>
              </div>
            )}
            {patrimonio.deuda_tarjetas > 0 && (
              <div>
                <div className="text-black/40 text-xs">Deuda tarjetas</div>
                <div className="font-medium text-red-500">-{formatMoney(patrimonio.deuda_tarjetas, moneda)}</div>
              </div>
            )}
            {patrimonio.deudas_pendientes > 0 && (
              <div>
                <div className="text-black/40 text-xs">Deudas pendientes</div>
                <div className="font-medium text-red-500">-{formatMoney(patrimonio.deudas_pendientes, moneda)}</div>
              </div>
            )}
          </div>
          <div className="border-t border-black/5 mt-3 pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Patrimonio neto</span>
            <span className="font-semibold">{formatMoney(patrimonio.patrimonio_neto, moneda)}</span>
          </div>
        </div>
      )}

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

      {cuentas.length > 0 && (
        <div className="card p-4 flex flex-col gap-3">
          <div>
            <div className="font-medium text-sm">Cuentas predeterminadas</div>
            <p className="text-xs text-black/40">CONTROL IA las usa automáticamente sin tener que preguntarte cada vez.</p>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Para gastos</label>
            <select className="input text-sm" value={cuentaGastoDefault} onChange={(e) => setCuentaGastoDefault(e.target.value)}>
              <option value="">Preguntar cada vez</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Para ingresos</label>
            <select className="input text-sm" value={cuentaIngresoDefault} onChange={(e) => setCuentaIngresoDefault(e.target.value)}>
              <option value="">Preguntar cada vez</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" disabled={guardandoPref} onClick={guardarPreferencias}>
            {guardandoPref ? "Guardando..." : "Guardar preferencias"}
          </button>
        </div>
      )}
    </div>
  );
}
