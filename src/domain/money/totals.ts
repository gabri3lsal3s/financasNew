import { numberToCents } from "./parse";

/**
 * Item transacional com valor nominal (em reais).
 */
export interface TransactionValueItem {
  value: number;
}

/**
 * Item transacional com valor nominal e ponderação opcional de relatório (0 a 1).
 */
export interface TransactionWeightedItem {
  value: number;
  report_weight?: number | null;
}

/**
 * Soma o valor bruto nominal de itens transacionais em centavos inteiros.
 */
export function sumGrossCents(items: readonly TransactionValueItem[]): number {
  let sum = 0;
  for (const item of items) {
    sum += numberToCents(item.value);
  }
  return sum;
}

/**
 * Soma o valor ponderado de itens transacionais em centavos inteiros (peso de relatório 0 a 1).
 * Itens sem report_weight têm peso unitário padrão (1).
 */
export function sumWeightedCents(items: readonly TransactionWeightedItem[]): number {
  let sum = 0;
  for (const item of items) {
    const weight = typeof item.report_weight === "number" && Number.isFinite(item.report_weight)
      ? Math.max(0, item.report_weight)
      : 1;
    sum += numberToCents(item.value * weight);
  }
  return sum;
}
