import { Badge, FormField, MoneyInput, MoneyText, NumericInput } from "@/components/ui";
import { formatPercent } from "@/services/masks";
import { cn } from "@/lib/utils";
import type { AssetCurrency } from "@/types";

export interface AssetCustodyPositionFieldsProps {
  idPrefix: string;
  isNewPosition?: boolean;
  cashInputMode?: "numeric" | "money";
  currency: AssetCurrency;
  isCash: boolean;
  isTesouro: boolean;
  isFixedIncome: boolean;
  isClosed?: boolean;
  isTotalValueMode: boolean;
  quantityStr: string;
  onQuantityStrChange: (value: string) => void;
  averagePriceCents: number;
  onAveragePriceCentsChange: (cents: number) => void;
  initialPriceCents: number;
  onInitialPriceCentsChange: (cents: number) => void;
  currentPriceCents: number;
  onCurrentPriceCentsChange: (cents: number) => void;
}

export function AssetCustodyPositionFields({
  idPrefix,
  isNewPosition = false,
  cashInputMode = "money",
  currency,
  isCash,
  isTesouro,
  isFixedIncome,
  isClosed = false,
  isTotalValueMode,
  quantityStr,
  onQuantityStrChange,
  averagePriceCents,
  onAveragePriceCentsChange,
  initialPriceCents,
  onInitialPriceCentsChange,
  currentPriceCents,
  onCurrentPriceCentsChange,
}: AssetCustodyPositionFieldsProps) {
  const moneyPlaceholder = currency === "USD" ? "$ 0.00" : "R$ 0,00";

  if (isCash) {
    return (
      <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {isNewPosition ? "Saldo Inicial em Caixa" : "Saldo Disponível em Caixa"}
          </span>
          <Badge variant="muted" size="sm">
            1:1
          </Badge>
        </div>
        <FormField label={isNewPosition ? "Saldo em Conta (R$)" : "Saldo Atual (R$)"} htmlFor={`${idPrefix}-cash`}>
          {cashInputMode === "numeric" ? (
            <NumericInput
              id={`${idPrefix}-cash`}
              value={quantityStr}
              onValueChange={onQuantityStrChange}
              placeholder="10000,00"
              aria-label="Saldo em caixa"
              showCalculatorAction
            />
          ) : (
            <MoneyInput
              id={`${idPrefix}-cash`}
              cents={currentPriceCents}
              onCentsChange={onCurrentPriceCentsChange}
              placeholder="R$ 0,00"
              aria-label="Saldo em caixa"
            />
          )}
        </FormField>
      </div>
    );
  }

  if (isTotalValueMode) {
    const scopeTitle = isClosed
      ? "Posição Encerrada"
      : isTesouro
        ? `${isNewPosition ? "Posição Inicial" : "Posição de Custódia"} (Tesouro Direto)`
        : isFixedIncome
          ? `${isNewPosition ? "Posição Inicial" : "Posição de Custódia"} (Renda Fixa)`
          : `${isNewPosition ? "Posição Inicial" : "Posição de Custódia"} (Valoração Própria)`;

    return (
      <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">{scopeTitle}</span>
          <Badge variant={isClosed ? "muted" : "default"} size="sm">
            {isClosed ? "Liquidada" : "Valor Completo"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FormField
            label={`${isClosed ? "Custo Histórico Original / Total Aplicado" : isNewPosition ? "Valor Aplicado" : "Preço Inicial / Valor Aplicado"} (${currency})`}
            htmlFor={`${idPrefix}-initial-price`}
            helperText={
              isClosed
                ? "Valor originalmente investido para cálculo do resultado final."
                : isNewPosition
                  ? "Aporte inicial"
                  : undefined
            }
          >
            <MoneyInput
              id={`${idPrefix}-initial-price`}
              cents={initialPriceCents}
              currency={currency}
              onCentsChange={onInitialPriceCentsChange}
              placeholder={moneyPlaceholder}
              aria-label="Preço inicial investido"
            />
          </FormField>

          <FormField
            label={`${isClosed ? "Custódia Atual (Posição Liquidada)" : isNewPosition ? "Saldo Atual" : "Preço Atual / Saldo Final"} (${currency})`}
            htmlFor={`${idPrefix}-current-price`}
            helperText={
              isClosed
                ? "Título 100% resgatado (saldo em custódia zerado)."
                : isNewPosition
                  ? "Saldo do extrato bancário"
                  : undefined
            }
          >
            <MoneyInput
              id={`${idPrefix}-current-price`}
              cents={isClosed ? 0 : currentPriceCents}
              currency={currency}
              onCentsChange={isClosed ? () => {} : onCurrentPriceCentsChange}
              disabled={isClosed}
              placeholder={moneyPlaceholder}
              aria-label="Preço atual ou saldo"
            />
          </FormField>
        </div>

        {!isClosed && initialPriceCents > 0 && currentPriceCents > 0 && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 text-muted-foreground">
            <span>Rendimento Estimado:</span>
            <span className={cn("font-semibold flex items-center gap-1 font-mono", currentPriceCents >= initialPriceCents ? "text-positive-strong" : "text-negative-strong")}>
              {currentPriceCents >= initialPriceCents ? "+" : ""}
              <MoneyText cents={currentPriceCents - initialPriceCents} currency={currency} className="inline" /> (
              {formatPercent(((currentPriceCents - initialPriceCents) / initialPriceCents) * 100)}%)
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3.5 flex flex-col gap-3">
      <span className="text-xs font-semibold text-foreground">
        {isNewPosition ? "Posição Inicial em Carteira" : "Posição Atual de Custódia"}
      </span>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <FormField
          label={isNewPosition ? "Quantidade Inicial de Cotas" : "Quantidade Atual (Cotas / Unidades)"}
          htmlFor={`${idPrefix}-qty`}
        >
          <NumericInput
            id={`${idPrefix}-qty`}
            value={quantityStr}
            onValueChange={onQuantityStrChange}
            placeholder="100"
            aria-label={isNewPosition ? "Quantidade inicial de cotas" : "Quantidade de cotas"}
            showCalculatorAction
          />
        </FormField>

        <FormField label={`Preço Médio por Cota (${currency})`} htmlFor={`${idPrefix}-avgprice`}>
          <MoneyInput
            id={`${idPrefix}-avgprice`}
            cents={averagePriceCents}
            currency={currency}
            onCentsChange={onAveragePriceCentsChange}
            placeholder={moneyPlaceholder}
            aria-label="Preço médio por cota"
          />
        </FormField>
      </div>
    </div>
  );
}
