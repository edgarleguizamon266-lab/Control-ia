import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================
// Los comprobantes (gastos, pagos de suscripción) viven en el bucket
// PRIVADO "comprobantes" (migration_016 — antes era público, hallazgo
// de seguridad real corregido). Nunca usar getPublicUrl() acá: el
// acceso es siempre por URL firmada temporal, generada bajo demanda,
// solo para el dueño del archivo o un super_admin (según las policies
// de storage.objects).
// =========================================================

const SEGUNDOS_VALIDEZ_DEFAULT = 60 * 10; // 10 minutos, alcanza para ver/confirmar una imagen

export async function subirComprobante(supabase: SupabaseClient, userId: string, archivo: File): Promise<string | null> {
  const path = `${userId}/${Date.now()}-${archivo.name}`;
  const { data, error } = await supabase.storage.from("comprobantes").upload(path, archivo);
  if (error || !data) return null;
  return data.path; // se guarda el PATH en la base, nunca una URL pública
}

export async function obtenerUrlFirmadaComprobante(
  supabase: SupabaseClient,
  path: string,
  segundosValidez = SEGUNDOS_VALIDEZ_DEFAULT
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, segundosValidez);
  if (error || !data) return null;
  return data.signedUrl;
}
