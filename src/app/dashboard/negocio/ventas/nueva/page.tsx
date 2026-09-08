"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Cliente = { id: string; nombre: string };
type Cuenta = { id: string; nombre: string };

// Registrar una venta SIEMPRE mantiene coherentes tres cosas a la vez
// (hallazgo de auditoría — antes vivían separadas):
// 1) la fila en "sales" (para reportes y ganancia del negocio),
// 2) un movimiento real en "transactions" si se cobró al contado
//    (para que el saldo de la cuenta y el dashboard lo reflejen),
// 3) el saldo pendiente del cliente si fue a crédito.
export default function NuevaVentaPage() {
  const router = useRouter();
  const supabase = createClient();
  const { workspaces } = useWorkspace();
  const negocio = workspaces.find((w) => w.tipo === "negocio");

  const [producto, setProducto] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNuevo, setClienteNuevo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);
  const [costo, setCosto] = useState(0);
  const [formaPago, setFormaPago] = useState<"contado" | "credito">("contado");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    (async () => {
      const [{ data: cli }, { data: cta }] = await Promise.all([
        supabase.from("customers").select("id, nombre").eq("workspace_id", negocio.id).order("nombre"),
        supabase.from("accounts").select("id, nombre").eq("workspace_id", negocio.id).eq("activa", true),
      ]);
      setClientes(cli ?? []);
      setCuentas(cta ?? []);
    })();
  }, [negocio]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!negocio) return;
    setError(null);

    if (!precio) {
      setError("Ingresá el precio de venta.");
      return;
    }
    if (formaPago === "contado" && !cuentaId) {
      setError("Elegí en qué cuenta ingresó el dinero.");
      return;
    }
    if (formaPago === "credito" && !clienteId && !clienteNuevo) {
      setError("Una venta a crédito necesita un cliente identificado.");
      return;
    }

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user!.id;

    // Resolver o crear cliente
    let clienteFinalId = clienteId || null;
    if (!clienteFinalId && clienteNuevo) {
      const { data: nuevo } = await supabase
        .from("customers")
        .insert({ user_id: userId, workspace_id: negocio.id, nombre: clienteNuevo })
        .select()
        .single();
      clienteFinalId = nuevo?.id ?? null;
    }

    let transactionId: string | null = null;

    if (formaPago === "contado") {
      // 1) Categoría "Ventas" del sistema para el workspace negocio
      const { data: categoria } = await supabase
        .from("transaction_categories")
        .select("id")
        .eq("workspace_tipo", "negocio")
        .eq("nombre", "Ventas")
        .eq("tipo", "ingreso")
        .maybeSingle();

      const { data: nuevaTx, error: errTx } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          workspace_id: negocio.id,
          account_id: cuentaId,
          category_id: categoria?.id ?? null,
          tipo: "ingreso",
          monto: precio,
          fecha,
          descripcion: producto || "Venta",
          origen: "manual",
        })
        .select()
        .single();

      if (errTx) {
        setError("No se pudo registrar el ingreso de la venta.");
        setGuardando(false);
        return;
      }
      transactionId = nuevaTx.id;
    }

    const { error: errVenta } = await supabase.from("sales").insert({
      user_id: userId,
      workspace_id: negocio.id,
      customer_id: clienteFinalId,
      producto: producto || null,
      cantidad,
      monto: precio,
      costo,
      forma_pago: formaPago,
      account_id: formaPago === "contado" ? cuentaId : null,
      transaction_id: transactionId,
      estado_pago: formaPago === "contado" ? "pagado" : "pendiente",
      fecha,
    });

    if (errVenta) {
      setError("No se pudo registrar la venta.");
      setGuardando(false);
      return;
    }

    // Si fue a crédito, aumentar la cuenta por cobrar del cliente
    if (formaPago === "credito" && clienteFinalId) {
      const { data: cliente } = await supabase.from("customers").select("saldo_pendiente, total_comprado").eq("id", clienteFinalId).single();
      await supabase
        .from("customers")
        .update({
          saldo_pendiente: Number(cliente?.saldo_pendiente ?? 0) + precio,
          total_comprado: Number(cliente?.total_comprado ?? 0) + precio,
          ultima_compra: fecha,
        })
        .eq("id", clienteFinalId);
    } else if (clienteFinalId) {
      const { data: cliente } = await supabase.from("customers").select("total_comprado").eq("id", clienteFinalId).single();
      await supabase
        .from("customers")
        .update({ total_comprado: Number(cliente?.total_comprado ?? 0) + precio, ultima_compra: fecha })
        .eq("id", clienteFinalId);
    }

    await supabase.from("audit_logs").insert({ user_id: userId, accion: "venta_creada", detalle: { monto: precio, producto } });

    setGuardando(false);
    setExito(true);
    setTimeout(() => router.push("/dashboard/negocio"), 900);
  }

  if (!negocio) return <div className="card p-6 text-sm text-black/60">Activá el espacio de Negocio primero.</div>;

  const ganancia = precio - costo;

  return (
    <div className="max-w-lg">
      <div className="card p-6 flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Nueva venta</h1>

        <div>
          <label className="text-sm font-medium mb-1 block">Producto/Descripción</label>
          <input className="input" value={producto} onChange={(e) => setProducto(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Cliente existente</label>
            <select className="input" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setClienteNuevo(""); }}>
              <option value="">Sin especificar</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">O cliente nuevo</label>
            <input className="input" value={clienteNuevo} onChange={(e) => { setClienteNuevo(e.target.value); setClienteId(""); }} placeholder="Nombre" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Cantidad</label>
            <input type="number" className="input" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Precio de venta</label>
            <input className="input" value={precio ? formatMoney(precio) : ""} onChange={(e) => setPrecio(parseMoneyInput(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Costo</label>
            <input className="input" value={costo ? formatMoney(costo) : ""} onChange={(e) => setCosto(parseMoneyInput(e.target.value))} />
          </div>
        </div>

        <div className="text-sm text-black/50">Ganancia estimada: <span className="font-medium text-brand-600">{formatMoney(ganancia)}</span></div>

        <div>
          <label className="text-sm font-medium mb-1 block">Forma de pago</label>
          <div className="flex gap-2">
            <button onClick={() => setFormaPago("contado")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${formaPago === "contado" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}>
              Al contado
            </button>
            <button onClick={() => setFormaPago("credito")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${formaPago === "credito" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}>
              A crédito
            </button>
          </div>
        </div>

        {formaPago === "contado" && (
          <div>
            <label className="text-sm font-medium mb-1 block">¿En qué cuenta ingresó el dinero?</label>
            <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {exito && <p className="text-sm text-brand-600">Venta registrada ✅</p>}

        <button onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? "Guardando..." : "Registrar venta"}
        </button>
      </div>
    </div>
  );
}
