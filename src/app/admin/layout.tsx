import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Users, Receipt, Package, Settings, LineChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/pagos", label: "Pagos", icon: Receipt },
  { href: "/admin/planes", label: "Planes", icon: Package },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

// Defensa en profundidad: el middleware ya bloquea /admin a no-super_admin,
// pero volvemos a validar acá server-side (sección 8: nunca confiar solo en
// ocultar botones ni en una única capa de control de acceso).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-brand-100/60">
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-ink text-white/80 min-h-screen">
        <div className="px-5 py-6 flex items-center gap-2 text-white font-semibold">
          <LineChart className="text-brand-400" size={20} />
          CONTROL <span className="text-brand-400">IA</span>
          <span className="text-xs bg-white/10 rounded px-1.5 py-0.5 ml-1">Admin</span>
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/10 hover:text-white transition">
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-5">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/10 hover:text-white transition">
            ← Volver a la app
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
