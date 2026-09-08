"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import ModalMontoCuenta from "@/components/ModalMontoCuenta";

type Proveedor = {
  id: string;
  nombre: string;
  contacto: string | null;
  deuda_pendiente: number;
  total_comprado: number;
  ultimo_movimiento: string | null;
};

export default function ProveedoresPage() {
  const supabase = createClient();
  const { workspaces, moneda } = useWorkspace();
  const negocio = workspaces.find((w) => w.tipo === "negocio");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [proveedorParaPagar, setProveedorParaPagar] = useState<Proveedor | null>(null);

  async function cargar() {
    if (!negocio) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, nombre, contacto, deuda_pendiente, total_comprado, ultimo_movimiento")
      .eq("workspace_id", negocio.id)
      .order("total_comprado", { ascending: false });
    setProveedores(data ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio]);

  async function agregar() {
    if (guardando) return;
    if (!negocio || !nombre) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("suppliers").insert({ user_id: user?.id, workspace_id: negocio.id, nombre, contacto: contacto || null });
    await supabase.from("audit_logs").insert({ user_id: user?.id, accion: "proveedor_creado", detalle: { nombre } });
    setNombre("");
    setContacto("");
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function registrarPago(monto: number, cuentaId: string) {
    if (!proveedorParaPagar) return;
    const { error } = await supabase.rpc("fn_registrar_pago_proveedor", {
      p_supplier_id: proveedorParaPagar.id,
      p_monto: monto,
      p_account_id: cuentaId,
    });
    if (error) throw new Error(error.message);
    cargar();
  }

  if (!negocio) return <div className="card p-6 text-sm text-black/60">Activá el espacio de Negocio primero.</div>;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Proveedores</h1>

      <div className="card divide-y divide-black/5">
        {proveedores.length === 0 && <div className="p-6 text-sm text-black/40 text-center">Todavía no tenés proveedores registrados.</div>}
        {proveedores.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-sm">{p.nombre}</div>
              <div className="text-xs text-black/40">
                {p.contacto ?? "Sin contacto"} · Total comprado: {formatMoney(p.total_comprado, moneda)}
                {p.ultimo_movimiento && ` · Último: ${new Date(p.ultimo_movimiento).toLocaleDateString("es-PY")}`}
              </div>
            </div>
            <div className="text-right">
              {Number(p.deuda_pendiente) > 0 ? (
                <>
                  <div className="text-sm font-medium text-red-500">Debés {formatMoney(p.deuda_pendiente, moneda)}</div>
                  <button className="text-xs text-brand-600 font-medium" onClick={() => setProveedorParaPagar(p)}>
                    + Registrar pago
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
          <Plus size={16} /> Nuevo proveedor
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

      {proveedorParaPagar && negocio && (
        <ModalMontoCuenta
          titulo={`Pago — ${proveedorParaPagar.nombre}`}
          workspaceId={negocio.id}
          montoMaximo={Number(proveedorParaPagar.deuda_pendiente)}
          textoBoton="Registrar pago"
          onConfirmar={registrarPago}
          onCerrar={() => setProveedorParaPagar(null)}
        />
      )}
    </div>
  );
}
