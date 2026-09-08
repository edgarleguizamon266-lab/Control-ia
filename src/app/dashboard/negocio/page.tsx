"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import { getBusinessSummary, getBusinessReceivablesPayables, getTopClientes, getTopProveedores, primerYUltimoDiaDelMes, type ResumenNegocio, type TopCliente, type TopProveedor } from "@/lib/financial-engine";
import SummaryCard from "@/components/SummaryCard";
import Link from "next/link";
import { Users, Truck, ShoppingBag } from "lucide-react";

type Venta = { id: string; monto: number; producto: string | null; fecha: string };

export default function NegocioPage() {
  const supabase = createClient();
  const { workspaces, moneda } = useWorkspace();
  const negocio = workspaces.find((w) => w.tipo === "negocio");
  const [resumen, setResumen] = useState<ResumenNegocio | null>(null);
  const [porCobrarPagar, setPorCobrarPagar] = useState({ por_cobrar: 0, por_pagar: 0 });
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topProveedores, setTopProveedores] = useState<TopProveedor[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!negocio) {
      setCargando(false);
      return;
    }
    (async () => {
      const { desde, hasta } = primerYUltimoDiaDelMes();
      const [r, cp, clientes, proveedores, { data: v }] = await Promise.all([
        getBusinessSummary(supabase, negocio.id, desde, hasta),
        getBusinessReceivablesPayables(supabase, negocio.id),
        getTopClientes(supabase, negocio.id, desde, hasta),
        getTopProveedores(supabase, negocio.id, desde, hasta),
        supabase.from("sales").select("id, monto, producto, fecha").eq("workspace_id", negocio.id).gte("fecha", desde).order("fecha", { ascending: false }).limit(8),
      ]);
      setResumen(r);
      setPorCobrarPagar(cp);
      setTopClientes(clientes);
      setTopProveedores(proveedores);
      setVentas(v ?? []);
      setCargando(false);
    })();
  }, [negocio]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!negocio) {
    return (
      <div className="card p-8 text-center text-black/60 text-sm">
        Tu cuenta no tiene un espacio de Negocio habilitado. Podés activarlo desde Configuración.
      </div>
    );
  }

  if (cargando || !resumen) return <div className="text-sm text-black/40">Cargando...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold">Mi Negocio</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/negocio/ventas/nueva" className="btn-primary text-sm">+ Nueva venta</Link>
          <Link href="/dashboard/negocio/compras/nueva" className="btn-secondary text-sm">+ Nueva compra</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard titulo="Ventas este mes" monto={resumen.ventas} moneda={moneda} colorTexto="text-brand-600" />
        <SummaryCard titulo="Costos + Gastos" monto={resumen.costos + resumen.gastos} moneda={moneda} colorTexto="text-red-500" />
        <SummaryCard titulo="Ganancia neta" monto={resumen.ganancia_neta} moneda={moneda} />
        <SummaryCard titulo="Margen" monto={resumen.ventas > 0 ? Math.round((resumen.ganancia_neta / resumen.ventas) * 100) : 0} moneda="" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/negocio/clientes" className="card p-4 flex items-center gap-3 hover:border-brand-500 border border-transparent transition">
          <Users size={18} className="text-brand-600" />
          <div>
            <div className="font-medium text-sm">Clientes</div>
            <div className="text-xs text-black/40">Por cobrar: {formatMoney(porCobrarPagar.por_cobrar, moneda)}</div>
          </div>
        </Link>
        <Link href="/dashboard/negocio/proveedores" className="card p-4 flex items-center gap-3 hover:border-brand-500 border border-transparent transition">
          <Truck size={18} className="text-brand-600" />
          <div>
            <div className="font-medium text-sm">Proveedores</div>
            <div className="text-xs text-black/40">Por pagar: {formatMoney(porCobrarPagar.por_pagar, moneda)}</div>
          </div>
        </Link>
      </div>

      <div className="card divide-y divide-black/5">
        <div className="px-4 py-3 font-medium text-sm flex items-center gap-2"><ShoppingBag size={14} /> Últimas ventas</div>
        {ventas.length === 0 && <div className="p-6 text-sm text-black/40 text-center">Sin ventas registradas este mes.</div>}
        {ventas.map((v) => (
          <div key={v.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{v.producto ?? "Venta"}</div>
              <div className="text-xs text-black/40">{new Date(v.fecha).toLocaleDateString("es-PY")}</div>
            </div>
            <div className="text-brand-600 font-medium">{formatMoney(v.monto, moneda)}</div>
          </div>
        ))}
      </div>

      {(topClientes.length > 0 || topProveedores.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="font-medium text-sm mb-2">Mejores clientes del mes</div>
            {topClientes.length === 0 && <p className="text-xs text-black/40">Sin datos todavía.</p>}
            {topClientes.map((c) => (
              <div key={c.customer_id} className="flex justify-between text-sm py-1">
                <span>{c.nombre}</span>
                <span className="font-medium">{formatMoney(c.total, moneda)}</span>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <div className="font-medium text-sm mb-2">Principales proveedores del mes</div>
            {topProveedores.length === 0 && <p className="text-xs text-black/40">Sin datos todavía.</p>}
            {topProveedores.map((p) => (
              <div key={p.supplier_id} className="flex justify-between text-sm py-1">
                <span>{p.nombre}</span>
                <span className="font-medium">{formatMoney(p.total, moneda)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
