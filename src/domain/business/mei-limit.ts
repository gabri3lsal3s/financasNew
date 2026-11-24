/**
 * Motor puro do Termômetro Anual do MEI (Fase 2B).
 *
 * Apurado estritamente por Faturamento Bruto Recebido no ano civil
 * (`incomes` com `scope === 'business' && !is_internal_transfer`).
 * Marcos de alerta: 70% (atenção), 85% (alerta), 100% (teto) e 120% (tolerância).
 */

import { sumWeightedCents } from "@/domain/money";
import type { TransactionScope } from "@/types";

export const DEFAULT_MEI_ANNUAL_CEILING_CENTS = 8_100_000; // R$ 81.000,00 (parametrizável)

export type MeiCeilingAlertLevel =
  | "safe"
  | "attention"
  | "warning"
  | "ceiling_reached"
  | "tolerance_exceeded";

export interface MeiIncomeInput {
  value: number;
  date: string;
  scope?: TransactionScope | null;
  is_internal_transfer?: boolean | null;
}

export interface MeiAnnualLimitResult {
  annualGrossRevenueCents: number;
  annualCeilingCents: number;
  toleranceCeilingCents: number;
  usagePct: number;
  remainingCents: number;
  monthlySafePaceCents: number;
  remainingMonths: number;
  alertLevel: MeiCeilingAlertLevel;
}

export function calculateMeiAnnualLimit(params: {
  annualIncomes: readonly MeiIncomeInput[];
  annualCeilingCents?: number;
  /** Índice do mês atual (1..12). Se omitido, assume 1. */
  currentMonthIndex?: number;
  /** Ano civil opcional (YYYY) para filtrar incomes se misturados. */
  year?: number;
}): MeiAnnualLimitResult {
  const annualCeilingCents = Math.max(
    1,
    Math.round(params.annualCeilingCents ?? DEFAULT_MEI_ANNUAL_CEILING_CENTS),
  );
  const toleranceCeilingCents = Math.round(annualCeilingCents * 1.2);
  const currentMonth = Math.min(12, Math.max(1, Math.round(params.currentMonthIndex ?? 1)));
  const remainingMonths = Math.max(1, 13 - currentMonth);

  const yearPrefix = params.year != null ? `${params.year}-` : null;

  const eligibleIncomes = params.annualIncomes
    .filter((i) => {
      if ((i.scope ?? "personal") !== "business") return false;
      if (i.is_internal_transfer) return false;
      if (yearPrefix && !i.date.startsWith(yearPrefix)) return false;
      return true;
    })
    .map((i) => ({ value: i.value, report_weight: 1 }));

  const annualGrossRevenueCents = sumWeightedCents(eligibleIncomes);
  const usagePct = Number(((annualGrossRevenueCents / annualCeilingCents) * 100).toFixed(2));
  const remainingCents = Math.max(0, annualCeilingCents - annualGrossRevenueCents);
  const monthlySafePaceCents = Math.floor(remainingCents / remainingMonths);

  let alertLevel: MeiCeilingAlertLevel = "safe";
  if (usagePct >= 120) {
    alertLevel = "tolerance_exceeded";
  } else if (usagePct >= 100) {
    alertLevel = "ceiling_reached";
  } else if (usagePct >= 85) {
    alertLevel = "warning";
  } else if (usagePct >= 70) {
    alertLevel = "attention";
  }

  return {
    annualGrossRevenueCents,
    annualCeilingCents,
    toleranceCeilingCents,
    usagePct,
    remainingCents,
    monthlySafePaceCents,
    remainingMonths,
    alertLevel,
  };
}
