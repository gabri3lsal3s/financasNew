/**
 * Formatação monetária pt-BR — camada de apresentação.
 * Recebe CENTAVOS (inteiro) e devolve a string exibível ("R$ 1.500,00").
 * Usada pelo MoneyInput e por todas as telas de valores (DRY).
 * Sem importar o domínio financeiro: conversão local e formatação via Intl.
 */
const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 150000 -> "R$ 1.500,00" · 1 -> "R$ 0,01" · valores inválidos -> "R$ 0,00" */
export function formatCentsAsBRL(cents: number): string {
  const safe = Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : 0;
  return brlFormatter.format(safe / 100);
}
