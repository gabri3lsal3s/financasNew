import { Checkbox, FormField, Input, Select } from "@/components/ui";
import { DEFAULT_SECTORS_BY_CLASS } from "@/domain/portfolio/tickers-catalog";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { AssetCurrency, FixedIncomeRateType } from "@/types";
import { FixedIncomeFormFields, type FixedIncomeFormFieldsValues } from "../fixed-income-form-fields";
import { AssetCustodyPositionFields } from "./asset-custody-position-fields";
import {
  CLASSES_WITH_EDITABLE_CURRENCY,
  PORTFOLIO_ASSET_CLASS_OPTIONS,
  PORTFOLIO_CURRENCY_OPTIONS,
} from "./asset-form-constants";

export interface AssetIdentityPricingFieldsProps {
  idPrefix: string;
  isNewPosition?: boolean;
  showIdentityFields?: boolean;
  cashInputMode?: "numeric" | "money";
  ticker: string;
  onTickerChange?: (value: string) => void;
  assetClass: string;
  onAssetClassChange?: (value: string) => void;
  currency: AssetCurrency;
  onCurrencyChange: (value: AssetCurrency) => void;
  sector: string;
  onSectorChange: (value: string) => void;
  isCash: boolean;
  isTesouro: boolean;
  isFixedIncome: boolean;
  isCrypto: boolean;
  isClosed?: boolean;
  isCustomValuation: boolean;
  onCustomValuationChange: (checked: boolean) => void;
  isTotalValueMode: boolean;
  quantityStr: string;
  onQuantityStrChange: (value: string) => void;
  averagePriceCents: number;
  onAveragePriceCentsChange: (cents: number) => void;
  initialPriceCents: number;
  onInitialPriceCentsChange: (cents: number) => void;
  currentPriceCents: number;
  onCurrentPriceCentsChange: (cents: number) => void;
  fixedIncomeValues: FixedIncomeFormFieldsValues;
  onFixedIncomeChange: (patch: Partial<FixedIncomeFormFieldsValues & { rateType: FixedIncomeRateType }>) => void;
}

export function AssetIdentityPricingFields({
  idPrefix,
  isNewPosition = false,
  showIdentityFields = false,
  cashInputMode = "money",
  ticker,
  onTickerChange,
  assetClass,
  onAssetClassChange,
  currency,
  onCurrencyChange,
  sector,
  onSectorChange,
  isCash,
  isTesouro,
  isFixedIncome,
  isCrypto,
  isClosed = false,
  isCustomValuation,
  onCustomValuationChange,
  isTotalValueMode,
  quantityStr,
  onQuantityStrChange,
  averagePriceCents,
  onAveragePriceCentsChange,
  initialPriceCents,
  onInitialPriceCentsChange,
  currentPriceCents,
  onCurrentPriceCentsChange,
  fixedIncomeValues,
  onFixedIncomeChange,
}: AssetIdentityPricingFieldsProps) {
  const needsCurrencyField = CLASSES_WITH_EDITABLE_CURRENCY.has(assetClass);
  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[assetClass] ?? [];
  const isSectorChipsOnly = isFixedIncome && !isCash;
  const showSectorBlock = !isCash && (showIdentityFields || (!isFixedIncome && !isCrypto));

  return (
    <div className="flex flex-col gap-4">
      {showIdentityFields && onTickerChange && onAssetClassChange && (
        <>
          <FormField label="Código do Ativo (Ticker)" htmlFor={`${idPrefix}-ticker`}>
            <Input
              id={`${idPrefix}-ticker`}
              value={ticker}
              onChange={(e) => onTickerChange(e.target.value.toUpperCase().trim())}
              placeholder="Ex: WEGE3"
              className="font-mono uppercase font-bold"
            />
          </FormField>

          <div className={cn("grid grid-cols-1 gap-3.5", needsCurrencyField && "sm:grid-cols-2")}>
            <FormField label="Classe de Ativo">
              <Select value={assetClass} onValueChange={onAssetClassChange} options={PORTFOLIO_ASSET_CLASS_OPTIONS} />
            </FormField>

            {needsCurrencyField && (
              <FormField label="Moeda">
                <Select
                  value={currency}
                  onValueChange={(val) => onCurrencyChange(val as AssetCurrency)}
                  options={PORTFOLIO_CURRENCY_OPTIONS}
                />
              </FormField>
            )}
          </div>
        </>
      )}

      {!showIdentityFields && needsCurrencyField && (
        <FormField label="Moeda de Negociação">
          <Select
            value={currency}
            onValueChange={(val) => onCurrencyChange(val as AssetCurrency)}
            options={PORTFOLIO_CURRENCY_OPTIONS}
          />
        </FormField>
      )}

      {showSectorBlock && (
        <FormField
          label={isFixedIncome ? "Indexador / Segmento" : "Setor / Segmento"}
          htmlFor={isSectorChipsOnly ? undefined : `${idPrefix}-sector`}
          optional={isNewPosition}
          helperText={isSectorChipsOnly ? "Selecione o tipo de rendimento:" : undefined}
        >
          {!isSectorChipsOnly && (
            <Input
              id={`${idPrefix}-sector`}
              value={sector}
              onChange={(e) => onSectorChange(e.target.value)}
              placeholder="Ex: Financeiro / Bancos, Logística..."
            />
          )}
          {recommendedSectors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {recommendedSectors.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onSectorChange(s);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    sector === s
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "border border-border/80 bg-surface-raised/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </FormField>
      )}

      {!isCash && !isFixedIncome && (
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised/50 p-3">
          <Checkbox
            id={`${idPrefix}-custom-val`}
            checked={isCustomValuation}
            onCheckedChange={(checked) => onCustomValuationChange(Boolean(checked))}
            label="Valoração Própria / Ativo Não Cotado em Bolsa"
          />
          <p className="pl-6 text-[11px] text-muted-foreground">
            Permite lançar valor aplicado e saldo diretamente (sem cotas) e ignora cotações automáticas.
          </p>
        </div>
      )}

      <AssetCustodyPositionFields
        idPrefix={idPrefix}
        isNewPosition={isNewPosition}
        cashInputMode={cashInputMode}
        currency={currency}
        isCash={isCash}
        isTesouro={isTesouro}
        isFixedIncome={isFixedIncome}
        isClosed={isClosed}
        isTotalValueMode={isTotalValueMode}
        quantityStr={quantityStr}
        onQuantityStrChange={onQuantityStrChange}
        averagePriceCents={averagePriceCents}
        onAveragePriceCentsChange={onAveragePriceCentsChange}
        initialPriceCents={initialPriceCents}
        onInitialPriceCentsChange={onInitialPriceCentsChange}
        currentPriceCents={currentPriceCents}
        onCurrentPriceCentsChange={onCurrentPriceCentsChange}
      />

      {isFixedIncome && !isCash && (
        <FixedIncomeFormFields
          values={fixedIncomeValues}
          onChange={onFixedIncomeChange}
          idPrefix={`${idPrefix}-fi`}
          isTesouro={isTesouro}
        />
      )}
    </div>
  );
}
