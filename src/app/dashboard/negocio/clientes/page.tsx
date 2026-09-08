"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";
import ModalMontoCuenta from "@/components/ModalMontoCuenta";

type Cliente = {
  id: string;
  nombre: string;
  contacto: string | null;
  saldo_pendiente: number;
  total_comprado: number;
  ultima_compra: string | null;
};

export default function ClientesPage() {
  const supabase = createClient();
  const { workspaces, moneda } = useWorkspace();
  const negocio = workspaces.find((w) => w.tipo === "negocio");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [clienteParaCobrar, setClienteParaCobrar] = useState<Cliente | null>(null);

  async function cargar() {
    if (!negocio) return;
    const { data } = await supabase
      .from("customers")
      .select("id, nombre, contacto, saldo_pendiente, total_comprado, ultima_compra")
      .eq("workspace_id", negocio.id)
      .order("total_comprado", { ascending: false });
    setClientes(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio]);

  async function agregar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!negocio || !nombre) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("customers").insert({ user_id: user?.id, workspace_id: negocio.id, nombre, contacto: contacto || null });
    await supabase.from("audit_logs").insert({ user_id: user?.id, accion: "cliente_creado", detalle: { nombre } });
    setNombre("");
    setContacto("");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function registrarCobro(monto: number, cuentaId: string) {
    if (!clienteParaCobrar) return;
    const { error } = await supabase.rpc("fn_registrar_cobro_cliente", {
      p_customer_id: clienteParaCobrar.id,
      p_monto: monto,
      p_account_id: cuentaId,
    });
    if (error) throw new Error(error.message);
    cargar();
  }

  if (!negocio) return <div className="card p-6 text-sm text-black/60">Activá el espacio de Negocio primero.</div>;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Clientes</h1>

      <div className="card divide-y divide-black/5">
        {clientes.length === 0 && <div className="p-6 text-sm text-black/40 text-center">Todavía no tenés clientes registrados.</div>}
        {clientes.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-sm">{c.nombre}</div>
              <div className="text-xs text-black/40">
                {c.contacto ?? "Sin contacto"} · Total comprado: {formatMoney(c.total_comprado, moneda)}
                {c.ultima_compra && ` · Última compra: ${new Date(c.ultima_compra).toLocaleDateString("es-PY")}`}
              </div>
            </div>
            <div className="text-right">
              {Number(c.saldo_pendiente) > 0 ? (
                <>
                  <div className="text-sm font-medium text-red-500">Debe {formatMoney(c.saldo_pendiente, moneda)}</div>
                  <button className="text-xs text-brand-600 font-medium" onClick={() => setClienteParaCobrar(c)}>
                    + Registrar cobro
                  </button>
                </>
              ) : (
                <div className="text-xs text-brand-600">Al día</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary w-fit">
          <Plus size={16} /> Nuevo cliente
        </button>
      ) : (
        <div className="card p-4 flex flex-col gap-3 max-w-sm">
          <input className="input" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="input" placeholder="Teléfono/contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn-primary flex-1" disabled={guardando} onClick={agregar}>Guardar</button>
          </div>
        </div>
      )}

      {clienteParaCobrar && negocio && (
        <ModalMontoCuenta
          titulo={`Cobro — ${clienteParaCobrar.nombre}`}
          workspaceId={negocio.id}
          montoMaximo={Number(clienteParaCobrar.saldo_pendiente)}
          textoBoton="Registrar cobro"
          onConfirmar={registrarCobro}
          onCerrar={() => setClienteParaCobrar(null)}
        />
      )}
    </div>
  );
}
