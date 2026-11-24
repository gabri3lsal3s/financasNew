/**
 * Motor puro de Escudo Tributário Líquido (Fase 2B).
 *
 * Calcula a provisão recomendada de imposto para o negócio (DAS fixo no perfil MEI
 * ou percentual sobre faturamento bruto para Liberal / Microempresa) e abate apenas os
 * impostos fiscais efetivamente pagos (`isBusinessFiscalTaxExpense`), garantindo que
 * IOF de cartão jamais reduza a provisão devida ao Fisco.
 */

import { sumWeightedCents } from "@/domain/money";
import type { BusinessProfileKind } from "@/types";
import { isBusinessFiscalTaxExpense, type DreExpenseInput } from "./dre-calculator";

export const DEFAULT_MEI_MONTHLY_DAS_CENTS = 7_590; // R$ 75,90 (referência parametrizável)
export const DEFAULT_TAX_PROVISION_RATE_PCT = 6;

export interface TaxShieldExpenseInput extends DreExpenseInput {
  is_tax_deductible?: boolean | null;
}

export interface TaxShieldResult {
  estimatedTaxCents: number;
  paidFiscalTaxesCents: number;
  netProvisionRemainingCents: number;
  coveragePct: number;
  isFullyCovered: boolean;
  deductibleExpensesCents: number;
}

export function calculateTaxShield(params: {
  profileKind: BusinessProfileKind;
  grossRevenueCents: number;
  expenses: readonly TaxShieldExpenseInput[];
  monthlyDasCents?: number;
  taxProvisionRatePct?: number;
}): TaxShieldResult {
  const safeRevenue = Math.max(0, Math.round(params.grossRevenueCents));
  const monthlyDasCents = Math.max(0, Math.round(params.monthlyDasCents ?? DEFAULT_MEI_MONTHLY_DAS_CENTS));
  const ratePct = Math.max(0, params.taxProvisionRatePct ?? DEFAULT_TAX_PROVISION_RATE_PCT);

  const estimatedTaxCents =
    params.profileKind === "mei"
      ? monthlyDasCents
      : Math.round((safeRevenue * ratePct) / 100);

  const paidFiscalTaxesCents = sumWeightedCents(
    params.expenses
      .filter((e) => isBusinessFiscalTaxExpense(e))
      .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 })),
  );

  const netProvisionRemainingCents = Math.max(0, estimatedTaxCents - paidFiscalTaxesCents);
  const coveragePct =
    estimatedTaxCents > 0
      ? Math.min(100, Number(((paidFiscalTaxesCents / estimatedTaxCents) * 100).toFixed(1)))
      : 100;

  const deductibleExpensesCents = sumWeightedCents(
    params.expenses
      .filter(
        (e) =>
          (e.scope ?? "personal") === "business" &&
          !e.is_internal_transfer &&
          Boolean(e.is_tax_deductible),
      )
      .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 })),
  );

  return {
    estimatedTaxCents,
    paidFiscalTaxesCents,
    netProvisionRemainingCents,
    coveragePct,
    isFullyCovered: estimatedTaxCents > 0 ? netProvisionRemainingCents === 0 : true,
    deductibleExpensesCents,
  };
}
