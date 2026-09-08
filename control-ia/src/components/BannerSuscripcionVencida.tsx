"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Fase 2.2: un usuario vencido NUNCA pierde acceso a sus datos ni se
// bloquea de golpe — solo ve este aviso persistente. El estado se
// calcula siempre server-side (fn_mi_suscripcion), nunca se confía en
// un campo local que pudo quedar desactualizado.
export default function BannerSuscripcionVencida() {
  const supabase = createClient();
  const [vencida, setVencida] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("fn_mi_suscripcion").maybeSingle();
      setVencida((data as any)?.estado === "vencido");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vencida) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <AlertTriangle size={16} className="shrink-0" />
        <span>Tu suscripción venció. Tus datos siguen seguros — podés seguir usando CONTROL IA.</span>
      </div>
      <Link href="/dashboard/suscripcion" className="text-sm font-medium text-amber-800 underline shrink-0">
        Renovar CONTROL IA
      </Link>
    </div>
  );
}
