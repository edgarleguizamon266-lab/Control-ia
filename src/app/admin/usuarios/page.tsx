"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  whatsapp: string | null;
  role: string;
  tipo_uso: string;
  created_at: string;
  last_sign_in_at: string | null;
  estado: string | null;
  fecha_fin: string | null;
};

const BADGE: Record<string, string> = {
  activo: "bg-brand-100 text-brand-700",
  trial: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-600",
  suspendido: "bg-black/10 text-black/60",
};

export default function AdminUsuariosPage() {
  const supabase = createClient();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (!error) setUsuarios(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function actualizar(userId: string, estado?: string, diasExtra?: number) {
    await supabase.rpc("admin_actualizar_suscripcion", {
      p_user_id: userId,
      p_estado: estado ?? null,
      p_dias_extra: diasExtra ?? null,
      p_plan_id: null,
    });
    cargar();
  }

  const filtrados = usuarios.filter((u) => {
    if (!busqueda) return true;
    const texto = `${u.nombre} ${u.apellido} ${u.email} ${u.whatsapp ?? ""}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuarios</h1>
        <input className="input max-w-xs" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/40 border-b border-black/5">
              <th className="p-3 font-medium">Nombre</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">WhatsApp</th>
              <th className="p-3 font-medium">Plan/Estado</th>
              <th className="p-3 font-medium">Vencimiento</th>
              <th className="p-3 font-medium">Último acceso</th>
              <th className="p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={7} className="p-4 text-center text-black/40">Cargando...</td></tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-black/40">Sin resultados.</td></tr>
            )}
            {filtrados.map((u) => (
              <tr
                key={u.id}
                className="border-b border-black/5 last:border-0 cursor-pointer hover:bg-brand-100/40"
                onClick={() => router.push(`/admin/usuarios/${u.id}`)}
              >
                <td className="p-3">{u.nombre} {u.apellido}{u.role === "super_admin" && <span className="ml-1 text-xs text-brand-600">(admin)</span>}</td>
                <td className="p-3 text-black/60">{u.email}</td>
                <td className="p-3 text-black/60">{u.whatsapp ?? "—"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE[u.estado ?? ""] ?? "bg-black/10 text-black/50"}`}>
                    {u.estado ?? "sin suscripción"}
                  </span>
                </td>
                <td className="p-3 text-black/60">{u.fecha_fin ? new Date(u.fecha_fin).toLocaleDateString("es-PY") : "—"}</td>
                <td className="p-3 text-black/60">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("es-PY") : "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <button className="text-xs text-brand-600 hover:underline" onClick={() => actualizar(u.id, "activo")}>Activar</button>
                    <button className="text-xs text-amber-600 hover:underline" onClick={() => actualizar(u.id, "suspendido")}>Suspender</button>
                    <button className="text-xs text-black/60 hover:underline" onClick={() => actualizar(u.id, undefined, 30)}>+30 días</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-black/40">Las contraseñas nunca son visibles ni accesibles desde este panel.</p>
    </div>
  );
}
