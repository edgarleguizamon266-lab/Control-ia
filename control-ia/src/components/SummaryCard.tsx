import { formatMoney } from "@/lib/utils/currency";
import { useWorkspace } from "@/lib/workspace-context";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function SummaryCard({
  titulo,
  monto,
  moneda = "PYG",
  variacion,
  colorTexto = "text-ink",
}: {
  titulo: string;
  monto: number;
  moneda?: string;
  variacion?: number; // % vs mes anterior, positivo o negativo
  colorTexto?: string;
}) {
  const { mostrarSaldos } = useWorkspace();
  return (
    <div className="card p-4">
      <div className="text-sm text-black/50">{titulo}</div>
      <div className={`text-xl font-semibold mt-1 ${colorTexto}`}>{formatMoney(monto, moneda, !mostrarSaldos)}</div>
      {typeof variacion === "number" && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${variacion >= 0 ? "text-brand-600" : "text-red-500"}`}>
          {variacion >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(variacion)}% vs. mes anterior
        </div>
      )}
    </div>
  );
}
