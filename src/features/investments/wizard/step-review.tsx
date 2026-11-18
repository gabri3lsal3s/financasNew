import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { classifyAssetValuation } from "@/domain/portfolio";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  ReviewDividendAndSplitSections,
  ReviewNewAssetGovernanceSummary,
  ReviewOrderTotalRow,
} from "./step-review-sections";
import { calculateInvestmentPreview, parseNumber, type InvestmentWizardState } from "./wizard-state";
import { getWizardModeBadge } from "./wizard-step-rules";

export interface StepReviewProps {
  state: InvestmentWizardState;
  cashAvailableBRL?: number;
  usdRate?: number;
}

export function StepReview({ state, cashAvailableBRL = 0, usdRate }: StepReviewProps) {
  const preview = useMemo(
    () => calculateInvestmentPreview(state, cashAvailableBRL, usdRate),
    [state, cashAvailableBRL, usdRate],
  );

  const mode = state.mode;
  const parsedQty = parseNumber(state.quantityStr);
  const { isCash, isFixedIncome, isTotalValue } = classifyAssetValuation(state);
  const badgeInfo = getWizardModeBadge(mode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary-strong">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span>Resumo da Operação</span>
      </div>

      <div className="flex flex-col divide-y divide-border/80 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-lg font-bold text-foreground truncate">{state.ticker}</span>
            <span className="text-xs text-muted-foreground truncate">{state.name || state.assetClass}</span>
          </div>
          <Badge variant={badgeInfo.variant} size="sm">
            {badgeInfo.label}
          </Badge>
        </div>

        {(mode === "buy" || mode === "existing_aporte" || mode === "new_asset") && (
          <>
            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">
                  {isTotalValue
                    ? mode === "new_asset"
                      ? "Preço Inicial"
                      : "Valor do Aporte"
                    : mode === "new_asset"
                      ? "Cotas Iniciais"
                      : "Cotas Adicionadas"}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {isTotalValue ? (
                    <MoneyText cents={state.totalCents || state.priceCents} currency={state.currency} />
                  ) : isCash ? (
                    "—"
                  ) : (
                    `${parsedQty} cotas`
                  )}
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">
                  {isTotalValue
                    ? "Saldo Atual Aplicado"
                    : mode === "new_asset"
                      ? "Preço Médio Inicial"
                      : "Preço do Aporte"}
                </span>
                <MoneyText
                  cents={isTotalValue ? numberToCents(state.selectedAsset?.average_price ?? 0) : state.priceCents}
                  currency={state.currency}
                  className="text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 text-xs bg-surface-raised/60 -mx-4 px-4">
              <div className="flex flex-col">
                <span className="text-muted-foreground">
                  {isTotalValue ? "Novo Saldo Aplicado" : "Nova Quantidade Total"}
                </span>
                <span className="font-mono text-sm font-bold text-primary-strong">
                  {isTotalValue ? (
                    <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} className="font-bold text-primary-strong" />
                  ) : isCash ? (
                    "—"
                  ) : (
                    `${preview.newQuantity} cotas`
                  )}
                </span>
              </div>

              {!isTotalValue && (
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground">Novo Preço Médio</span>
                  <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} className="text-sm font-bold text-primary-strong" />
                </div>
              )}
            </div>

            <div className="pt-3 flex flex-col gap-2 text-xs">
              <ReviewOrderTotalRow label="Valor Total da Operação:" currency={state.currency} preview={preview} />
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Data da Operação:</span>
                <span className="font-mono font-medium text-foreground">{formatDateBR(state.date)}</span>
              </div>
              {preview.cashDebitBRL > 0 && (
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Débito do Caixa (R$):</span>
                  <span className="font-mono text-negative-strong">
                    − <MoneyText cents={numberToCents(preview.cashDebitBRL)} currency="BRL" variant="caption" tone="negative" className="inline" />
                  </span>
                </div>
              )}
              {preview.contributionBRL > 0 && (
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Registrado como Aporte do Mês (R$):</span>
                  <span className="font-mono text-positive-strong">
                    + <MoneyText cents={numberToCents(preview.contributionBRL)} currency="BRL" variant="caption" tone="positive" className="inline" />
                  </span>
                </div>
              )}
              {mode === "new_asset" && !isCash && (
                <ReviewNewAssetGovernanceSummary state={state} isFixedIncome={isFixedIncome} />
              )}
            </div>
          </>
        )}

        {mode === "sell" && (
          <>
            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isTotalValue ? "Valor a Resgatar" : "Cotas Vendidas"}</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {isTotalValue ? <MoneyText cents={state.totalCents || state.priceCents} currency={state.currency} /> : `${parsedQty} cotas`}
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">{isTotalValue ? "Saldo Bruto Anterior" : "Preço de Venda"}</span>
                <MoneyText
                  cents={
                    isTotalValue
                      ? numberToCents(
                          preview.remainingGrossValue !== undefined
                            ? preview.remainingGrossValue + (state.totalCents || state.priceCents) / 100
                            : (state.selectedAsset?.fixed_income_metadata?.base_value ?? state.selectedAsset?.average_price ?? 0),
                        )
                      : state.priceCents
                  }
                  currency={state.currency}
                  className="text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 text-xs bg-surface-raised/60 -mx-4 px-4">
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isTotalValue ? "Saldo Bruto Restante" : "Custódia Restante"}</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {isTotalValue ? (
                    <MoneyText cents={numberToCents(preview.remainingGrossValue ?? preview.newAveragePrice)} currency={state.currency} />
                  ) : (
                    `${preview.newQuantity} cotas`
                  )}
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">{isTotalValue ? "Custo Original Restante" : "Resultado Realizado"}</span>
                {isTotalValue ? (
                  <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} className="text-sm font-bold" />
                ) : (
                  <span className={cn("font-mono text-sm font-bold", (preview.realizedPnl ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong")}>
                    {(preview.realizedPnl ?? 0) >= 0 ? "+" : ""}
                    <MoneyText cents={numberToCents(preview.realizedPnl ?? 0)} currency={state.currency} className="inline text-sm font-bold" />
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 flex flex-col gap-2 text-xs">
              <ReviewOrderTotalRow label="Valor Total da Venda:" currency={state.currency} preview={preview} />
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>{isTotalValue ? "Data do Resgate:" : "Data da Venda:"}</span>
                <span className="font-mono font-medium text-foreground">{formatDateBR(state.date)}</span>
              </div>
              {preview.taxAmountBRL !== undefined && preview.taxAmountBRL > 0 && (
                <div className="flex items-center justify-between text-warning-strong text-[11px]">
                  <span>IRRF Retido na Fonte ({preview.taxRatePct ?? 0}%):</span>
                  <span className="font-mono font-medium">
                    − <MoneyText cents={numberToCents(preview.taxAmountBRL)} currency="BRL" variant="caption" className="inline text-warning-strong" />
                  </span>
                </div>
              )}
              {state.syncCash && (
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Crédito Líquido em Caixa (R$):</span>
                  <span className="font-mono text-positive-strong">
                    + <MoneyText cents={numberToCents(preview.cashCreditBRL ?? preview.totalOrderValueBRL)} currency="BRL" variant="caption" tone="positive" className="inline" />
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <ReviewDividendAndSplitSections state={state} preview={preview} />
      </div>
    </div>
  );
}
