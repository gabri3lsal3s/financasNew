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

/** 12.345 -> "12,3" · 3 -> "3,0" (pt-BR, 1 casa decimal). */
export function formatPercent(value: number): string {
  return percentFormatter.format(Number.isFinite(value) ? value : 0);
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
export function formatSignedPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${signedFormatter.format(value)}%`;
}
