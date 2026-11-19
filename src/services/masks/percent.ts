/**
 * Formatação percentual pt-BR — camada de apresentação.
 * Fonte única (DRY): antes havia `formatPercent` duplicado em delta-hint.tsx
 * e overview-page.tsx (idênticos). Recebe o valor em % e devolve a string
 * numérica exibível ("12,5" / "3"), sem o sufixo "%" (o contexto do layout
 * adiciona o símbolo quando necessário).
 */
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 12.345 -> "12,3" · 3 -> "3,0" (pt-BR, padrão 1 casa decimal). */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return fractionDigits === 2 ? "0,00" : "0,0";
  if (fractionDigits === 1) return percentFormatter.format(value).replace(".", ",");
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value).replace(".", ",");
}

const signedFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Percentual COM sinal e sufixo "%" ("+12,3%" / "-3,0%") — usado em
 * variações/rentabilidades. Fonte única (DRY): antes havia `formatPct`
 * duplicada em position-table.tsx e resumo-tab.tsx (idênticas).
 * `null` (indisponível) -> "—".
 */
export function formatSignedPct(value: number | null, fractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const formatter =
    fractionDigits === 1
      ? signedFormatter
      : new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        });
  const formatted = formatter.format(value).replace(".", ",");
  if (formatted === "-0,0" || formatted === "0,0" || formatted === "-0,00" || formatted === "0,00") {
    return fractionDigits === 2 ? "0,00%" : "0,0%";
  }
  return `${value > 0 ? "+" : ""}${formatted}%`;
}
