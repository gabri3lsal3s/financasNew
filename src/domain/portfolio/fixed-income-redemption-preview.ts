/**
 * Motor puro de prévia fiscal e contábil para resgates de Renda Fixa / Valor Completo.
 *
 * Centraliza a apuração regressiva de IR (Lei 11.033/2004), IOF (< 30 dias),
 * custo original remanescente proporcional, ajustes manuais de nota de corretagem
 * e valor líquido de resgate (compartilhado entre QuickTransactionSheet e Wizard).
 *
 * Módulo puro — sem dependência de UI ou Supabase.
 */

import { todayISO } from "@/domain/debts";
import type { PortfolioAsset } from "@/types";
import {
  calculateFixedIncomeBalance,
  type TaxReductionCountdown,
} from "./fixed-income";

export interface FixedIncomeRedemptionInfo {
  appliedCost: number;
  grossValue: number;
  netValue: number;
  taxAmount: number;
  taxRatePct: number;
  iofAmount: number;
  iofRatePct: number;
  calendarDaysTotal: number;
  isMatured: boolean;
  taxCountdown: TaxReductionCountdown | null;
}

export interface FixedIncomeRedemptionPreviewInput {
  asset: PortfolioAsset | null;
  withdrawGross: number;
  date?: string;
  appliedCostOverride?: number | null;
  customTaxRatePct?: number | null;
  customTaxAmount?: number | null;
  customInitialDate?: string | null;
}

