// Formato local paraguayo por defecto: "Gs. 150.000" (sección 63)
export function formatMoney(monto: number, moneda: string = "PYG", oculto: boolean = false) {
  if (oculto) return moneda === "PYG" ? "Gs. ••••••••" : "••••••••";
  if (moneda === "PYG") {
    const redondeado = Math.round(monto);
    return `Gs. ${redondeado.toLocaleString("es-PY")}`;
  }
  const simbolos: Record<string, string> = { USD: "US$", BRL: "R$", ARS: "AR$", EUR: "€" };
  const simbolo = simbolos[moneda] ?? moneda + " ";
  return `${simbolo} ${monto.toLocaleString("es-PY", { minimumFractionDigits: 2 })}`;
}

export function parseMoneyInput(valor: string): number {
  const limpio = valor.replace(/[^\d]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
}
