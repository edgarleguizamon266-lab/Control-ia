"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace, WorkspaceTipo } from "@/lib/workspace-context";

export default function Header() {
  const router = useRouter();
  const supabase = createClient();
  const { seleccion, setSeleccion, tieneNegocio, nombre, mostrarSaldos, toggleMostrarSaldos, esAdmin } = useWorkspace();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const opciones: { value: WorkspaceTipo; label: string }[] = tieneNegocio
    ? [
        { value: "personal", label: "Personal" },
        { value: "negocio", label: "Negocio" },
        { value: "todos", label: "Todos" },
      ]
    : [{ value: "personal", label: "Personal" }];

  return (
    <header className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">¡Hola, {nombre || "de nuevo"}!</h1>
        <p className="text-sm text-black/50">Tu resumen financiero de hoy</p>
      </div>

      <div className="flex items-center gap-3">
        {opciones.length > 1 && (
          <div className="flex bg-brand-100 rounded-lg p-1">
            {opciones.map((op) => (
              <button
                key={op.value}
                onClick={() => setSeleccion(op.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  seleccion === op.value ? "bg-brand-600 text-white" : "text-brand-800 hover:bg-white/60"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={toggleMostrarSaldos}
          className="text-black/50 hover:text-black/80 transition p-1.5"
          title={mostrarSaldos ? "Ocultar saldos" : "Mostrar saldos"}
        >
          {mostrarSaldos ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {esAdmin && (
          <Link href="/admin" className="text-black/50 hover:text-black/80 transition p-1.5" title="Panel Admin">
            <ShieldCheck size={18} />
          </Link>
        )}

        <button
          onClick={salir}
          className="flex items-center gap-2 text-sm text-black/50 hover:text-black/80 transition px-2 py-1.5"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
