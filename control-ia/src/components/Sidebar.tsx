"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  PiggyBank,
  Target,
  HandCoins,
  BarChart3,
  Store,
  Settings,
  LineChart,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/dashboard/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/dashboard/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/dashboard/presupuestos", label: "Presupuestos", icon: PiggyBank },
  { href: "/dashboard/metas", label: "Metas", icon: Target },
  { href: "/dashboard/deudas", label: "Deudas", icon: HandCoins },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { tieneNegocio } = useWorkspace();

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-brand-950 text-white/80 min-h-screen">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2 text-white font-semibold text-lg">
          <LineChart className="text-brand-400" size={22} />
          CONTROL <span className="text-brand-400">IA</span>
        </div>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1">
        {ITEMS.map((item) => {
          const activo = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                activo ? "bg-brand-800 text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {tieneNegocio && (
          <Link
            href="/dashboard/negocio"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              pathname === "/dashboard/negocio" ? "bg-brand-800 text-white" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Store size={18} />
            Mi Negocio
          </Link>
        )}
      </nav>

      <div className="px-3 pb-5">
        <Link
          href="/dashboard/configuracion/whatsapp"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
            pathname === "/dashboard/configuracion/whatsapp" ? "bg-brand-800 text-white" : "hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings size={18} />
          WhatsApp
        </Link>
        <Link
          href="/dashboard/suscripcion"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
            pathname === "/dashboard/suscripcion" ? "bg-brand-800 text-white" : "hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings size={18} />
          Suscripción
        </Link>
      </div>
    </aside>
  );
}
