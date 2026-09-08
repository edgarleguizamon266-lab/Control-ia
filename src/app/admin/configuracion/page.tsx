"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseMoneyInput, formatMoney } from "@/lib/utils/currency";

type PagoQR = {
  titular: string;
  banco: string;
  cuenta: string;
  instrucciones: string;
  qr_url: string | null;
  precio_mensual: number;
};

export default function AdminConfiguracionPage() {
  const supabase = createClient();
  const [config, setConfig] = useState<PagoQR | null>(null);
  const [archivoQr, setArchivoQr] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  async function cargar() {
    const { data } = await supabase.from("system_settings").select("valor").eq("clave", "pago_qr").single();
    setConfig(data?.valor ?? null);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    if (guardando) return; // evita doble registro (doble tap / doble clic)
    if (!config) return;
    setGuardando(true);
    setGuardado(false);

    let qr_url = config.qr_url;
    if (archivoQr) {
      // El QR es un dato público (nadie financiero-privado) — vive en el bucket "branding".
      const path = `qr/${Date.now()}-${archivoQr.name}`;
      const { data: subida } = await supabase.storage.from("branding").upload(path, archivoQr, { upsert: true });
      if (subida) qr_url = supabase.storage.from("branding").getPublicUrl(subida.path).data.publicUrl;
    }

    await supabase.from("system_settings").update({ valor: { ...config, qr_url }, updated_at: new Date().toISOString() }).eq("clave", "pago_qr");

    setGuardando(false);
    setGuardado(true);
    cargar();
  }

  if (!config) return <div className="text-sm text-black/40">Cargando...</div>;

  return (
    <div className="max-w-md flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Configuración de pago (QR)</h1>
      <p className="text-sm text-black/50">Estos datos se reflejan en la app de todos los clientes al instante, sin redeploy (sección 54).</p>

      <div className="card p-5 flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Titular</label>
          <input className="input" value={config.titular} onChange={(e) => setConfig({ ...config, titular: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Banco</label>
          <input className="input" value={config.banco} onChange={(e) => setConfig({ ...config, banco: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Cuenta</label>
          <input className="input" value={config.cuenta} onChange={(e) => setConfig({ ...config, cuenta: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Instrucciones</label>
          <textarea className="input" rows={2} value={config.instrucciones} onChange={(e) => setConfig({ ...config, instrucciones: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Precio mensual</label>
          <input
            className="input"
            value={config.precio_mensual ? formatMoney(config.precio_mensual) : ""}
            onChange={(e) => setConfig({ ...config, precio_mensual: parseMoneyInput(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Imagen del QR</label>
          {config.qr_url && <img src={config.qr_url} alt="QR actual" className="w-32 h-32 object-contain border border-black/10 rounded-lg mb-2" />}
          <input type="file" accept="image/*" onChange={(e) => setArchivoQr(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>

        {guardado && <p className="text-sm text-brand-600">Guardado ✅</p>}
        <button className="btn-primary" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
