"use client";

import { hoyParaguay, fechaParaguay } from "@/lib/utils/fecha";
import Link from "next/link";
import { X, HandCoins } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/utils/currency";
import type { MovimientoEnriquecido } from "@/lib/financial-engine";

const ORIGEN_LABEL: Record<string, string> = {
  manual: "Manual",
  ia_texto: "CONTROL IA",
  ia_audio: "CONTROL IA (audio)",
  ia_whatsapp: "WhatsApp",
  comprobante: "Comprobante",
};

function etiquetaFecha(fecha: string) {
  const hoy = hoyParaguay();
  const ayer = fechaParaguay(new Date(Date.now() - 86400000));
  if (fecha === hoy) return "Hoy";
  if (fecha === ayer) return "Ayer";
  return new Date(fecha).toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
}

export default function ModalDetalleMovimiento({
  mov,
  onCerrar,
  onEditar,
  onEliminar,
}: {
  mov: MovimientoEnriquecido;
  onCerrar: () => void;
  onEditar?: () => void;
  onEliminar?: () => void;
}) {
  const { moneda, mostrarSaldos } = useWorkspace();
  const esIngreso = mov.tipo === "ingreso";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" onClick={onCerrar}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 w-full md:max-w-sm max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold">Detalle del movimiento</span>
          <button onClick={onCerrar} className="p-1 text-black/40"><X size={20} /></button>
        </div>

        <div className={`text-2xl font-semibold mb-1 ${esIngreso ? "text-brand-600" : mov.tipo === "gasto" ? "text-red-500" : "text-ink"}`}>
          {esIngreso ? "+" : mov.tipo === "gasto" ? "-" : ""}{formatMoney(mov.monto, moneda, !mostrarSaldos)}
        </div>
        <div className="text-sm text-black/50 mb-4">{etiquetaFecha(mov.fecha)}</div>

        {mov.es_pago_deuda ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
              <HandCoins size={16} />
              {mov.deuda_tipo === "yo_debo" ? "Pago de deuda" : "Cobro de deuda"}
            </div>
            <Fila label="Deuda" valor={mov.deuda_nombre ?? "—"} />
            <Fila label="Persona / Entidad" valor={mov.deuda_persona ?? "—"} />
            <Fila label="Monto pagado" valor={formatMoney(mov.pago_deuda_monto ?? mov.monto, moneda, !mostrarSaldos)} />
            <Fila label="Monto original de la deuda" valor={formatMoney(mov.deuda_monto_total ?? 0, moneda, !mostrarSaldos)} />
            <Fila label="Saldo pendiente" valor={formatMoney(mov.deuda_saldo_pendiente ?? 0, moneda, !mostrarSaldos)} />
            <Fila label="Cuenta utilizada" valor={mov.cuenta ?? "—"} />
            {mov.descripcion && <Fila label="Nota" valor={mov.descripcion} />}
            <Fila label="Origen" valor={ORIGEN_LABEL[mov.origen] ?? mov.origen} />

            <Link href="/dashboard/deudas" className="btn-primary text-center mt-2" onClick={onCerrar}>
              Ver deuda completa
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Fila label="Categoría" valor={mov.categoria ?? "Sin categoría"} />
            <Fila label="Cuenta" valor={mov.cuenta ?? "—"} />
            {mov.descripcion && <Fila label="Descripción" valor={mov.descripcion} />}
            <Fila label="Origen" valor={ORIGEN_LABEL[mov.origen] ?? mov.origen} />

            {(onEditar || onEliminar) && (
              <div className="flex gap-2 mt-2">
                {onEditar && (
                  <button className="btn-secondary flex-1" onClick={onEditar}>Editar</button>
                )}
                {onEliminar && (
                  <button className="btn-secondary flex-1 !bg-red-50 !text-red-600 hover:!bg-red-100" onClick={onEliminar}>Eliminar</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-black/5 pb-2">
      <span className="text-black/40">{label}</span>
      <span className="font-medium text-right">{valor}</span>
    </div>
  );
}
