"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subirComprobante } from "@/lib/supabase/comprobantes";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney, parseMoneyInput } from "@/lib/utils/currency";

type Proveedor = { id: string; nombre: string };
type Cuenta = { id: string; nombre: string };

export default function NuevaCompraPage() {
  const router = useRouter();
  const supabase = createClient();
  const { workspaces } = useWorkspace();
  const negocio = workspaces.find((w) => w.tipo === "negocio");

  const [concepto, setConcepto] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [importe, setImporte] = useState(0);
  const [estadoPago, setEstadoPago] = useState<"pagado" | "pendiente">("pagado");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    (async () => {
      const [{ data: prov }, { data: cta }] = await Promise.all([
        supabase.from("suppliers").select("id, nombre").eq("workspace_id", negocio.id).order("nombre"),
        supabase.from("accounts").select("id, nombre").eq("workspace_id", negocio.id).eq("activa", true),
      ]);
      setProveedores(prov ?? []);
      setCuentas(cta ?? []);
    })();
  }, [negocio]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!negocio) return;
    setError(null);

    if (!concepto || !importe) {
      setError("Completá el concepto y el importe.");
      return;
    }
    if (estadoPago === "pagado" && !cuentaId) {
      setError("Elegí desde qué cuenta se pagó.");
      return;
    }
    if (estadoPago === "pendiente" && !proveedorId && !proveedorNuevo) {
      setError("Una compra pendiente de pago necesita un proveedor identificado.");
      return;
    }

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user!.id;

    let proveedorFinalId = proveedorId || null;
    if (!proveedorFinalId && proveedorNuevo) {
      const { data: nuevo } = await supabase
        .from("suppliers")
        .insert({ user_id: userId, workspace_id: negocio.id, nombre: proveedorNuevo })
        .select()
        .single();
      proveedorFinalId = nuevo?.id ?? null;
    }

    let comprobante_url: string | null = null;
    if (comprobante) {
      comprobante_url = await subirComprobante(supabase, userId, comprobante);
    }

    let transactionId: string | null = null;
    if (estadoPago === "pagado") {
      const { data: categoria } = await supabase
        .from("transaction_categories")
        .select("id")
        .eq("workspace_tipo", "negocio")
        .eq("nombre", "Compras")
        .eq("tipo", "gasto")
        .maybeSingle();

      const { data: nuevaTx, error: errTx } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          workspace_id: negocio.id,
          account_id: cuentaId,
          category_id: categoria?.id ?? null,
          tipo: "gasto",
          monto: importe,
          fecha,
          descripcion: concepto,
          comprobante_url,
          origen: "manual",
        })
        .select()
        .single();

      if (errTx) {
        setError("No se pudo registrar el gasto de la compra.");
        setGuardando(false);
        return;
      }
      transactionId = nuevaTx.id;
    }

    const { error: errCompra } = await supabase.from("purchases").insert({
      user_id: userId,
      workspace_id: negocio.id,
      supplier_id: proveedorFinalId,
      concepto,
      cantidad,
      importe,
      account_id: estadoPago === "pagado" ? cuentaId : null,
      transaction_id: transactionId,
      comprobante_url,
      estado_pago: estadoPago,
      fecha,
    });

    if (errCompra) {
      setError("No se pudo registrar la compra.");
      setGuardando(false);
      return;
    }

    if (proveedorFinalId) {
      const { data: proveedor } = await supabase.from("suppliers").select("deuda_pendiente, total_comprado").eq("id", proveedorFinalId).single();
      await supabase
        .from("suppliers")
        .update({
          deuda_pendiente: Number(proveedor?.deuda_pendiente ?? 0) + (estadoPago === "pendiente" ? importe : 0),
          total_comprado: Number(proveedor?.total_comprado ?? 0) + importe,
          ultimo_movimiento: fecha,
        })
        .eq("id", proveedorFinalId);
    }

    await supabase.from("audit_logs").insert({ user_id: userId, accion: "compra_creada", detalle: { importe, concepto } });

    setGuardando(false);
    setExito(true);
    setTimeout(() => router.push("/dashboard/negocio"), 900);
  }

  if (!negocio) return <div className="card p-6 text-sm text-black/60">Activá el espacio de Negocio primero.</div>;

  return (
    <div className="max-w-lg">
      <div className="card p-6 flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Nueva compra</h1>

        <div>
          <label className="text-sm font-medium mb-1 block">Concepto</label>
          <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Mercadería, insumos..." />
          <p className="text-xs text-amber-600 -mt-2">
            ⚠️ Si esta compra es mercadería que después vas a revender, cargá su costo en "Ventas" al momento de venderla, no acá — evitá restarlo dos veces (una como Compra y otra como Costo de la venta). Usá esta pantalla solo para gastos operativos del negocio.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Proveedor existente</label>
            <select className="input" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setProveedorNuevo(""); }}>
              <option value="">Sin especificar</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">O proveedor nuevo</label>
            <input className="input" value={proveedorNuevo} onChange={(e) => { setProveedorNuevo(e.target.value); setProveedorId(""); }} placeholder="Nombre" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Cantidad</label>
            <input type="number" className="input" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Importe</label>
            <input className="input" value={importe ? formatMoney(importe) : ""} onChange={(e) => setImporte(parseMoneyInput(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Estado de pago</label>
          <div className="flex gap-2">
            <button onClick={() => setEstadoPago("pagado")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${estadoPago === "pagado" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}>
              Ya pagué
            </button>
            <button onClick={() => setEstadoPago("pendiente")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${estadoPago === "pendiente" ? "bg-brand-600 text-white" : "bg-black/5 text-black/60"}`}>
              Pendiente de pago
            </button>
          </div>
        </div>

        {estadoPago === "pagado" && (
          <div>
            <label className="text-sm font-medium mb-1 block">¿Desde qué cuenta se pagó?</label>
            <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-1 block">Comprobante (opcional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setComprobante(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {exito && <p className="text-sm text-brand-600">Compra registrada ✅</p>}

        <button onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? "Guardando..." : "Registrar compra"}
        </button>
      </div>
    </div>
  );
}
