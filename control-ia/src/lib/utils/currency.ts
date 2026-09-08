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

// Fase 4.4: el parser es sensible a la moneda. En guaraníes (PYG) no
// se usan decimales en el uso cotidiano — el punto/coma siempre es
// separador de miles ("150.000" = ciento cincuenta mil). En monedas
// con decimales (USD, EUR, BRL, ARS), el símbolo antes de los últimos
// 1-2 dígitos se interpreta como separador DECIMAL, nunca de miles —
// así "12,50" nunca se lee como "1250".
export function parseMoneyInput(valor: string, moneda: string = "PYG"): number {
  if (moneda === "PYG") {
    const limpio = valor.replace(/[^\d]/g, "");
    return limpio ? parseInt(limpio, 10) : 0;
  }
  const soloValidos = valor.replace(/[^\d.,]/g, "");
  const match = soloValidos.match(/[.,](\d{1,2})$/);
  if (match) {
    const enteros = soloValidos.slice(0, match.index).replace(/[.,]/g, "");
    return Number(`${enteros || "0"}.${match[1]}`);
  }
  const limpio = soloValidos.replace(/[.,]/g, "");
  return limpio ? Number(limpio) : 0;
}
