import {
  classifyAssetValuation,
  computeDividendTotalFromMode,
  resolveEffectiveSplitFactor,
} from "@/domain/portfolio";
import { resolveDividendDate, resolveDividendNote } from "@/domain/portfolio/dividends";
import { buildInitialPositionOperations } from "@/domain/portfolio/operations";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import type {
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
  useCreatePortfolioTransaction,
  useRecordOrder,
  useSetManualPrice,
} from "@/state";
import type { FixedIncomeMetadata, PortfolioAsset } from "@/types";
import { buildEmergencyConfigWithAssetToggle } from "../components/emergency-fund-sync";
import { parseNumber, type InvestmentWizardState } from "./wizard-state";

export interface WizardSubmitMutationHandlers {
  cashAsset: PortfolioAsset | null;
  usdRate: number;
  isFamilyModeEnabled: boolean;
  familyId: string | null;
  recordOrder: ReturnType<typeof useRecordOrder>["mutateAsync"];
  createAsset: ReturnType<typeof useCreatePortfolioAsset>["mutateAsync"];
  createTransaction: ReturnType<typeof useCreatePortfolioTransaction>["mutateAsync"];
  createContribution: ReturnType<typeof useCreatePortfolioContribution>["mutateAsync"];
  setManualPrice: ReturnType<typeof useSetManualPrice>["mutateAsync"];
  emergencyFund: {
    config: Parameters<typeof buildEmergencyConfigWithAssetToggle>[0]["config"];
    portfolioRows: Parameters<typeof buildEmergencyConfigWithAssetToggle>[0]["portfolioRows"];
    breakdownAssetIds: string[];
    updateConfig: (next: ReturnType<typeof buildEmergencyConfigWithAssetToggle>) => Promise<unknown>;
  };
}

