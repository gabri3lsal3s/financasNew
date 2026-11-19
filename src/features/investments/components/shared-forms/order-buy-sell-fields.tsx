import { Checkbox, DatePicker, FormField, MoneyInput, NumericInput } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import type { AssetCurrency } from "@/types";
import { FundingSourceSelector } from "../funding-source-selector";
import type { FundingSource } from "../funding-source-utils";
import { OrderBuySellPreview } from "./order-buy-sell-preview";

export interface OrderBuySellFieldsProps {
  mode: "buy" | "subscription" | "sell";
  currency: AssetCurrency;
  isCash: boolean;
  isTotalValue: boolean;
  isEditing?: boolean;
  quantityStr: string;
  onQuantityChange: (value: string) => void;
  priceCents: number;
  onPriceCentsChange: (cents: number) => void;
  totalCents: number;
  onTotalCentsChange: (cents: number) => void;
  date: string;
  onDateChange: (date: string) => void;
  maxSellQuantity?: number;
  fixedIncomeGrossBalance?: number;
  appliedCostCents?: number;
  onAppliedCostCentsChange?: (cents: number) => void;
  sellExceedsMaxMessage?: string | null;
  buyPreview?: {
    currentAveragePrice: number;
    newAveragePrice: number;
    totalOrderValueNative?: number;
    totalOrderValueBRL: number;
    newAppliedBalance?: number;
  } | null;
  sellVariablePreview?: {
    realizedPnl: number;
    realizedPnlPct: number;
    showActionExemptionNote?: boolean;
  } | null;
  fundingSource?: FundingSource;
  onFundingSourceChange?: (source: FundingSource) => void;
  cashBalanceBRL?: number;
  orderTotalBRL?: number;
  creditCash?: boolean;
  onCreditCashChange?: (checked: boolean) => void;
  fxRateBRL?: number | null;
  onFxRateBRLChange?: (rate: number | null) => void;
  idPrefix: string;
}

const SELL_PCT_SHORTCUTS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "100% (Total)", pct: 1 },
] as const;