export interface FixedIncomeRedemptionPreviewResult {
  grossAmount: number;
  grossBalance: number;
  appliedCostBasis: number;
  realizedProfit: number;
  realizedProfitPct: number;
  remainingGrossBalance: number;
  remainingCostBasis: number;
  isFullRedemption: boolean;
  netBalance: number;
  projectedTaxRatePct: number;
  projectedTaxAmount: number;
  projectedIofRatePct: number;
  projectedIofAmount: number;
  iofRatePct: number;
  iofAmount: number;
  calendarDaysTotal: number;
  taxRatePct: number;
  taxAmount: number;
  netCredit: number;
  isExempt: boolean;
  isCustomized: boolean;
  taxCountdown: TaxReductionCountdown | null;
  isMatured: boolean;
  initialInvestmentDate: string | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve o custo original aplicado de um ativo de Renda Fixa / Valor Completo.
 */
export function resolveFixedIncomeAppliedCost(asset: PortfolioAsset | null | undefined): number {
  if (!asset) return 0;
  const metaInitial = asset.fixed_income_metadata?.initial_investment_value;
  if (metaInitial !== undefined && metaInitial !== null && metaInitial > 0) {
    return metaInitial;
  }
  if (asset.quantity > 1 && asset.average_price > 0) {
    return round2(asset.quantity * asset.average_price);
  }
  if (asset.average_price > 0) {
    return asset.average_price;
  }
  const metaBase = asset.fixed_income_metadata?.base_value;
  if (metaBase !== undefined && metaBase !== null && metaBase > 0) {
    return metaBase;
  }
  return asset.quantity > 0 ? asset.quantity : 0;
}

/**
 * Calcula a alíquota efetiva (%) a partir de um valor absoluto de IRRF e do lucro realizado.
 */
export function computeEffectiveTaxRateFromAmount(taxAmount: number, realizedProfit: number): number {
  if (realizedProfit <= 0 || taxAmount <= 0) return 0;
  return round2((taxAmount / realizedProfit) * 100);
}

/**
 * Retorna as informações contábeis e fiscais acumuladas para resgate na data de referência.
 */
export function getFixedIncomeRedemptionInfo(
  asset: PortfolioAsset | null,
  date: string = todayISO(),
): FixedIncomeRedemptionInfo {
  if (!asset) {
    return {
      appliedCost: 0,
      grossValue: 0,
      netValue: 0,
      taxAmount: 0,
      taxRatePct: 0,
      iofAmount: 0,
      iofRatePct: 0,
      calendarDaysTotal: 0,
      isMatured: false,
      taxCountdown: null,
    };
  }

  const appliedCost = resolveFixedIncomeAppliedCost(asset);
  const meta = asset.fixed_income_metadata;
  if (!meta) {
    return {
      appliedCost,
      grossValue: appliedCost,
      netValue: appliedCost,
      taxAmount: 0,
      taxRatePct: 0,
      iofAmount: 0,
      iofRatePct: 0,
      calendarDaysTotal: 0,
      isMatured: false,
      taxCountdown: null,
    };
  }

  const baseValue =
    meta.base_value !== undefined && meta.base_value !== null && meta.base_value > 0
      ? meta.base_value
      : appliedCost;

  const fiRes = calculateFixedIncomeBalance({
    baseValue,
    baseDate: meta.base_date,
    initialInvestmentDate: meta.initial_investment_date,
    maturityDate: meta.maturity_date,
    rateType: meta.rate_type,
    rateValue: meta.rate_value,
    isTaxExempt: meta.is_tax_exempt,
    manualTaxRatePct: meta.manual_tax_rate_pct,
    totalCost: appliedCost,
    today: date,
  });

  return {
    appliedCost,
    grossValue: Math.max(fiRes.grossValue, appliedCost),
    netValue: fiRes.netValue,
    taxAmount: fiRes.taxAmount,
    taxRatePct: fiRes.taxRatePct,
    iofAmount: fiRes.iofAmount,
    iofRatePct: fiRes.iofRatePct,
    calendarDaysTotal: fiRes.calendarDaysTotal,
    isMatured: fiRes.isMatured,
    taxCountdown: fiRes.taxCountdown,
  };
}

/**
 * Retorna o saldo bruto acumulado de um ativo de Renda Fixa / Valor Completo na data informada.
 */
export function getFixedIncomeCurrentGrossBalance(
  asset: PortfolioAsset | null,
  date: string = todayISO(),
): number {
  if (!asset) return 0;
  return getFixedIncomeRedemptionInfo(asset, date).grossValue;
}

/**
 * Calcula a prévia completa de resgate de Renda Fixa (IR regressivo, IOF,
 * abate proporcional do custo aplicado, ajustes manuais e crédito líquido).
 */
export function calculateFixedIncomeRedemptionPreview(
  input: FixedIncomeRedemptionPreviewInput,
): FixedIncomeRedemptionPreviewResult | null {
  const {
    asset,
    withdrawGross,
    date = todayISO(),
    appliedCostOverride,
    customTaxRatePct,
    customTaxAmount,
    customInitialDate,
  } = input;

  if (!asset || !Number.isFinite(withdrawGross) || withdrawGross <= 0) {
    return null;
  }

  const currentCost = resolveFixedIncomeAppliedCost(asset);
  const effectiveAppliedCost =
    appliedCostOverride !== undefined && appliedCostOverride !== null && appliedCostOverride > 0
      ? appliedCostOverride
      : currentCost;

  const meta = asset.fixed_income_metadata;
  const isExempt = Boolean(meta?.is_tax_exempt);

  let grossBalance = Math.max(currentCost, effectiveAppliedCost);
  let netBalance = grossBalance;
  let projectedTaxAmount = 0;
  let projectedTaxRatePct = 0;
  let projectedIofAmount = 0;
  let projectedIofRatePct = 0;
  let calendarDaysTotal = 0;
  let taxCountdown: TaxReductionCountdown | null = null;
  let isMatured = false;

  const resolvedInitialDate =
    customInitialDate !== undefined && customInitialDate !== null && customInitialDate.trim().length >= 10
      ? customInitialDate.trim().slice(0, 10)
      : (meta?.initial_investment_date ?? meta?.base_date ?? null);

  if (meta) {
    const baseValue =
      meta.base_value !== undefined && meta.base_value !== null && meta.base_value > 0
        ? meta.base_value
        : effectiveAppliedCost > 0
          ? effectiveAppliedCost
          : currentCost;

    const fiRes = calculateFixedIncomeBalance({
      baseValue,
      baseDate: meta.base_date,
      initialInvestmentDate: resolvedInitialDate ?? meta.initial_investment_date,
      maturityDate: meta.maturity_date,
      rateType: meta.rate_type,
      rateValue: meta.rate_value,
      isTaxExempt: meta.is_tax_exempt,
      manualTaxRatePct: meta.manual_tax_rate_pct,
      totalCost: effectiveAppliedCost > 0 ? effectiveAppliedCost : currentCost,
      today: date,
    });

    grossBalance = Math.max(fiRes.grossValue, currentCost);
    netBalance = fiRes.netValue;
    isMatured = fiRes.isMatured;
    taxCountdown = fiRes.taxCountdown;
    calendarDaysTotal = fiRes.calendarDaysTotal;

    const proportion = grossBalance > 0 ? Math.min(1, withdrawGross / grossBalance) : 1;
    projectedTaxAmount = isExempt ? 0 : round2(fiRes.taxAmount * proportion);
    projectedTaxRatePct = isExempt ? 0 : fiRes.taxRatePct;
    projectedIofAmount = isExempt ? 0 : round2(fiRes.iofAmount * proportion);
    projectedIofRatePct = isExempt ? 0 : fiRes.iofRatePct;
  }

  const proportion = grossBalance > 0 ? Math.min(1, withdrawGross / grossBalance) : 1;
  const isFullRedemption =
    grossBalance > 0
      ? withdrawGross >= grossBalance - 0.01
      : withdrawGross >= effectiveAppliedCost - 0.01;

  const costBasisProportion = isFullRedemption
    ? effectiveAppliedCost
    : round2(effectiveAppliedCost * proportion);
  const realizedProfit = round2(withdrawGross - costBasisProportion);
  const realizedProfitPct =
    costBasisProportion > 0 ? round2((realizedProfit / costBasisProportion) * 100) : 0;

  let effectiveTaxAmount = projectedTaxAmount;
  let effectiveTaxRatePct = projectedTaxRatePct;
  let effectiveIofAmount = projectedIofAmount;
  let effectiveIofRatePct = projectedIofRatePct;

  const hasCustomAmount = customTaxAmount !== null && customTaxAmount !== undefined;
  const hasCustomRate = customTaxRatePct !== null && customTaxRatePct !== undefined;
  const hasCustomDate = Boolean(
    customInitialDate &&
      meta?.initial_investment_date &&
      customInitialDate.trim().slice(0, 10) !== meta.initial_investment_date.slice(0, 10),
  );
  const isCustomized = hasCustomAmount || hasCustomRate || hasCustomDate;

  if (hasCustomAmount) {
    effectiveTaxAmount = Math.max(0, customTaxAmount);
    effectiveTaxRatePct =
      realizedProfit > 0
        ? computeEffectiveTaxRateFromAmount(effectiveTaxAmount, realizedProfit)
        : (customTaxRatePct ?? projectedTaxRatePct);
    effectiveIofAmount = 0;
    effectiveIofRatePct = 0;
  } else if (hasCustomRate) {
    effectiveTaxRatePct = Math.max(0, customTaxRatePct);
    effectiveTaxAmount =
      effectiveTaxRatePct === 0
        ? 0
        : Math.max(0, round2(Math.max(0, realizedProfit) * (effectiveTaxRatePct / 100)));
    if (effectiveTaxRatePct === 0) {
      effectiveIofAmount = 0;
      effectiveIofRatePct = 0;
    }
  }

  const netCredit = Math.max(0, round2(withdrawGross - effectiveTaxAmount - effectiveIofAmount));
  const remainingGrossBalance = isFullRedemption
    ? 0
    : Math.max(0, round2(grossBalance - withdrawGross));
  const remainingCostBasis = isFullRedemption
    ? 0
    : Math.max(0, round2(effectiveAppliedCost * (1 - proportion)));

  return {
    grossAmount: withdrawGross,
    grossBalance,
    appliedCostBasis: costBasisProportion,
    realizedProfit,
    realizedProfitPct,
    remainingGrossBalance,
    remainingCostBasis,
    isFullRedemption,
    netBalance,
    projectedTaxRatePct,
    projectedTaxAmount,
    projectedIofRatePct,
    projectedIofAmount,
    iofRatePct: effectiveIofRatePct,
    iofAmount: effectiveIofAmount,
    calendarDaysTotal,
    taxRatePct: effectiveTaxRatePct,
    taxAmount: effectiveTaxAmount,
    netCredit,
    isExempt,
    isCustomized,
    taxCountdown,
    isMatured,
    initialInvestmentDate: resolvedInitialDate,
  };
}

/**
 * Constrói notas auditáveis ricas para a transação de resgate de Renda Fixa no ledger.
 */
export function buildFixedIncomeSellNotes(params: {
  appliedCost: number;
  realizedProfit: number;
  taxAmount: number;
  taxRatePct: number;
  netCredit: number;
  userNotes?: string | null;
}): string {
  const profitSign = params.realizedProfit >= 0 ? "+" : "";
  const parts = [
    `Resgate Renda Fixa | Custo baixado: R$ ${params.appliedCost.toFixed(2)} | Lucro Realizado: ${profitSign}R$ ${params.realizedProfit.toFixed(2)} | IRRF: -R$ ${params.taxAmount.toFixed(2)} (${params.taxRatePct.toFixed(1)}%) | Líquido: R$ ${params.netCredit.toFixed(2)}`,
    params.userNotes?.trim(),
  ].filter(Boolean);
  return parts.join(" — ");
}

export interface ParsedFixedIncomeSellNotes {
  appliedCost: number;
  realizedProfit: number;
  taxAmount: number;
  taxRatePct: number;
  netCredit: number;
}

/**
 * Faz o parse determinístico das notas ricas de resgate de Renda Fixa,
 * recuperando o snapshot gravado no momento da operação.
 */
export function parseFixedIncomeSellNotes(notes?: string | null): ParsedFixedIncomeSellNotes | null {
  if (!notes || typeof notes !== "string") return null;

  const match = notes.match(
    /Custo baixado:\s*R\$\s*([\d.,]+)\s*\|\s*Lucro Realizado:\s*([+-]?)\s*R\$\s*([\d.,]+)\s*\|\s*IRRF:\s*-\s*R\$\s*([\d.,]+)\s*\(([\d.,]+)%\)\s*\|\s*L[ií]quido:\s*R\$\s*([\d.,]+)/i,
  );
  if (!match) return null;

  const parseNum = (s?: string): number => {
    if (!s) return 0;
    let clean = s.trim();
    if (clean.includes(",") && clean.includes(".")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  };

  const appliedCost = parseNum(match[1]);
  const sign = match[2] === "-" ? -1 : 1;
  const realizedProfit = sign * parseNum(match[3]);
  const taxAmount = parseNum(match[4]);
  const taxRatePct = parseNum(match[5]);
  const netCredit = parseNum(match[6]);

  if (appliedCost <= 0 && netCredit <= 0) return null;

  return {
    appliedCost,
    realizedProfit,
    taxAmount,
    taxRatePct,
    netCredit,
  };
}
