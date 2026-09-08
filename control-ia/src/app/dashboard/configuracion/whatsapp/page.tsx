"use client";

import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

type Conexion = {
  status: "not_connected" | "connecting" | "connected" | "requires_attention" | "disconnected";
  normalized_phone: string | null;
  display_name: string | null;
  last_error: string | null;
};

const ESTADO_LABEL: Record<Conexion["status"], { texto: string; color: string }> = {
  not_connected: { texto: "No conectado", color: "text-black/50" },
  connecting: { texto: "Conectando...", color: "text-amber-600" },
  connected: { texto: "✅ Conectado", color: "text-brand-600" },
  requires_attention: { texto: "⚠️ Requiere atención", color: "text-amber-600" },
  disconnected: { texto: "Desconectado", color: "text-red-500" },
};

export default function WhatsappConfigPage() {
  const supabase = createClient();
  const { workspaceActual, seleccion } = useWorkspace();
  const [conexion, setConexion] = useState<Conexion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceActual) return;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_connections")
        .select("status, normalized_phone, display_name, last_error")
        .eq("workspace_id", workspaceActual.id)
        .maybeSingle();
      setConexion(data ?? { status: "not_connected", normalized_phone: null, display_name: null, last_error: null });
      setCargando(false);
    })();
  }, [workspaceActual]); // eslint-disable-line react-hooks/exhaustive-deps

  async function conectar() {
    if (!workspaceActual) return;
    setConectando(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceActual.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      window.location.href = data.signupUrl;
    } catch {
      setError("No se pudo iniciar la conexión con WhatsApp.");
    } finally {
      setConectando(false);
    }
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para conectar su WhatsApp.</div>;
  }
  if (cargando) return <div className="text-sm text-black/40">Cargando...</div>;

  const estado = ESTADO_LABEL[conexion?.status ?? "not_connected"];

  return (
    <div className="max-w-lg flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Configuración &gt; WhatsApp</h1>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
          <MessageCircle size={22} />
        </div>
        <div>
          <div className="font-medium">Tu WhatsApp</div>
          <div className={`text-sm ${estado.color}`}>{estado.texto}</div>
          {conexion?.normalized_phone && <div className="text-xs text-black/40">{conexion.normalized_phone}</div>}
        </div>
      </div>

      {conexion?.status !== "connected" && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm text-black/60">
            Conectá tu propio número de WhatsApp mediante el flujo oficial de Meta. Vos autorizás el acceso — nunca nos
            compartís tokens ni contraseñas.
          </p>
          <button className="btn-primary w-fit" disabled={conectando} onClick={conectar}>
            {conectando ? "Abriendo..." : "Conectar mi WhatsApp"}
          </button>

          {error && (
            <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {conexion?.status === "connected" && (
        <div className="card p-5 flex items-center gap-2 text-sm text-brand-700">
          <CheckCircle2 size={16} /> Ya podés hablar con CONTROL IA desde tu propio WhatsApp.
        </div>
      )}

      <p className="text-xs text-black/40">
        Esta conexión usa el flujo oficial de Meta (WhatsApp Business Platform Embedded Signup). CONTROL IA nunca activa
        una conexión sin que Meta la confirme.
      </p>
    </div>
  );
}
