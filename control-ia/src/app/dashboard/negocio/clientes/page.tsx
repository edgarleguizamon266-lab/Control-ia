"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

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

  async function registrarCobro(cliente: Cliente) {
    const valor = prompt(`¿Cuánto te pagó ${cliente.nombre}?`);
    const monto = valor ? parseMoneyInput(valor) : 0;
    if (monto <= 0 || !negocio) return;

    const { data: cuentas } = await supabase.from("accounts").select("id, nombre").eq("workspace_id", negocio.id).eq("activa", true);
    if (!cuentas || cuentas.length === 0) {
      alert("Creá una cuenta primero para poder registrar el cobro.");
      return;
    }
    const nombresCuentas = cuentas.map((c, i) => `${i + 1}. ${c.nombre}`).join("\n");
    const eleccion = prompt(`¿En qué cuenta lo recibiste?\n${nombresCuentas}`);
    const idx = eleccion ? parseInt(eleccion, 10) - 1 : -1;
    const cuenta = cuentas[idx];
    if (!cuenta) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: categoria } = await supabase
      .from("transaction_categories")
      .select("id")
      .eq("workspace_tipo", "negocio")
      .eq("nombre", "Ventas")
      .eq("tipo", "ingreso")
      .maybeSingle();

    await supabase.from("transactions").insert({
      user_id: user?.id,
      workspace_id: negocio.id,
      account_id: cuenta.id,
      category_id: categoria?.id ?? null,
      tipo: "ingreso",
      monto,
      descripcion: `Cobro a ${cliente.nombre}`,
    });

    await supabase
      .from("customers")
      .update({ saldo_pendiente: Math.max(0, Number(cliente.saldo_pendiente) - monto) })
      .eq("id", cliente.id);

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
                  <button className="text-xs text-brand-600 font-medium" onClick={() => registrarCobro(c)}>
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
    </div>
  );
}