export async function executeWizardSubmit(
  state: InvestmentWizardState,
  deps: WizardSubmitMutationHandlers,
): Promise<void> {
  const { cashAsset, usdRate, isFamilyModeEnabled, familyId } = deps;
  const parsedQty = parseNumber(state.quantityStr);
  const price = state.priceCents / 100;
  const total = state.totalCents / 100;
  const { isCash, isFixedIncome, isTotalValue } = classifyAssetValuation(state);

  if (state.mode === "buy" || state.mode === "existing_aporte") {
    if (!state.selectedAsset) throw new Error("Selecione um ativo");
    const finalTotal = isTotalValue ? (total > 0 ? total : price) : isCash ? (total > 0 ? total : parsedQty) : parsedQty * price;
    await deps.recordOrder({
      asset: state.selectedAsset,
      type: "buy",
      date: state.date,
      quantity: isTotalValue ? 1 : isCash ? (total > 0 ? total : parsedQty) : parsedQty,
      price: isTotalValue ? finalTotal : isCash ? 1 : price,
      total: finalTotal,
      syncCash: state.syncCash,
      cashAsset,
      recordContribution: state.recordContribution,
      notes: state.notes,
      usdRate,
    });
    return;
  }

  if (state.mode === "sell") {
    if (!state.selectedAsset) throw new Error("Selecione um ativo");
    const finalTotal = isTotalValue ? (total > 0 ? total : price) : parsedQty * price;
    await deps.recordOrder({
      asset: state.selectedAsset,
      type: "sell",
      date: state.date,
      quantity: isTotalValue ? 1 : parsedQty,
      price: isTotalValue ? finalTotal : price,
      total: finalTotal,
      syncCash: state.syncCash,
      cashAsset,
      notes: state.notes,
      usdRate,
      appliedCostBasis: isTotalValue && state.appliedCostCents > 0 ? state.appliedCostCents / 100 : undefined,
      customTaxAmount: isTotalValue && state.customTaxAmountCents != null ? state.customTaxAmountCents / 100 : undefined,
      customTaxRatePct: isTotalValue && state.customTaxRatePct != null ? state.customTaxRatePct : undefined,
    });
    return;
  }

  if (state.mode === "dividend") {
    if (!state.selectedAsset) throw new Error("Selecione um ativo");
    const resolvedTotal = computeDividendTotalFromMode({
      calcMode: state.dividendCalcMode ?? "total",
      totalCents: state.totalCents,
      perShareCents: state.perShareCents ?? 0,
      custodyQty: state.selectedAsset.quantity,
      isTotalValue,
    });
    const resolvedDate = resolveDividendDate(state.dividendEntryMode, state.dividendEntryMode === "monthly" ? state.month : state.date);
    const resolvedNotes = resolveDividendNote(state.dividendEntryMode, state.notes, "dividend");
    await deps.recordOrder({
      asset: state.selectedAsset,
      type: "dividend",
      date: resolvedDate,
      quantity: 0,
      price: 0,
      total: resolvedTotal,
      syncCash: state.syncCash,
      cashAsset,
      notes: resolvedNotes,
      usdRate,
    });
    return;
  }

  if (state.mode === "split" || state.mode === "reverse_split") {
    if (!state.selectedAsset) throw new Error("Selecione um ativo");
    const factor = resolveEffectiveSplitFactor({
      mode: state.mode,
      splitFactor: state.splitFactor,
      reverseSplitFactor: state.reverseSplitFactor,
      splitFromStr: state.splitFromStr,
      splitToStr: state.splitToStr,
    });
    await deps.recordOrder({
      asset: state.selectedAsset,
      type: state.mode,
      date: state.date,
      quantity: Math.round(factor * 1000000) / 1000000,
      price: 0,
      total: 0,
      notes: state.notes,
    });
    return;
  }

  if (state.mode === "new_asset") {
    const newIsCash = isCash || isCashAssetClass(state.assetClass) || state.ticker.toUpperCase() === "CAIXA";
    const newIsTotal = !newIsCash && isFixedIncome;
    const finalQuantity = newIsCash ? (total > 0 ? total : parsedQty) : newIsTotal ? 1 : parsedQty;
    const finalAveragePrice = newIsCash ? 1 : newIsTotal ? (price > 0 ? price : total) : price;
    const finalNotes = state.notes ? state.notes.trim() : null;

    let fixedIncomeMetadata: FixedIncomeMetadata | null = null;
    if (isFixedIncome && !newIsCash) {
      fixedIncomeMetadata = {
        rate_type: state.fixedIncomeRateType,
        rate_value: parseNumber(state.fixedIncomeRateValue),
        base_date: state.fixedIncomeBaseDate || state.date,
        base_value: newIsTotal && total > 0 ? total : null,
        initial_investment_date: state.fixedIncomeInitialInvestmentDate ? state.fixedIncomeInitialInvestmentDate.slice(0, 10) : null,
        maturity_date: state.fixedIncomeMaturityDate ? state.fixedIncomeMaturityDate.slice(0, 10) : null,
        is_tax_exempt: state.fixedIncomeIsTaxExempt,
        manual_tax_rate_pct: state.fixedIncomeIsTaxExempt ? null : state.fixedIncomeManualTaxRatePct,
      };
    }

    const newAsset = await deps.createAsset({
      ticker: state.ticker,
      asset_class: state.assetClass,
      sector: state.sector.trim() || null,
      currency: state.currency,
      quantity: finalQuantity,
      average_price: finalAveragePrice,
      accumulated_dividends: state.accumulatedDividendsCents / 100,
      estimated_monthly_dividend_per_share: state.estimatedDividendPerShareCents / 100,
      fixed_income_metadata: fixedIncomeMetadata,
      is_family: isFamilyModeEnabled ? state.isFamily : false,
      family_id: isFamilyModeEnabled && state.isFamily ? familyId : null,
      notes: finalNotes,
      score: newIsCash ? null : state.score,
      allocation_status: newIsCash ? "active" : state.allocationStatus,
      score_criteria: !newIsCash && Object.keys(state.scoreCriteria ?? {}).length > 0 ? state.scoreCriteria : null,
      thesis_summary: !newIsCash && state.thesisSummary.trim() ? state.thesisSummary.trim() : null,
      review_frequency_months: !newIsCash ? (state.reviewFrequencyMonths ?? 6) : undefined,
      last_reviewed_at: !newIsCash && state.score !== null ? new Date().toISOString() : null,
    });

    const ops = buildInitialPositionOperations({
      assetId: newAsset.id,
      ticker: state.ticker,
      assetClass: state.assetClass,
      currency: state.currency,
      quantity: finalQuantity,
      averagePrice: finalAveragePrice,
      initialDate: fixedIncomeMetadata?.initial_investment_date || fixedIncomeMetadata?.base_date || state.date,
      usdRate,
      isTotalValue: newIsTotal,
      isCash: newIsCash,
      notes: finalNotes,
    });

    if (ops.transaction) await deps.createTransaction(ops.transaction);
    if (ops.contribution) await deps.createContribution(ops.contribution);
    if (newIsTotal && total > 0) await deps.setManualPrice({ ticker: state.ticker, price: total });

    if (isFixedIncome && !newIsCash && state.isEmergencyFund && newAsset?.id) {
      const nextConfig = buildEmergencyConfigWithAssetToggle({
        config: deps.emergencyFund.config,
        portfolioRows: deps.emergencyFund.portfolioRows,
        breakdownAssetIds: deps.emergencyFund.breakdownAssetIds,
        assetId: newAsset.id,
        include: true,
      });
      await deps.emergencyFund.updateConfig(nextConfig);
    }
  }
}
