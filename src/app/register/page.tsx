"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const PAISES = [
  { code: "PY", label: "Paraguay", moneda: "PYG" },
  { code: "AR", label: "Argentina", moneda: "ARS" },
  { code: "BR", label: "Brasil", moneda: "BRL" },
  { code: "US", label: "Estados Unidos", moneda: "USD" },
  { code: "OTRO", label: "Otro", moneda: "USD" },
];

const MONEDAS = ["PYG", "USD", "BRL", "ARS", "EUR"];

type TipoUso = "personal" | "negocio" | "ambos";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pais, setPais] = useState("PY");
  const [moneda, setMoneda] = useState("PYG");
  const [tipoUso, setTipoUso] = useState<TipoUso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function irAPaso2(e: React.FormEvent) {
    e.preventDefault();
    setPaso(2);
  }

  async function handleFinalizar() {
    if (!tipoUso) return;
    setError(null);
    setCargando(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          whatsapp,
          pais,
          moneda_principal: moneda,
          tipo_uso: tipoUso,
        },
      },
    });

    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-100 px-4 py-10">
      <div className="w-full max-w-md card p-8">
        <div className="text-brand-800 font-semibold text-lg mb-1">CONTROL IA</div>

        {paso === 1 && (
          <>
            <h1 className="text-xl font-semibold mb-6">Creá tu cuenta</h1>
            <form onSubmit={irAPaso2} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre</label>
                  <input required className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Apellido</label>
                  <input required className="input" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">WhatsApp</label>
                <input
                  className="input"
                  placeholder="+595 9xx xxx xxx"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Correo electrónico</label>
                <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">País</label>
                  <select
                    className="input"
                    value={pais}
                    onChange={(e) => {
                      const seleccionado = PAISES.find((p) => p.code === e.target.value);
                      setPais(e.target.value);
                      if (seleccionado) setMoneda(seleccionado.moneda);
                    }}
                  >
                    {PAISES.map((p) => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Moneda principal</label>
                  <select className="input" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary mt-2">Continuar</button>
            </form>
          </>
        )}

        {paso === 2 && (
          <>
            <h1 className="text-xl font-semibold mb-1">¿Cómo querés utilizar CONTROL IA?</h1>
            <p className="text-sm text-black/60 mb-6">Podés cambiar esto más adelante.</p>

            <div className="flex flex-col gap-3">
              {(
                [
                  { value: "personal", titulo: "Personal", desc: "Ingresos, gastos, cuentas y ahorro personal." },
                  { value: "negocio", titulo: "Negocio", desc: "Ventas, compras, proveedores y ganancias." },
                  { value: "ambos", titulo: "Personal + Negocio", desc: "Dos espacios independientes, sin mezclar." },
                ] as { value: TipoUso; titulo: string; desc: string }[]
              ).map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setTipoUso(op.value)}
                  className={`text-left rounded-xl border-2 px-4 py-3 transition ${
                    tipoUso === op.value ? "border-brand-600 bg-brand-100" : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <div className="font-medium">{op.titulo}</div>
                  <div className="text-sm text-black/60">{op.desc}</div>
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setPaso(1)}>Volver</button>
              <button
                type="button"
                disabled={!tipoUso || cargando}
                onClick={handleFinalizar}
                className="btn-primary flex-1"
              >
                {cargando ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </div>
          </>
        )}

        <p className="text-sm text-center mt-6 text-black/60">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-brand-600 font-medium">Iniciá sesión</Link>
        </p>
      </div>
    </main>
  );
}
