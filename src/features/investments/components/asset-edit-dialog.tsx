import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import type { PortfolioAsset } from "@/types";
import {
  AssetIdentityPricingFields,
  AssetMetadataAccordion,
  useAssetEditForm,
} from "./shared-forms";

export interface AssetEditDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AssetEditFormContentProps {
  asset: PortfolioAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

function AssetEditFormContent({ asset, open, onOpenChange, onClose }: AssetEditFormContentProps) {
  const form = useAssetEditForm(asset, onClose);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Ativo"
      description={`Atualize as informações cadastrais de ${asset.ticker}`}
      size="lg"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={onClose} disabled={form.isBusy}>
            Cancelar
          </Button>
          <Button type="submit" form="asset-edit-form" disabled={form.isBusy}>
            {form.isBusy ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </ModalFooter>
      }
    >
      <form id="asset-edit-form" onSubmit={form.handleSubmit} className="flex flex-col gap-4 pt-2">
        {form.error && <Alert variant="error">{form.error}</Alert>}

        <AssetIdentityPricingFields
          idPrefix="edit-asset"
          showIdentityFields
          cashInputMode="numeric"
          ticker={form.ticker}
          onTickerChange={form.setTicker}
          assetClass={form.assetClass}
          onAssetClassChange={form.handleClassChange}
          currency={form.currency}
          onCurrencyChange={form.setCurrency}
          sector={form.sector}
          onSectorChange={form.setSector}
          isCash={form.isCash}
          isTesouro={form.isTesouro}
          isFixedIncome={form.isFixedIncome}
          isCrypto={form.isCrypto}
          isClosed={form.isClosed}
          isCustomValuation={form.isCustomValuation}
          onCustomValuationChange={form.setIsCustomValuation}
          isTotalValueMode={form.isTotalValueMode}
          quantityStr={form.quantityStr}
          onQuantityStrChange={form.setQuantityStr}
          averagePriceCents={form.averagePriceCents}
          onAveragePriceCentsChange={form.setAveragePriceCents}
          initialPriceCents={form.initialPriceCents}
          onInitialPriceCentsChange={(cents) => {
            form.setInitialPriceCents(cents);
            if (form.currentPriceCents === 0 && !form.isClosed) {
              form.setCurrentPriceCents(cents);
            }
          }}
          currentPriceCents={form.currentPriceCents}
          onCurrentPriceCentsChange={form.setCurrentPriceCents}
          fxRateAtPurchase={form.fxRateAtPurchase}
          onFxRateAtPurchaseChange={(rate) => {
            form.setFxRateAtPurchase(rate);
            if (rate && rate > 0) {
              const qty = parseDecimalNumber(form.quantityStr);
              const avgPrice = form.averagePriceCents / 100;
              if (qty > 0 && avgPrice > 0) {
                form.setTotalCostBRLCents(numberToCents(qty * avgPrice * rate));
              }
            }
          }}
          totalCostBRLCents={form.totalCostBRLCents}
          onTotalCostBRLCentsChange={form.setTotalCostBRLCents}
          fixedIncomeValues={{
            rateType: form.fixedIncomeRateType,
            rateValue: form.fixedIncomeRateValue,
            baseDate: form.fixedIncomeBaseDate,
            initialInvestmentDate: form.fixedIncomeInitialInvestmentDate || null,
            maturityDate: form.fixedIncomeMaturityDate || null,
            isTaxExempt: form.fixedIncomeIsTaxExempt,
            manualTaxRatePct: form.fixedIncomeManualTaxRatePct,
          }}
          onFixedIncomeChange={(patch) => {
            if (patch.rateType !== undefined) form.setFixedIncomeRateType(patch.rateType);
            if (patch.rateValue !== undefined) {
              form.setFixedIncomeRateValue(
                typeof patch.rateValue === "number" ? patch.rateValue : parseDecimalNumber(patch.rateValue),
              );
            }
            if (patch.baseDate !== undefined) form.setFixedIncomeBaseDate(patch.baseDate);
            if (patch.initialInvestmentDate !== undefined) {
              form.setFixedIncomeInitialInvestmentDate(patch.initialInvestmentDate ?? "");
            }
            if (patch.maturityDate !== undefined) {
              form.setFixedIncomeMaturityDate(patch.maturityDate ?? "");
            }
            if (patch.isTaxExempt !== undefined) form.setFixedIncomeIsTaxExempt(patch.isTaxExempt);
            if (patch.manualTaxRatePct !== undefined) form.setFixedIncomeManualTaxRatePct(patch.manualTaxRatePct);
          }}
        />

        <AssetMetadataAccordion
          idPrefix="edit-asset"
          assetClass={form.assetClass}
          currency={form.currency}
          isCash={form.isCash}
          isFixedIncome={form.isFixedIncome}
          isFamilyModeEnabled={form.isFamilyModeEnabled}
          isEmergencyFund={form.isEmergencyFund}
          onEmergencyFundChange={form.setIsEmergencyFund}
          isFamily={form.isFamily}
          onFamilyChange={form.setIsFamily}
          distributesInterest={form.distributesInterest}
          onDistributesInterestChange={form.setDistributesInterest}
          accumulatedDividendsCents={form.accumulatedDividendsCents}
          onAccumulatedDividendsCentsChange={form.setAccumulatedDividendsCents}
          estimatedDividendPerShareCents={form.estimatedDividendPerShareCents}
          onEstimatedDividendPerShareCentsChange={form.setEstimatedDividendPerShareCents}
          notes={form.notes}
          onNotesChange={form.setNotes}
        />
      </form>
    </Modal>
  );
}

export function AssetEditDialog({ asset, open, onOpenChange }: AssetEditDialogProps) {
  if (!asset || !open) return null;

  return (
    <AssetEditFormContent
      key={`${asset.id}-open`}
      asset={asset}
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
    />
  );
}
