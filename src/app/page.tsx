import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-brand-950 text-white flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="text-brand-400 text-sm tracking-wide">CONTROL IA</div>
      <h1 className="text-4xl md:text-5xl font-semibold max-w-xl">Tu dinero. Bajo control.</h1>
      <p className="text-white/70 max-w-md">
        Registrá tus gastos hablando, escribiendo o enviando un comprobante. La IA se encarga del resto.
      </p>
      <div className="flex gap-3">
        <Link href="/register" className="btn-primary">Probar CONTROL IA</Link>
        <Link href="/login" className="btn-secondary !bg-white/10 !text-white hover:!bg-white/20">Iniciar sesión</Link>
      </div>
    </main>
  );
}
