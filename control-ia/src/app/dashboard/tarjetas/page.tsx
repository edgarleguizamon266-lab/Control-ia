"use client";

import { useEffect, useState } from "react";
import { Plus, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import { getAccountsWithBalance, type CuentaConSaldo } from "@/lib/financial-engine";

export default function TarjetasPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion, moneda, mostrarSaldos } = useWorkspace();
  const [tarjetas, setTarjetas] = useState<CuentaConSaldo[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [deuda, setDeuda] = useState(0);
  const [limite, setLimite] = useState(0);
  const [cierre, setCierre] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!workspaceActual) return;
    const todas = await getAccountsWithBalance(supabase, workspaceActual.id);
    setTarjetas(todas.filter((c) => c.tipo === "tarjeta_credito"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceActual]);

  async function agregar() {
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
      institucion: institucion || null,
      tipo: "tarjeta_credito",
      saldo_inicial: -Math.abs(deuda),
      limite_credito: limite || null,
      dia_cierre: cierre ? parseInt(cierre, 10) : null,
      dia_vencimiento: vencimiento ? parseInt(vencimiento, 10) : null,
      moneda,
    });

    setNombre("");
    setInstitucion("");
    setDeuda(0);
    setLimite(0);
    setCierre("");
    setVencimiento("");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para ver sus tarjetas.</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-lg font-semibold">Tarjetas</h1>

      <div className="flex flex-col gap-3">
        {tarjetas.length === 0 && <div className="card p-6 text-sm text-black/40 text-center">No tenés tarjetas registradas.</div>}
        {tarjetas.map((t) => {
          // Saldo negativo = deuda actual de la tarjeta (nunca se mezcla con "saldo bancario",
          // que no aplica a este tipo de cuenta — sección 11 de la auditoría).
          const usado = Math.abs(Math.min(0, t.saldo));
          const disponibleEnTarjeta = t.limite_credito ? Math.max(0, t.limite_credito - usado) : null;
          const porcentaje = t.limite_credito ? Math.min(100, Math.round((usado / t.limite_credito) * 100)) : null;
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div>
                  <div className="font-medium text-sm">{t.nombre}</div>
                  <div className="text-xs text-black/40">{t.institucion}</div>
                </div>
                <div className="ml-auto font-medium text-red-500 text-sm">
                  {formatMoney(t.saldo, moneda, !mostrarSaldos)}
                </div>
              </div>
              {t.limite_credito && (
                <>
                  <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
                    <div className={`h-full rounded-full ${(porcentaje ?? 0) >= 90 ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${porcentaje}%` }} />
                  </div>
                  <div className="text-xs text-black/40 mt-1">
                    Usado: {formatMoney(usado, moneda, !mostrarSaldos)} de {formatMoney(t.limite_credito, moneda, !mostrarSaldos)}
                    {disponibleEnTarjeta !== null && ` · Disponible en la tarjeta: ${formatMoney(disponibleEnTarjeta, moneda, !mostrarSaldos)}`}
                  </div>
                  <div className="text-xs text-black/40">
                    {t.dia_cierre && `Cierra día ${t.dia_cierre}`}
                    {t.dia_vencimiento && ` · Vence día ${t.dia_vencimiento}`}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary">
          <Plus size={16} /> Agregar tarjeta
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <input className="input" placeholder="Nombre (ej. Visa Itaú)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="input" placeholder="Institución (ej. Itaú)" value={institucion} onChange={(e) => setInstitucion(e.target.value)} />
          <input
            className="input"
            placeholder="Deuda actual"
            value={deuda ? formatMoney(deuda, moneda) : ""}
            onChange={(e) => setDeuda(parseMoneyInput(e.target.value))}
          />
          <input
            className="input"
            placeholder="Límite de crédito"
            value={limite ? formatMoney(limite, moneda) : ""}
            onChange={(e) => setLimite(parseMoneyInput(e.target.value))}
          />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" min={1} max={31} placeholder="Día de cierre" value={cierre} onChange={(e) => setCierre(e.target.value)} />
            <input className="input" type="number" min={1} max={31} placeholder="Día de vencimiento" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </div>
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
