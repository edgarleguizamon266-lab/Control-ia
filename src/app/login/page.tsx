"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-100 px-4">
      <div className="w-full max-w-sm card p-8">
        <div className="text-brand-800 font-semibold text-lg mb-1">CONTROL IA</div>
        <h1 className="text-xl font-semibold mb-6">Iniciar sesión</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Correo electrónico</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Contraseña</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={cargando} className="btn-primary mt-2">
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-black/60">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="text-brand-600 font-medium">
            Creá una acá
          </Link>
        </p>
      </div>
    </main>
  );
}
