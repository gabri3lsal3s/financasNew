import { useMemo } from "react";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import {
  calculateFixedIncomeRedemptionPreview,
  classifyAssetValuation,
  computeCorporateEventFactor,
  computeDividendTotalFromMode,
  getFixedIncomeRedemptionInfo,
  resolvePortfolioUsdRate,
} from "@/domain/portfolio";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";
import {
  OrderBuySellFields,
  OrderDividendFields,
  OrderFixedIncomeTaxCard,
  OrderOperationSelector,
  OrderSplitFields,
} from "../components/shared-forms";
import { flagsFromFundingSource, fundingSourceFromFlags } from "../components/funding-source-utils";
import { StepOrderAssetBanner } from "./step-order-asset-banner";
import {
  buildSellExceedsMessage,
  buildStepOrderBuyPreview,
  buildStepOrderSellVariablePreview,
  buildWizardOperationPatch,
  resolveWizardSplitStrings,
} from "./step-order-helpers";
import { calculateInvestmentPreview, parseNumber, type InvestmentWizardState } from "./wizard-state";

export interface StepOrderProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  cashAsset?: PortfolioAsset | null;
  usdRate?: number;
}

export function StepOrder({ state, onChange, cashAsset, usdRate }: StepOrderProps) {
  const cashAvailableBRL = cashAsset?.quantity ?? 0;
  const effectiveUsdRate = usdRate ?? resolvePortfolioUsdRate([]);
  const preview = useMemo(
    () => calculateInvestmentPreview(state, cashAvailableBRL, effectiveUsdRate),
    [state, cashAvailableBRL, effectiveUsdRate],
  );

  const parsedQty = parseNumber(state.quantityStr);
  const { isCash, isTotalValue } = classifyAssetValuation(state);
  const fiInfo = isTotalValue ? getFixedIncomeRedemptionInfo(state.selectedAsset, state.date) : null;
  const fiSellPreview =
    state.mode === "sell" && isTotalValue && (state.totalCents > 0 || state.priceCents > 0)
      ? calculateFixedIncomeRedemptionPreview({
          asset: state.selectedAsset,
          withdrawGross: (state.totalCents || state.priceCents) / 100,
          date: state.date,
          appliedCostOverride: state.appliedCostCents > 0 ? state.appliedCostCents / 100 : null,
          customTaxRatePct: state.customTaxRatePct,
          customTaxAmount: state.customTaxAmountCents != null ? state.customTaxAmountCents / 100 : null,
        })
      : null;

  const sellExceedsMsg = buildSellExceedsMessage(state, fiInfo, isTotalValue);
  const buyPreviewCard = buildStepOrderBuyPreview(state, preview, parsedQty, isCash, isTotalValue);
  const sellVariableCard = buildStepOrderSellVariablePreview(state, preview, parsedQty, isTotalValue);
  const currentOpType: PortfolioTransactionType =
    state.mode === "existing_aporte" ? "buy" : (state.mode as PortfolioTransactionType);
  const { from: resolvedSplitFrom, to: resolvedSplitTo } = resolveWizardSplitStrings(state);
  const custodyQty = Math.max(0, state.selectedAsset?.quantity ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <StepOrderAssetBanner
        ticker={state.ticker}
        assetClass={state.assetClass}
        currency={state.currency}
        isTotalValue={isTotalValue}
        custodyQty={custodyQty}
        selectedAsset={state.selectedAsset}
        fiInfo={fiInfo}
      />

      {!isCash && state.selectedAsset && (
        <OrderOperationSelector
          value={currentOpType}
          isTotalValue={isTotalValue}
          onChange={(nextType) => onChange(buildWizardOperationPatch(nextType, state, fiInfo))}
        />
      )}

      {(state.mode === "buy" || state.mode === "existing_aporte" || state.mode === "sell") && (
        <>
          <OrderBuySellFields
            idPrefix="wizard-order"
            mode={state.mode === "sell" ? "sell" : "buy"}
            currency={state.currency}
            isCash={isCash}
            isTotalValue={isTotalValue}
            quantityStr={state.quantityStr}
            onQuantityChange={(v) => onChange({ quantityStr: v, totalCents: 0 })}
            priceCents={state.priceCents}
            onPriceCentsChange={(priceCents) =>
              onChange(isTotalValue ? { priceCents, totalCents: priceCents } : { priceCents, totalCents: 0 })
            }
            totalCents={state.totalCents}
            onTotalCentsChange={(totalCents) =>
              onChange(isTotalValue ? { totalCents, priceCents: totalCents } : { totalCents })
            }
            date={state.date}
            onDateChange={(date) => onChange({ date })}
            maxSellQuantity={state.selectedAsset?.quantity ?? 0}
            fixedIncomeGrossBalance={fiInfo?.grossValue || state.selectedAsset?.average_price || 0}
            appliedCostCents={state.appliedCostCents}
            onAppliedCostCentsChange={(appliedCostCents) => onChange({ appliedCostCents })}
            sellExceedsMaxMessage={sellExceedsMsg}
            buyPreview={buyPreviewCard}
            sellVariablePreview={sellVariableCard}
            fundingSource={fundingSourceFromFlags(state.syncCash, state.recordContribution)}
            onFundingSourceChange={(source) => onChange(flagsFromFundingSource(source))}
            cashBalanceBRL={cashAvailableBRL}
            orderTotalBRL={preview.totalOrderValueBRL}
            creditCash={state.syncCash}
            onCreditCashChange={(syncCash) => onChange({ syncCash })}
          />

          {state.mode === "sell" && isTotalValue && fiSellPreview && (
            <OrderFixedIncomeTaxCard
              idPrefix="wizard"
              preview={fiSellPreview}
              currency={state.currency}
              customTaxRatePct={state.customTaxRatePct}
              customTaxAmountCents={state.customTaxAmountCents}
              onCustomTaxChange={(patch) => onChange(patch)}
              showCashCredit={state.syncCash}
            />
          )}
        </>
      )}

      {state.mode === "dividend" && (
        <OrderDividendFields
          idPrefix="wizard"
          currency={state.currency}
          isTotalValue={isTotalValue}
          custodyQty={custodyQty}
          calcMode={state.dividendCalcMode ?? "total"}
          onCalcModeChange={(dividendCalcMode) => {
            const total = computeDividendTotalFromMode({
              calcMode: dividendCalcMode,
              totalCents: state.totalCents,
              perShareCents: state.perShareCents ?? 0,
              custodyQty,
              isTotalValue,
            });
            onChange({ dividendCalcMode, totalCents: numberToCents(total) });
          }}
          totalCents={state.totalCents}
          onTotalCentsChange={(totalCents) => onChange({ totalCents })}
          perShareCents={state.perShareCents ?? 0}
          onPerShareCentsChange={(perShareCents) => {
            const total = computeDividendTotalFromMode({
              calcMode: "per_share",
              totalCents: state.totalCents,
              perShareCents,
              custodyQty,
              isTotalValue,
            });
            onChange({ perShareCents, totalCents: numberToCents(total) });
          }}
          entryMode={state.dividendEntryMode}
          onEntryModeChange={(dividendEntryMode) => onChange({ dividendEntryMode })}
          date={state.date}
          onDateChange={(date) => onChange({ date })}
          month={state.month}
          onMonthChange={(month) => onChange({ month })}
          creditCash={state.syncCash}
          onCreditCashChange={(syncCash) => onChange({ syncCash })}
        />
      )}

      {(state.mode === "split" || state.mode === "reverse_split") && state.selectedAsset && (
        <OrderSplitFields
          idPrefix="wizard"
          mode={state.mode}
          currency={state.currency}
          currentQuantity={state.selectedAsset.quantity}
          currentAveragePrice={state.selectedAsset.average_price}
          splitFromStr={resolvedSplitFrom}
          onSplitFromChange={(splitFromStr) => {
            const factor = computeCorporateEventFactor(
              state.mode === "reverse_split" ? "reverse_split" : "split",
              parseDecimalNumber(splitFromStr),
              parseDecimalNumber(resolvedSplitTo),
            );
            onChange(
              state.mode === "reverse_split"
                ? { splitFromStr, splitToStr: resolvedSplitTo, reverseSplitFactor: factor }
                : { splitFromStr, splitToStr: resolvedSplitTo, splitFactor: factor },
            );
          }}
          splitToStr={resolvedSplitTo}
          onSplitToChange={(splitToStr) => {
            const factor = computeCorporateEventFactor(
              state.mode === "reverse_split" ? "reverse_split" : "split",
              parseDecimalNumber(resolvedSplitFrom),
              parseDecimalNumber(splitToStr),
            );
            onChange(
              state.mode === "reverse_split"
                ? { splitFromStr: resolvedSplitFrom, splitToStr, reverseSplitFactor: factor }
                : { splitFromStr: resolvedSplitFrom, splitToStr, splitFactor: factor },
            );
          }}
          date={state.date}
          onDateChange={(date) => onChange({ date })}
        />
      )}
    </div>
  );
}
