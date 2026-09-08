"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  MessageSquareText,
  Menu,
  X,
  Wallet,
  CreditCard,
  PiggyBank,
  Target,
  HandCoins,
  BarChart3,
  Store,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Navegación para celular: antes NO existía ninguna (el sidebar era
// "hidden md:flex" — invisible en mobile), dejando inalcanzables
// Cuentas, Tarjetas, Metas, Deudas, Negocio y Configuración desde el
// teléfono. Esto corrige ese hallazgo de UX real.
export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { tieneNegocio, esAdmin } = useWorkspace();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const TABS_PRINCIPALES = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/dashboard/movimientos", label: "Movs.", icon: ArrowLeftRight },
    { href: "/dashboard/ia", label: "IA", icon: MessageSquareText },
  ];

  const GRUPOS_SECCIONES: { titulo: string; items: { href: string; label: string; icon: typeof Wallet }[] }[] = [
    {
      titulo: "Finanzas",
      items: [
        { href: "/dashboard/cuentas", label: "Cuentas", icon: Wallet },
        { href: "/dashboard/tarjetas", label: "Tarjetas", icon: CreditCard },
        { href: "/dashboard/presupuestos", label: "Presupuestos", icon: PiggyBank },
        { href: "/dashboard/metas", label: "Metas", icon: Target },
        { href: "/dashboard/deudas", label: "Deudas", icon: HandCoins },
        { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
      ],
    },
    ...(tieneNegocio
      ? [
          {
            titulo: "Negocio",
            items: [
              { href: "/dashboard/negocio", label: "Mi Negocio", icon: Store },
              { href: "/dashboard/negocio/clientes", label: "Clientes", icon: Wallet },
              { href: "/dashboard/negocio/proveedores", label: "Proveedores", icon: Wallet },
            ],
          },
        ]
      : []),
    {
      titulo: "CONTROL IA",
      items: [
        { href: "/dashboard/ia", label: "Asistente", icon: MessageSquareText },
        { href: "/dashboard/configuracion/whatsapp", label: "WhatsApp", icon: Settings },
        { href: "/dashboard/movimientos/nuevo?comprobante=1", label: "Comprobantes", icon: Settings },
      ],
    },
    {
      titulo: "Cuenta",
      items: [
        { href: "/dashboard/suscripcion", label: "Suscripción", icon: Settings },
        ...(esAdmin ? [{ href: "/admin", label: "Panel Admin", icon: ShieldCheck }] : []),
      ],
    },
  ];

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra fija inferior — solo en mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 flex items-center justify-around px-2 py-1.5 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS_PRINCIPALES.map((tab) => {
          const activo = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${activo ? "text-brand-600" : "text-black/50"}`}>
              <Icon size={22} />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMenuAbierto(true)} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-black/50">
          <Menu size={22} />
          <span className="text-[11px] font-medium">Más</span>
        </button>
      </nav>

      {/* Espaciador para que el contenido no quede tapado por la barra fija */}
      <div className="md:hidden h-16" />

      {/* Menú "Más" — todas las secciones */}
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMenuAbierto(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Todas las secciones</span>
              <button onClick={() => setMenuAbierto(false)} className="p-1.5 text-black/40">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {GRUPOS_SECCIONES.map((grupo) => (
                <div key={grupo.titulo}>
                  <div className="text-xs font-medium text-black/40 mb-2 uppercase tracking-wide">{grupo.titulo}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {grupo.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuAbierto(false)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-brand-100/60 text-center"
                        >
                          <Icon size={20} className="text-brand-600" />
                          <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={salir} className="flex items-center justify-center gap-2 w-full mt-4 p-3 rounded-xl text-red-500 text-sm font-medium border border-red-100">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );
}
