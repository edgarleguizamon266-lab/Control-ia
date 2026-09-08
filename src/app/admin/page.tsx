import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/currency";

export default async function AdminResumenPage() {
  const supabase = createClient();

  const [{ count: usuariosTotales }, { count: activos }, { count: pagosPendientes }, { data: pagosMes }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("estado", "verificando"),
    supabase
      .from("payments")
      .select("monto")
      .eq("estado", "aprobado")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const ingresoMensual = (pagosMes ?? []).reduce((a, p) => a + Number(p.monto), 0);

  const tarjetas = [
    { titulo: "Usuarios totales", valor: usuariosTotales ?? 0 },
    { titulo: "Suscripciones activas", valor: activos ?? 0 },
    { titulo: "Pagos pendientes de revisar", valor: pagosPendientes ?? 0 },
    { titulo: "Ingreso este mes", valor: formatMoney(ingresoMensual) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Resumen — Panel Admin</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="card p-4">
            <div className="text-sm text-black/50">{t.titulo}</div>
            <div className="text-xl font-semibold mt-1">{t.valor}</div>
          </div>
        ))}
      </div>
      {(pagosPendientes ?? 0) > 0 && (
        <div className="card p-4 border-amber-200 bg-amber-50 text-amber-800 text-sm">
          Tenés {pagosPendientes} comprobante(s) esperando revisión en{" "}
          <a href="/admin/pagos" className="underline font-medium">Pagos</a>.
        </div>
      )}
    </div>
  );
}
