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
