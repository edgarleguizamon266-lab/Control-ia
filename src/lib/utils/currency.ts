// =========================================================
// FASE 4.1 — "Hoy" siempre según el calendario de Paraguay.
//
// El servidor (Vercel) corre en UTC. `new Date().toISOString()` y los
// getters locales (.getMonth(), .getDate(), etc.) en ese entorno
// devuelven la fecha en UTC, no en Asunción — durante la noche
// paraguaya (después de las ~20:00, según la época del año) esto
// podía registrar un gasto de "hoy" con la fecha de "mañana", y
// "este mes" podía cambiar de mes unas horas antes de tiempo.
//
// Esta es la ÚNICA fuente de verdad para "qué día es hoy" en toda la
// app — nunca usar new Date().toISOString().slice(0,10) directamente.
// =========================================================

const ZONA_PARAGUAY = "America/Asuncion";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partesFechaParaguay(momento: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_PARAGUAY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(momento);
  const obj: Record<string, string> = {};
  for (const p of partes) obj[p.type] = p.value;
  return { anio: Number(obj.year), mes: Number(obj.month), dia: Number(obj.day) };
}

/** "YYYY-MM-DD" del día actual en Paraguay. Reemplaza siempre a new Date().toISOString().slice(0,10). */
export function hoyParaguay(): string {
  const { anio, mes, dia } = partesFechaParaguay();
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

/** "YYYY-MM-DD" de un momento específico, interpretado en la zona de Paraguay. */
export function fechaParaguay(momento: Date): string {
  const { anio, mes, dia } = partesFechaParaguay(momento);
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

/** Rango [desde, hasta] para "este mes", "mes pasado" o "esta semana", según el calendario real de Paraguay. */
export function rangoPeriodoParaguay(periodo: "este_mes" | "mes_pasado" | "esta_semana"): { desde: string; hasta: string } {
  const { anio, mes, dia } = partesFechaParaguay();
  const hoyStr = `${anio}-${pad(mes)}-${pad(dia)}`;

  if (periodo === "mes_pasado") {
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;
    const ultimoDia = new Date(Date.UTC(anioAnterior, mesAnterior, 0)).getUTCDate();
    return { desde: `${anioAnterior}-${pad(mesAnterior)}-01`, hasta: `${anioAnterior}-${pad(mesAnterior)}-${pad(ultimoDia)}` };
  }

  if (periodo === "esta_semana") {
    const diaSemana = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_PARAGUAY, weekday: "short" }).format(new Date());
    const indice: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const offset = indice[diaSemana] ?? 0;
    const lunes = new Date(Date.UTC(anio, mes - 1, dia - offset));
    return { desde: `${lunes.getUTCFullYear()}-${pad(lunes.getUTCMonth() + 1)}-${pad(lunes.getUTCDate())}`, hasta: hoyStr };
  }

  return { desde: `${anio}-${pad(mes)}-01`, hasta: hoyStr };
}

/** Primer día del mes actual y hoy, en Paraguay — usado por Dashboard/Reportes/Negocio. */
export function primerYUltimoDiaDelMesParaguay(): { desde: string; hasta: string } {
  return rangoPeriodoParaguay("este_mes");
}
