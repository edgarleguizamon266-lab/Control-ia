"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils/currency";

type Pago = {
  id: string;
  user_id: string;
  monto: number;
  banco: string | null;
  numero_operacion: string | null;
  comprobante_url: string | null;
  estado: "verificando" | "aprobado" | "rechazado";
  created_at: string;
};

export default function AdminPagosPage() {
  const supabase = createClient();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [nombresPorUsuario, setNombresPorUsuario] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data: pendientes } = await supabase
      .from("payments")
      .select("id, user_id, monto, banco, numero_operacion, comprobante_url, estado, created_at")
      .order("created_at", { ascending: false });

    setPagos(pendientes ?? []);

    const ids = Array.from(new Set((pendientes ?? []).map((p) => p.user_id)));
    if (ids.length > 0) {
      const { data: perfiles } = await supabase.from("profiles").select("id, nombre, apellido").in("id", ids);
      const mapa: Record<string, string> = {};
      for (const p of perfiles ?? []) mapa[p.id] = `${p.nombre} ${p.apellido}`;
      setNombresPorUsuario(mapa);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aprobar(id: string) {
    if (procesando) return;
    if (!confirm("¿Aprobar este pago y renovar la suscripción del usuario?")) return;
    setProcesando(id);
    await supabase.rpc("admin_aprobar_pago", { p_payment_id: id, p_dias: 30 });
    setProcesando(null);
    cargar();
  }

  async function rechazar(id: string) {
    if (procesando) return;
    if (!confirm("¿Rechazar este comprobante?")) return;
    setProcesando(id);
    await supabase.rpc("admin_rechazar_pago", { p_payment_id: id });
    setProcesando(null);
    cargar();
  }

  const pendientes = pagos.filter((p) => p.estado === "verificando");
  const resueltos = pagos.filter((p) => p.estado !== "verificando").slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Pagos pendientes</h1>

      <div className="flex flex-col gap-3">
        {cargando && <div className="card p-6 text-sm text-black/40 text-center">Cargando...</div>}
        {!cargando && pendientes.length === 0 && (
          <div className="card p-6 text-sm text-black/40 text-center">No hay comprobantes pendientes de revisión. 🎉</div>
        )}
        {pendientes.map((p) => (
          <div key={p.id} className="card p-4 flex flex-col md:flex-row gap-4 md:items-center">
            {p.comprobante_url && (
              <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={p.comprobante_url} alt="Comprobante" className="w-24 h-24 object-cover rounded-lg border border-black/10" />
              </a>
            )}
            <div className="flex-1">
              <div className="font-medium text-sm">{nombresPorUsuario[p.user_id] ?? p.user_id}</div>
              <div className="text-sm text-black/50">
                {formatMoney(p.monto)} · {new Date(p.created_at).toLocaleString("es-PY")}
              </div>
              {p.numero_operacion && <div className="text-xs text-black/40">Operación: {p.numero_operacion}</div>}
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary text-sm"
                disabled={procesando === p.id}
                onClick={() => aprobar(p.id)}
              >
                Aprobar
              </button>
              <button
                className="btn-secondary text-sm !bg-red-50 !text-red-600 hover:!bg-red-100"
                disabled={procesando === p.id}
                onClick={() => rechazar(p.id)}
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>

      {resueltos.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-black/50 mt-2">Historial reciente</h2>
          <div className="card divide-y divide-black/5">
            {resueltos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{nombresPorUsuario[p.user_id] ?? p.user_id} · {formatMoney(p.monto)}</span>
                <span className={p.estado === "aprobado" ? "text-brand-600" : "text-red-500"}>
                  {p.estado === "aprobado" ? "✅ Aprobado" : "❌ Rechazado"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
