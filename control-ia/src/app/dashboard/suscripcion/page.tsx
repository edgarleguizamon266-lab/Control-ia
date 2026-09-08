"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subirComprobante } from "@/lib/supabase/comprobantes";
import { formatMoney } from "@/lib/utils/currency";

type Suscripcion = { estado: string; fecha_fin: string | null };
type PagoQR = { titular: string; banco: string; cuenta: string; instrucciones: string; qr_url: string | null; precio_mensual: number };

export default function SuscripcionPage() {
  const supabase = createClient();
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [configQr, setConfigQr] = useState<PagoQR | null>(null);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: sub }, { data: settings }] = await Promise.all([
        supabase.from("subscriptions").select("estado, fecha_fin").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("system_settings").select("valor").eq("clave", "pago_qr").maybeSingle(),
      ]);
      setSuscripcion(sub);
      setConfigQr(settings?.valor ?? null);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmarPago() {
    if (subiendo) return;
    if (!comprobante) return;
    setSubiendo(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const comprobante_url = await subirComprobante(supabase, user.id, comprobante);

    await supabase.from("payments").insert({
      user_id: user.id,
      monto: configQr?.precio_mensual ?? 0,
      comprobante_url,
      estado: "verificando",
    });

    setSubiendo(false);
    setEnviado(true);
  }

  const estado = suscripcion?.estado ?? "trial";
  const badge =
    estado === "activo"
      ? { texto: "🟢 Activo", color: "text-brand-600" }
      : estado === "vencido" || estado === "suspendido"
      ? { texto: "🔴 " + (estado === "vencido" ? "Vencido" : "Suspendido"), color: "text-red-500" }
      : { texto: "🟡 Prueba", color: "text-amber-600" };

  return (
    <div className="max-w-lg flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Mi suscripción</h1>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium">CONTROL IA</div>
          <span className={`text-sm font-medium ${badge.color}`}>{badge.texto}</span>
        </div>
        {suscripcion?.fecha_fin && (
          <div className="text-sm text-black/50">Vence: {new Date(suscripcion.fecha_fin).toLocaleDateString("es-PY")}</div>
        )}
        <ul className="text-sm text-black/60 mt-3 flex flex-col gap-1">
          <li>✔ Acceso completo</li>
          <li>✔ IA por WhatsApp (cuando esté conectado)</li>
          <li>✔ Reportes avanzados</li>
        </ul>
      </div>

      {!mostrarPago && !enviado && configQr && (
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-medium">Renovar CONTROL IA</div>
          <div className="text-2xl font-semibold">{formatMoney(configQr.precio_mensual)} / mes</div>
          <button className="btn-primary" onClick={() => setMostrarPago(true)}>Ya pagué</button>
        </div>
      )}

      {mostrarPago && !enviado && configQr && (
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-medium">Subí tu comprobante</div>
          {configQr.qr_url && <img src={configQr.qr_url} alt="QR de pago" className="w-40 h-40 object-contain self-center" />}
          <p className="text-sm text-black/50">
            {configQr.instrucciones}
            {configQr.titular && ` Titular: ${configQr.titular}.`}
            {configQr.banco && ` Banco: ${configQr.banco}.`}
          </p>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setComprobante(e.target.files?.[0] ?? null)} className="text-sm" />
          <button className="btn-primary" disabled={!comprobante || subiendo} onClick={confirmarPago}>
            {subiendo ? "Enviando..." : "Enviar comprobante"}
          </button>
        </div>
      )}

      {enviado && (
        <div className="card p-5 text-sm text-amber-600">
          🟡 Verificando pago. Un administrador va a revisar tu comprobante — no se activa automáticamente solo por subir la imagen.
        </div>
      )}
    </div>
  );
}
