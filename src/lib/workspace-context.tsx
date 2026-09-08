"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type WorkspaceTipo = "personal" | "negocio" | "todos";

export type Workspace = {
  id: string;
  tipo: "personal" | "negocio";
  nombre: string;
};

type WorkspaceContextValue = {
  seleccion: WorkspaceTipo;
  setSeleccion: (t: WorkspaceTipo) => void;
  workspaces: Workspace[];
  workspaceActual: Workspace | null; // null cuando seleccion === "todos"
  tieneNegocio: boolean;
  cargando: boolean;
  nombre: string;
  moneda: string;
  esAdmin: boolean;
  mostrarSaldos: boolean;
  toggleMostrarSaldos: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [seleccion, setSeleccionState] = useState<WorkspaceTipo>("personal");
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [moneda, setMoneda] = useState("PYG");
  const [esAdmin, setEsAdmin] = useState(false);
  const [mostrarSaldos, setMostrarSaldos] = useState(true);

  useEffect(() => {
    const ocultos = typeof window !== "undefined" ? window.localStorage.getItem("ci_ocultar_saldos") : null;
    if (ocultos === "1") setMostrarSaldos(false);
  }, []);

  const toggleMostrarSaldos = useCallback(() => {
    setMostrarSaldos((v) => {
      const nuevo = !v;
      if (typeof window !== "undefined") window.localStorage.setItem("ci_ocultar_saldos", nuevo ? "0" : "1");
      return nuevo;
    });
  }, []);

  useEffect(() => {
    const guardado = typeof window !== "undefined" ? window.localStorage.getItem("ci_workspace") : null;
    if (guardado === "personal" || guardado === "negocio" || guardado === "todos") {
      setSeleccionState(guardado);
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCargando(false);
        return;
      }

      const [{ data: ws }, { data: profile }] = await Promise.all([
        supabase.from("workspaces").select("id, tipo, nombre").eq("user_id", user.id),
        supabase.from("profiles").select("nombre, moneda_principal, role").eq("id", user.id).single(),
      ]);

      setWorkspaces(ws ?? []);
      if (profile) {
        setNombre(profile.nombre ?? "");
        setMoneda(profile.moneda_principal ?? "PYG");
        setEsAdmin(profile.role === "super_admin");
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSeleccion = useCallback((t: WorkspaceTipo) => {
    setSeleccionState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("ci_workspace", t);
  }, []);

  const workspaceActual =
    seleccion === "todos" ? null : workspaces.find((w) => w.tipo === seleccion) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        seleccion,
        setSeleccion,
        workspaces,
        workspaceActual,
        tieneNegocio: workspaces.some((w) => w.tipo === "negocio"),
        cargando,
        nombre,
        moneda,
        esAdmin,
        mostrarSaldos,
        toggleMostrarSaldos,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return ctx;
}
