"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";

type Mensaje = { rol: "usuario" | "ia"; texto: string };

const SUGERENCIAS = [
  "Gasté 85 mil en supermercado",
  "¿Cuánto gasté hoy?",
  "¿Cuánto tengo?",
  "Analizar este mes",
  "¿En qué gasto más?",
];

export default function IaPage() {
  const { workspaceActual, seleccion, moneda } = useWorkspace();
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "ia", texto: "Hola 👋 Soy tu asistente de CONTROL IA. Contame qué gastaste, ganaste, o preguntame por tus números." },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [historialApi, setHistorialApi] = useState<any[]>([]);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(msg?: string) {
    const contenido = (msg ?? texto).trim();
    if (!contenido || !workspaceActual) return;

    setMensajes((m) => [...m, { rol: "usuario", texto: contenido }]);
    setTexto("");
    setEnviando(true);

    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: contenido,
          historial: historialApi,
          workspace_id: workspaceActual.id,
          workspace_tipo: workspaceActual.tipo,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMensajes((m) => [...m, { rol: "ia", texto: data.error }]);
      } else {
        let texto = data.respuesta || "Listo.";
        const a = data.accion;
        if (a?.tipo === "transaccion_creada") {
          texto = `✅ Registré tu ${a.tipoMovimiento}.\n\n${formatMoney(a.monto, a.moneda)}\n${a.categoria}\n${a.cuenta}\n\n${data.respuesta ?? ""}`;
        } else if (a?.tipo === "deuda_creada") {
          texto = `✅ Registré ${a.tipoDeuda === "yo_debo" ? "que debés" : "que te deben"} ${formatMoney(a.monto)} — ${a.persona}.\n\n${data.respuesta ?? ""}`;
        } else if (a?.tipo === "venta_creada") {
          texto = `✅ Registré la venta${a.producto ? ` de ${a.producto}` : ""} por ${formatMoney(a.monto)}.\n\n${data.respuesta ?? ""}`;
        } else if (a?.tipo === "transaccion_actualizada") {
          texto = `✅ Actualicé el movimiento a ${formatMoney(a.monto)}.\n\n${data.respuesta ?? ""}`;
        } else if (a?.tipo === "transaccion_eliminada") {
          texto = `✅ Eliminé el movimiento.\n\n${data.respuesta ?? ""}`;
        }
        setMensajes((m) => [...m, { rol: "ia", texto }]);
        setHistorialApi(data.historial ?? []);
      }
    } catch {
      setMensajes((m) => [...m, { rol: "ia", texto: "Hubo un problema de conexión. Intentá de nuevo." }]);
    } finally {
      setEnviando(false);
    }
  }

  if (seleccion === "todos") {
    return <div className="card p-6 text-sm text-black/60">Elegí "Personal" o "Negocio" para hablar con la IA de ese espacio.</div>;
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[calc(100vh-160px)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center">
          <Bot size={18} />
        </div>
        <div>
          <div className="font-medium text-sm">Asistente CONTROL IA</div>
          <div className="text-xs text-brand-600">En línea</div>
        </div>
      </div>

      <div className="flex-1 card p-4 overflow-y-auto flex flex-col gap-3">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] whitespace-pre-line text-sm px-3 py-2 rounded-xl ${
              m.rol === "usuario" ? "self-end bg-brand-600 text-white" : "self-start bg-brand-100 text-ink"
            }`}
          >
            {m.texto}
          </div>
        ))}
        {enviando && <div className="self-start text-xs text-black/40">Escribiendo...</div>}
        <div ref={finRef} />
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        {SUGERENCIAS.map((s) => (
          <button key={s} onClick={() => enviar(s)} className="text-xs bg-white border border-black/10 rounded-full px-3 py-1.5 hover:border-brand-500">
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <input
          className="input"
          placeholder="Escribí un mensaje..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />
        <button onClick={() => enviar()} disabled={enviando} className="btn-primary px-4">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
