/**
 * Peso de relatório — ESPECIFICAÇÃO §2/§3.
 *
 * O `report_weight` (0–1, default 1) ajusta quanto de um lançamento entra
 * nos relatórios (ex.: despesa de R$ 100 com peso 0,5 conta R$ 50). O
 * `base_amount` preserva o valor original para auditoria (schema §2).
 *
 * Motor puro — testável isoladamente.
 */

/** Valor efetivo de um lançamento em centavos (base × peso, arredondado). */
export function weightedCents(baseCents: number, reportWeight: number): number {
  if (reportWeight < 0 || reportWeight > 1) {
    throw new Error("Peso de relatório deve estar entre 0 e 1.");
  }
  return Math.round(baseCents * reportWeight);
}

/** Soma ponderada de vários lançamentos (para relatórios por categoria). */
export function weightedSum(entries: readonly { baseCents: number; weight: number }[]): number {
  return entries.reduce((acc, entry) => acc + weightedCents(entry.baseCents, entry.weight), 0);
}
