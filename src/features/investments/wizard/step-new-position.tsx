import { Badge } from "@/components/ui";
import { parseDecimalNumber } from "@/domain/money";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { useFamilyMode } from "@/state";
import { AssetIdentityPricingFields, AssetMetadataAccordion } from "../components/shared-forms";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepNewPositionProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
}

export function StepNewPosition({ state, onChange }: StepNewPositionProps) {
  const { isFamilyModeEnabled } = useFamilyMode();
  const isCash = isCashAssetClass(state.assetClass) || state.ticker.toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const isCustomValuation = Boolean(
    state.notes?.includes("[VALUATION:CUSTOM]") || state.notes?.includes("[PRICING:TOTAL]"),
  );
  const isTotalValueMode = !isCash && (isFixedIncome || isCustomValuation);
  const isCrypto = state.assetClass === "Cripto";
  const cleanNotes = (state.notes ?? "")
    .replace(/\[VALUATION:CUSTOM\]/g, "")
    .replace(/\[PRICING:(UNIT|TOTAL)\]/g, "")
    .trim();

  const hasStoredDividends =
    (state.accumulatedDividendsCents ?? 0) > 0 || (state.estimatedDividendPerShareCents ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-base font-bold text-foreground truncate">
            {state.ticker || "NOVO ATIVO"}
          </span>
          <Badge variant="muted" size="sm" className="shrink-0 font-medium">
            {state.assetClass}
          </Badge>
          {state.currency !== "BRL" && (
            <Badge variant="muted" size="sm" className="shrink-0 font-mono">
              {state.currency}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 font-mono">Passo 2 de 4</span>
      </div>

      <AssetIdentityPricingFields
        idPrefix="wizard-new"
        isNewPosition
        cashInputMode="money"
        ticker={state.ticker}
        assetClass={state.assetClass}
        currency={state.currency}
        onCurrencyChange={(currency) => onChange({ currency })}
        sector={state.sector}
        onSectorChange={(sector) => onChange({ sector })}
        isCash={isCash}
        isTesouro={isTesouro}
        isFixedIncome={isFixedIncome}
        isCrypto={isCrypto}
        isCustomValuation={isCustomValuation}
        onCustomValuationChange={(checked) => {
          const updated = checked ? [cleanNotes, "[VALUATION:CUSTOM]"].filter(Boolean).join(" ") : cleanNotes;
          onChange({ notes: updated });
        }}
        isTotalValueMode={isTotalValueMode}
        quantityStr={state.quantityStr}
        onQuantityStrChange={(quantityStr) => onChange({ quantityStr })}
        averagePriceCents={state.priceCents}
        onAveragePriceCentsChange={(priceCents) => onChange({ priceCents })}
        initialPriceCents={state.priceCents}
        onInitialPriceCentsChange={(priceCents) => {
          onChange({
            priceCents,
            totalCents: state.totalCents === 0 || state.totalCents === state.priceCents ? priceCents : state.totalCents,
          });
        }}
        currentPriceCents={state.totalCents}
        onCurrentPriceCentsChange={(totalCents) => onChange({ totalCents })}
        fixedIncomeValues={{
          rateType: state.fixedIncomeRateType,
          rateValue: state.fixedIncomeRateValue,
          baseDate: state.fixedIncomeBaseDate,
          initialInvestmentDate: state.fixedIncomeInitialInvestmentDate || null,
          maturityDate: state.fixedIncomeMaturityDate || null,
          isTaxExempt: state.fixedIncomeIsTaxExempt,
          manualTaxRatePct: state.fixedIncomeManualTaxRatePct,
        }}
        onFixedIncomeChange={(patch) => {
          const statePatch: Partial<InvestmentWizardState> = {};
          if (patch.rateType !== undefined) statePatch.fixedIncomeRateType = patch.rateType;
          if (patch.rateValue !== undefined) {
            statePatch.fixedIncomeRateValue =
              typeof patch.rateValue === "number" ? patch.rateValue : parseDecimalNumber(patch.rateValue);
          }
          if (patch.baseDate !== undefined) statePatch.fixedIncomeBaseDate = patch.baseDate;
          if (patch.initialInvestmentDate !== undefined) {
            statePatch.fixedIncomeInitialInvestmentDate = patch.initialInvestmentDate ?? "";
          }
          if (patch.maturityDate !== undefined) statePatch.fixedIncomeMaturityDate = patch.maturityDate ?? "";
          if (patch.isTaxExempt !== undefined) statePatch.fixedIncomeIsTaxExempt = patch.isTaxExempt;
          if (patch.manualTaxRatePct !== undefined) statePatch.fixedIncomeManualTaxRatePct = patch.manualTaxRatePct;
          onChange(statePatch);
        }}
      />

      <AssetMetadataAccordion
        idPrefix="wizard-new"
        assetClass={state.assetClass}
        currency={state.currency}
        isCash={isCash}
        isFixedIncome={isFixedIncome}
        isFamilyModeEnabled={isFamilyModeEnabled}
        isEmergencyFund={state.isEmergencyFund}
        onEmergencyFundChange={(isEmergencyFund) => onChange({ isEmergencyFund })}
        isFamily={state.isFamily}
        onFamilyChange={(isFamily) => onChange({ isFamily })}
        distributesInterest={isFixedIncome ? hasStoredDividends : false}
        onDistributesInterestChange={(checked) => {
          if (!checked) {
            onChange({ accumulatedDividendsCents: 0, estimatedDividendPerShareCents: 0 });
          }
        }}
        accumulatedDividendsCents={state.accumulatedDividendsCents}
        onAccumulatedDividendsCentsChange={(accumulatedDividendsCents) =>
          onChange({ accumulatedDividendsCents })
        }
        estimatedDividendPerShareCents={state.estimatedDividendPerShareCents}
        onEstimatedDividendPerShareCentsChange={(estimatedDividendPerShareCents) =>
          onChange({ estimatedDividendPerShareCents })
        }
        notes={cleanNotes}
        onNotesChange={(next) => {
          const updated = isCustomValuation ? [next, "[VALUATION:CUSTOM]"].filter(Boolean).join(" ") : next;
          onChange({ notes: updated });
        }}
      />
    </div>
  );
}