export function OrderBuySellFields({
  mode,
  currency,
  isCash,
  isTotalValue,
  isEditing = false,
  quantityStr,
  onQuantityChange,
  priceCents,
  onPriceCentsChange,
  totalCents,
  onTotalCentsChange,
  date,
  onDateChange,
  maxSellQuantity = 0,
  fixedIncomeGrossBalance = 0,
  appliedCostCents = 0,
  onAppliedCostCentsChange,
  sellExceedsMaxMessage,
  buyPreview,
  sellVariablePreview,
  fundingSource = "pocket",
  onFundingSourceChange,
  cashBalanceBRL = 0,
  orderTotalBRL = 0,
  creditCash = true,
  onCreditCashChange,
  fxRateBRL,
  onFxRateBRLChange,
  idPrefix,
}: OrderBuySellFieldsProps) {
  const isSell = mode === "sell";
  const moneyPlaceholder = currency === "USD" ? "$ 0.00" : "R$ 0,00";
  const currencyTag = currency === "BRL" ? "R$" : currency;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {isTotalValue ? (
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormField
              label={isSell ? `Valor a Resgatar (${currency})` : `Valor do Aporte / Aplicação (${currency})`}
              htmlFor={`${idPrefix}-rf-amount`}
              error={isSell ? (sellExceedsMaxMessage ?? undefined) : undefined}
            >
              <MoneyInput
                id={`${idPrefix}-rf-amount`}
                cents={totalCents || priceCents}
                currency={currency}
                onCentsChange={(cents) => {
                  onTotalCentsChange(cents);
                  onPriceCentsChange(cents);
                }}
                placeholder={moneyPlaceholder}
                aria-label={isSell ? "Valor a resgatar em renda fixa" : "Valor do aporte em renda fixa"}
              />
            </FormField>

            {isSell && !isEditing && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Resgatar:</span>
                  {SELL_PCT_SHORTCUTS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        triggerSensory("selection");
                        const cents = Math.round(fixedIncomeGrossBalance * s.pct * 100);
                        onTotalCentsChange(cents);
                        onPriceCentsChange(cents);
                      }}
                      className="rounded-md border border-border/80 bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {onAppliedCostCentsChange && (
                  <FormField
                    label={`Custo Original da Aplicação (${currencyTag})`}
                    htmlFor={`${idPrefix}-rf-applied-cost`}
                    helperText="Valor original investido neste lote (utilizado para apurar o lucro realizado e rentabilidade final)."
                  >
                    <MoneyInput
                      id={`${idPrefix}-rf-applied-cost`}
                      cents={appliedCostCents}
                      currency={currency}
                      onCentsChange={onAppliedCostCentsChange}
                      placeholder={moneyPlaceholder}
                      aria-label="Custo original da aplicação do lote"
                    />
                  </FormField>
                )}
              </>
            )}
          </div>
        ) : !isCash ? (
          <>
            <FormField
              label={isSell ? "Quantidade a Vender" : "Quantidade de Cotas"}
              htmlFor={`${idPrefix}-qty`}
            >
              <NumericInput
                id={`${idPrefix}-qty`}
                value={quantityStr}
                onValueChange={onQuantityChange}
                placeholder={isSell ? `Máx: ${maxSellQuantity}` : "Ex: 10"}
                aria-label={isSell ? "Quantidade a vender" : "Quantidade de cotas"}
                showCalculatorAction
              />
            </FormField>

            <FormField
              label={isSell ? `Preço de Venda (${currency})` : `Preço Unitário (${currency})`}
              htmlFor={`${idPrefix}-price`}
            >
              <MoneyInput
                id={`${idPrefix}-price`}
                cents={priceCents}
                currency={currency}
                onCentsChange={onPriceCentsChange}
                placeholder={moneyPlaceholder}
                aria-label={isSell ? `Preço de Venda (${currency})` : `Preço Unitário (${currency})`}
              />
            </FormField>
          </>
        ) : (
          <FormField
            label="Valor da Movimentação em Caixa (R$)"
            htmlFor={`${idPrefix}-cash-amount`}
            className="sm:col-span-2"
          >
            <MoneyInput
              id={`${idPrefix}-cash-amount`}
              cents={totalCents}
              onCentsChange={onTotalCentsChange}
              placeholder="R$ 0,00"
            />
          </FormField>
        )}

        <FormField
          label={isSell ? (isTotalValue ? "Data do Resgate" : "Data da Venda") : "Data da Operação"}
          className={currency !== "BRL" ? "sm:col-span-1" : "sm:col-span-2"}
        >
          <DatePicker value={date} onValueChange={onDateChange} />
        </FormField>

        {currency !== "BRL" && onFxRateBRLChange && (
          <FormField
            label={`Cotação da Moeda (R$ / ${currency})`}
            htmlFor={`${idPrefix}-fx-rate`}
            helperText="Deixe em branco para preenchimento automático pela PTAX da data."
            className="sm:col-span-1"
          >
            <NumericInput
              id={`${idPrefix}-fx-rate`}
              value={fxRateBRL}
              onNumberChange={(val) => onFxRateBRLChange(val && val > 0 ? val : null)}
              placeholder="Ex: 5,8230"
              aria-label={`Cotação da moeda ${currency} em reais`}
              maxDecimals={4}
            />
          </FormField>
        )}
      </div>

      {!isEditing && (
        <OrderBuySellPreview
          isSell={isSell}
          isCash={isCash}
          isTotalValue={isTotalValue}
          currency={currency}
          buyPreview={buyPreview}
          sellVariablePreview={sellVariablePreview}
        />
      )}

      {!isEditing && !isSell && !isCash && onFundingSourceChange && (
        <FundingSourceSelector
          value={fundingSource}
          onChange={onFundingSourceChange}
          cashBalanceBRL={cashBalanceBRL}
          orderTotalBRL={orderTotalBRL}
          label="Origem dos recursos desta compra"
        />
      )}

      {!isEditing && isSell && onCreditCashChange && (
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised/60 p-3 text-xs">
          <Checkbox
            id={`${idPrefix}-sell-sync-cash`}
            checked={creditCash}
            onCheckedChange={(c) => onCreditCashChange(Boolean(c))}
            label="Creditar o valor líquido da venda diretamente no Caixa da carteira"
          />
        </div>
      )}
    </div>
  );
}
