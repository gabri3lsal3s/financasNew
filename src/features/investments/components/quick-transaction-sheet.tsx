import { Alert, Button, FormField, Modal, ModalFooter, Select } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { formatCentsAsBRL } from "@/services/masks";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/types";
import {
  OrderBuySellFields,
  OrderDividendFields,
  OrderFixedIncomeTaxCard,
  OrderOperationSelector,
  OrderSplitFields,
  resolveQuickTransactionModalCopy,
  useQuickTransactionForm,
} from "./shared-forms";

export interface QuickTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: PortfolioAsset | null;
  initialType?: PortfolioTransactionType;
  editTransaction?: PortfolioTransaction | null;
  editDividend?: PortfolioDividend | null;
  linkedContribution?: PortfolioContribution | null;
  onClose?: () => void;
  onSuccess?: () => void;
}

const QUICK_TX_FORM_ID = "quick-transaction-form";

function QuickTransactionSheetContent({
  open,
  onOpenChange,
  asset = null,
  initialType = "buy",
  editTransaction = null,
  editDividend = null,
  linkedContribution,
  onClose,
  onSuccess,
}: QuickTransactionSheetProps) {
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      form.resetOnClose();
      onClose?.();
    }
  };

  const form = useQuickTransactionForm({
    asset,
    initialType,
    editTransaction,
    editDividend,
    linkedContribution,
    onCloseComplete: () => handleOpenChange(false),
    onSuccess,
  });

  const assetOptions = form.allAssets
    .filter((a) => !isCashAssetClass(a.asset_class))
    .map((a) => ({ value: a.id, label: `${a.ticker} (${a.asset_class ?? "Ativo"})` }));

  const { title: modalTitle, description: modalDescription } = resolveQuickTransactionModalCopy({
    isEditingDividend: form.isEditingDividend,
    isEditingTransaction: form.isEditingTransaction,
    targetAsset: form.targetAsset,
  });

  const currency = form.targetAsset?.currency ?? "BRL";
  const rfBuyPreview =
    form.isTotalValue && form.type !== "sell" && (form.totalCents > 0 || form.priceCents > 0)
      ? {
          currentAveragePrice: form.targetAsset?.average_price ?? 0,
          newAveragePrice: (form.targetAsset?.average_price ?? 0) + (form.totalCents || form.priceCents) / 100,
          totalOrderValueBRL: form.currentOrderTotalBRL,
          newAppliedBalance: (form.targetAsset?.average_price ?? 0) + (form.totalCents || form.priceCents) / 100,
        }
      : form.buyPreview;

  const withdrawVal = (form.totalCents || form.priceCents) / 100;
  const maxRfBalance = form.fiSellResult?.grossBalance ?? form.currentGrossBalance;
  const sellExceedsMsg =
    !form.isEditingTransaction && form.isTotalValue && form.type === "sell" && withdrawVal > 0 && maxRfBalance > 0 && withdrawVal > maxRfBalance * 1.005
      ? `O valor excede o saldo bruto acumulado (${formatCentsAsBRL(numberToCents(maxRfBalance))}).`
      : null;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={form.isBusy}>
            Cancelar
          </Button>
          <Button type="submit" form={QUICK_TX_FORM_ID} disabled={!form.targetAsset || form.isBusy}>
            {form.isBusy ? "Processando..." : form.isEditMode ? "Salvar Alterações" : "Confirmar Operação"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={QUICK_TX_FORM_ID} onSubmit={form.handleSubmit} className="flex flex-col gap-4 pt-1">
        {form.error && <Alert variant="error">{form.error}</Alert>}

        {!asset && !form.isEditMode && (
          <FormField label="Selecione o Ativo">
            <Select
              value={form.selectedAssetId}
              onValueChange={(val) => {
                form.setSelectedAssetId(val);
                form.setCustomAppliedCostCents(null);
              }}
              options={assetOptions}
              placeholder="Escolha um ativo da carteira"
            />
          </FormField>
        )}

        <OrderOperationSelector
          value={form.type}
          isTotalValue={form.isTotalValue}
          isEditingTransaction={form.isEditingTransaction}
          isEditingDividend={form.isEditingDividend}
          onChange={(nextType) => {
            form.setType(nextType);
            if (nextType === "reverse_split" && !form.isEditingTransaction) {
              form.setSplitFromStr("2");
              form.setSplitToStr("1");
            } else if (nextType === "split" && !form.isEditingTransaction) {
              form.setSplitFromStr("1");
              form.setSplitToStr("2");
            }
          }}
        />

        {(form.type === "buy" || form.type === "subscription" || form.type === "sell") && (
          <>
            <OrderBuySellFields
              idPrefix="quick"
              mode={form.type}
              currency={currency}
              isCash={form.isCash}
              isTotalValue={form.isTotalValue}
              isEditing={form.isEditingTransaction}
              quantityStr={form.quantityStr}
              onQuantityChange={form.setQuantityStr}
              priceCents={form.priceCents}
              onPriceCentsChange={form.setPriceCents}
              totalCents={form.totalCents}
              onTotalCentsChange={form.setTotalCents}
              date={form.date}
              onDateChange={form.setDate}
              maxSellQuantity={form.targetAsset?.quantity ?? 0}
              fixedIncomeGrossBalance={form.fiSellResult?.grossBalance ?? form.currentGrossBalance}
              appliedCostCents={form.appliedCostCents}
              onAppliedCostCentsChange={form.setCustomAppliedCostCents}
              sellExceedsMaxMessage={sellExceedsMsg}
              buyPreview={rfBuyPreview}
              sellVariablePreview={form.sellVariablePreview}
              fundingSource={form.buyFundingSource}
              onFundingSourceChange={form.setBuyFundingSource}
              cashBalanceBRL={form.cashAsset?.quantity ?? 0}
              orderTotalBRL={form.currentOrderTotalBRL}
              creditCash={form.creditCash}
              onCreditCashChange={form.setCreditCash}
              recordWithdrawal={form.recordWithdrawal}
              onRecordWithdrawalChange={form.setRecordWithdrawal}
              fxRateBRL={form.fxRateBRL}
              onFxRateBRLChange={form.setFxRateBRL}
            />

            {!form.isEditingTransaction && form.type === "sell" && form.fiSellResult && (
              <OrderFixedIncomeTaxCard
                idPrefix="quick"
                preview={form.fiSellResult}
                currency={currency}
                customTaxRatePct={form.customTaxRatePct}
                customTaxAmountCents={form.customTaxAmountCents}
                customInitialDate={form.customInitialDate}
                onCustomTaxChange={(patch) => {
                  if (patch.customTaxRatePct !== undefined) form.setCustomTaxRatePct(patch.customTaxRatePct);
                  if (patch.customTaxAmountCents !== undefined) form.setCustomTaxAmountCents(patch.customTaxAmountCents);
                  if (patch.customInitialDate !== undefined) form.setCustomInitialDate(patch.customInitialDate);
                }}
              />
            )}
          </>
        )}

        {form.isDividendType && (
          <OrderDividendFields
            idPrefix="quick"
            currency={currency}
            isTotalValue={form.isTotalValue}
            custodyQty={form.custodyQty}
            calcMode={form.dividendCalcMode}
            onCalcModeChange={form.setDividendCalcMode}
            totalCents={form.totalCents}
            onTotalCentsChange={form.setTotalCents}
            perShareCents={form.perShareCents}
            onPerShareCentsChange={form.setPerShareCents}
            entryMode={form.dividendEntryMode}
            onEntryModeChange={form.setDividendEntryMode}
            date={form.date}
            onDateChange={form.setDate}
            month={form.month}
            onMonthChange={form.setMonth}
            creditCash={form.creditCash}
            onCreditCashChange={form.setCreditCash}
          />
        )}

        {form.isCorporateEvent && form.targetAsset && (
          <OrderSplitFields
            idPrefix="quick"
            mode={form.type === "reverse_split" ? "reverse_split" : "split"}
            currency={currency}
            currentQuantity={form.targetAsset.quantity}
            currentAveragePrice={form.targetAsset.average_price}
            splitFromStr={form.splitFromStr}
            onSplitFromChange={form.setSplitFromStr}
            splitToStr={form.splitToStr}
            onSplitToChange={form.setSplitToStr}
            date={form.date}
            onDateChange={form.setDate}
          />
        )}
      </form>
    </Modal>
  );
}

export function QuickTransactionSheet(props: QuickTransactionSheetProps) {
  if (!props.open) return null;
  const instanceKey = `${props.editTransaction?.id ?? props.editDividend?.id ?? props.asset?.id ?? "new"}-${props.initialType ?? "buy"}-open`;
  return <QuickTransactionSheetContent key={instanceKey} {...props} />;
}
