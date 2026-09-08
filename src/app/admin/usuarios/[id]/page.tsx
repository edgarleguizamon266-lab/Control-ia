"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Calendar, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Sección 49-51 del prompt: detalle real de UN usuario específico, seleccionable
// sin importar si es el usuario 1, el 2 o el 1000 — nunca hardcodeado.
type Detalle = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  whatsapp: string | null;
  role: string;
  tipo_uso: string;
  pais: string;
  moneda_principal: string;
  created_at: string;
  ultimo_acceso: string | null;
  suscripcion_estado: string | null;
  suscripcion_plan: string | null;
  suscripcion_vencimiento: string | null;
  plan_id: string | null;
  whatsapp_conectado: boolean;
  mensajes_ia_total: number;
};

type Plan = { id: string; nombre: string };

const BADGE: Record<string, string> = {
  activo: "bg-brand-100 text-brand-700",
  trial: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-600",
  suspendido: "bg-black/10 text-black/60",
};

export default function AdminDetalleUsuarioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [diasCustom, setDiasCustom] = useState(30);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  async function cargar() {
    setCargando(true);
    const [{ data, error }, { data: planesData }] = await Promise.all([
      supabase.rpc("admin_get_user_detail", { p_user_id: params.id }).maybeSingle(),
      supabase.from("subscription_plans").select("id, nombre"),
    ]);
    if (error || !data) {
      setNoEncontrado(true);
    } else {
      setDetalle(data as Detalle);
    }
    setPlanes(planesData ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function ejecutar(accion: () => Promise<void>, textoExito: string) {
    if (procesando) return;
    setProcesando(true);
    setMensaje(null);
    await accion();
    setMensaje(textoExito);
    setProcesando(false);
    cargar();
    setTimeout(() => setMensaje(null), 3000);
  }

  const activar = () => ejecutar(async () => {
    await supabase.rpc("admin_actualizar_suscripcion", { p_user_id: params.id, p_estado: "activo", p_dias_extra: null, p_plan_id: null });
  }, "Usuario activado ✅");

  const suspender = () => ejecutar(async () => {
    await supabase.rpc("admin_actualizar_suscripcion", { p_user_id: params.id, p_estado: "suspendido", p_dias_extra: null, p_plan_id: null });
  }, "Usuario suspendido");

  const renovar30 = () => ejecutar(async () => {
    await supabase.rpc("admin_actualizar_suscripcion", { p_user_id: params.id, p_estado: "activo", p_dias_extra: 30, p_plan_id: null });
  }, "Suscripción renovada +30 días ✅");

  const agregarDiasCustom = () => ejecutar(async () => {
    await supabase.rpc("admin_actualizar_suscripcion", { p_user_id: params.id, p_estado: null, p_dias_extra: diasCustom, p_plan_id: null });
  }, `+${diasCustom} días agregados ✅`);

  const cambiarPlan = (planId: string) => ejecutar(async () => {
    await supabase.rpc("admin_actualizar_suscripcion", { p_user_id: params.id, p_estado: null, p_dias_extra: null, p_plan_id: planId });
  }, "Plan actualizado ✅");

  if (cargando) return <div className="text-sm text-black/40">Cargando usuario...</div>;

  if (noEncontrado || !detalle) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/usuarios" className="flex items-center gap-1 text-sm text-black/50"><ArrowLeft size={16} /> Volver a Usuarios</Link>
        <div className="card p-8 text-center text-black/50 text-sm">No se encontró este usuario (id: {params.id}).</div>
      </div>
    );
  }

  const badge = BADGE[detalle.suscripcion_estado ?? ""] ?? "bg-black/10 text-black/50";

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Link href="/admin/usuarios" className="flex items-center gap-1 text-sm text-black/50 w-fit"><ArrowLeft size={16} /> Volver a Usuarios</Link>

      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-semibold text-lg">{detalle.nombre} {detalle.apellido}</div>
            <div className="text-sm text-black/50">{detalle.email}</div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${badge}`}>{detalle.suscripcion_estado ?? "sin suscripción"}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div><span className="text-black/40">WhatsApp perfil:</span> {detalle.whatsapp ?? "—"}</div>
          <div className="flex items-center gap-1">
            <MessageCircle size={14} className={detalle.whatsapp_conectado ? "text-brand-600" : "text-black/30"} />
            {detalle.whatsapp_conectado ? "Conectado" : "No conectado"}
          </div>
          <div><span className="text-black/40">Registrado:</span> {new Date(detalle.created_at).toLocaleDateString("es-PY")}</div>
          <div><span className="text-black/40">Último acceso:</span> {detalle.ultimo_acceso ? new Date(detalle.ultimo_acceso).toLocaleDateString("es-PY") : "Nunca"}</div>
          <div><span className="text-black/40">Tipo de uso:</span> {detalle.tipo_uso}</div>
          <div><span className="text-black/40">País / Moneda:</span> {detalle.pais} · {detalle.moneda_principal}</div>
          <div><span className="text-black/40">Plan actual:</span> {detalle.suscripcion_plan ?? "Sin plan"}</div>
          <div><span className="text-black/40">Vencimiento:</span> {detalle.suscripcion_vencimiento ? new Date(detalle.suscripcion_vencimiento).toLocaleDateString("es-PY") : "—"}</div>
          <div><span className="text-black/40">Mensajes de IA usados:</span> {detalle.mensajes_ia_total}</div>
        </div>
        <p className="text-xs text-black/30 mt-3">
          Este panel no muestra los movimientos financieros del usuario — esa información es privada.
        </p>
      </div>

      {mensaje && <div className="text-sm bg-brand-100 text-brand-800 rounded-lg p-3">{mensaje}</div>}

      <div className="card p-5 flex flex-col gap-3">
        <div className="font-medium text-sm">Acciones de suscripción</div>
        <div className="flex gap-2 flex-wrap">
          <button disabled={procesando} onClick={activar} className="btn-primary text-sm">
            <CheckCircle2 size={14} /> Activar
          </button>
          <button disabled={procesando} onClick={suspender} className="btn-secondary text-sm !bg-amber-50 !text-amber-700">
            <XCircle size={14} /> Suspender
          </button>
          <button disabled={procesando} onClick={renovar30} className="btn-secondary text-sm">
            <Calendar size={14} /> Renovar +30 días
          </button>
        </div>

        <div className="flex items-end gap-2 pt-2 border-t border-black/5">
          <div className="flex-1">
            <label className="text-xs font-medium mb-1 block">Agregar días personalizado</label>
            <input type="number" className="input text-sm" value={diasCustom} onChange={(e) => setDiasCustom(Number(e.target.value))} />
          </div>
          <button disabled={procesando} onClick={agregarDiasCustom} className="btn-secondary text-sm">Agregar</button>
        </div>

        <div className="pt-2 border-t border-black/5">
          <label className="text-xs font-medium mb-1 block">Cambiar plan</label>
          <select
            className="input text-sm"
            value={detalle.plan_id ?? ""}
            onChange={(e) => e.target.value && cambiarPlan(e.target.value)}
            disabled={procesando}
          >
            <option value="">Seleccionar plan...</option>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
