import { numberToCents } from "@/domain/money";

export interface ContributionItem {
  amount: number;
  date?: string;
}

/**
 * Soma o total de aportes em centavos inteiros.
 */
export function sumContributionsCents(contributions: readonly ContributionItem[]): number {
  let totalCents = 0;
  for (const item of contributions) {
    totalCents += numberToCents(item.amount);
  }
  return totalCents;
}

/**
 * Filtra e soma os aportes realizados em uma competência mensal (YYYY-MM).
 */
export function contributionsInMonthCents(
  contributions: readonly ContributionItem[],
  month: string,
): number {
  let totalCents = 0;
  for (const item of contributions) {
    if (item.date && item.date.startsWith(month)) {
      totalCents += numberToCents(item.amount);
    }
  }
  return totalCents;
}

/**
 * Gera a série histórica de aportes para uma lista de meses (YYYY-MM).
 */
export function contributionsMonthlySeries(
  contributions: readonly ContributionItem[],
  months: readonly string[],
): number[] {
  return months.map((m) => contributionsInMonthCents(contributions, m));
}
