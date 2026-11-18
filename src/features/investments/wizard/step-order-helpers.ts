import { numberToCents } from "@/domain/money";
import type { FixedIncomeRedemptionInfo, InvestmentPreviewResult } from "@/domain/portfolio";
import { formatCentsAsBRL } from "@/services/masks";
import type { PortfolioTransactionType } from "@/types";
import type { InvestmentWizardState, WizardMode } from "./wizard-state";

export function buildStepOrderBuyPreview(
  state: InvestmentWizardState,
  preview: InvestmentPreviewResult,
  parsedQty: number,
  isCash: boolean,
  isTotalValue: boolean,
) {
  if (isTotalValue && (state.totalCents > 0 || state.priceCents > 0)) {
    return {
      currentAveragePrice: state.selectedAsset?.average_price ?? 0,
      newAveragePrice: preview.newAveragePrice,
      totalOrderValueBRL: preview.totalOrderValueBRL,
      newAppliedBalance: (state.selectedAsset?.average_price ?? 0) + (state.totalCents || state.priceCents) / 100,
    };
  }
  if (!isCash && parsedQty > 0 && state.priceCents > 0) {
    return {
      currentAveragePrice: preview.currentAveragePrice,
      newAveragePrice: preview.newAveragePrice,
      totalOrderValueNative: preview.totalOrderValueNative,
      totalOrderValueBRL: preview.totalOrderValueBRL,
    };
  }
  return null;
}

export function buildStepOrderSellVariablePreview(
  state: InvestmentWizardState,
  preview: InvestmentPreviewResult,
  parsedQty: number,
  isTotalValue: boolean,
) {
  if (!isTotalValue && parsedQty > 0 && state.priceCents > 0 && preview.realizedPnl !== undefined) {
    return {
      realizedPnl: preview.realizedPnl,
      realizedPnlPct: preview.realizedPnlPct ?? 0,
      showActionExemptionNote: state.assetClass === "Ações" && state.currency === "BRL",
    };
  }
  return null;
}

export function buildSellExceedsMessage(
  state: InvestmentWizardState,
  fiInfo: FixedIncomeRedemptionInfo | null,
  isTotalValue: boolean,
): string | null {
  const withdrawVal = (state.totalCents || state.priceCents) / 100;
  const maxVal = fiInfo?.grossValue || state.selectedAsset?.average_price || 0;
  if (state.mode === "sell" && isTotalValue && withdrawVal > 0 && maxVal > 0 && withdrawVal > maxVal * 1.005) {
    return `O valor informado excede o saldo bruto acumulado disponível (${formatCentsAsBRL(numberToCents(maxVal))}).`;
  }
  return null;
}

export function resolveWizardSplitStrings(state: InvestmentWizardState) {
  const from =
    state.splitFromStr && state.splitFromStr.length > 0
      ? state.splitFromStr
      : state.mode === "reverse_split"
        ? String(state.reverseSplitFactor || 2)
        : "1";
  const to =
    state.splitToStr && state.splitToStr.length > 0
      ? state.splitToStr
      : state.mode === "split"
        ? String(state.splitFactor || 2)
        : "1";
  return { from, to };
}

export function buildWizardOperationPatch(
  nextType: PortfolioTransactionType,
  state: InvestmentWizardState,
  fiInfo: FixedIncomeRedemptionInfo | null,
): Partial<InvestmentWizardState> {
  const patch: Partial<InvestmentWizardState> = { mode: nextType as WizardMode };
  if (nextType === "sell" && state.appliedCostCents <= 0) {
    const cost = fiInfo?.appliedCost ?? state.selectedAsset?.average_price ?? 0;
    if (cost > 0) patch.appliedCostCents = numberToCents(cost);
  }
  if (nextType === "split") {
    patch.splitFromStr = "1";
    patch.splitToStr = "2";
    patch.splitFactor = 2;
  } else if (nextType === "reverse_split") {
    patch.splitFromStr = "2";
    patch.splitToStr = "1";
    patch.reverseSplitFactor = 2;
  }
  return patch;
}
