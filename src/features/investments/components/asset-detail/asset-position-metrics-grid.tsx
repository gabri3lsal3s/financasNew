import { useMemo } from "react";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { CeilingPriceBadge } from "@/components/modules/portfolio";
import { MoneyText } from "@/components/ui";
import {
  buildAssetCostBreakdown,
  buildUnrealizedPnlBreakdown,
  buildYieldBreakdown,
} from "@/domain/calculation-memory";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent, formatSignedPct } from "@/services/masks";
import type { AssetDetailMetrics } from "./use-asset-detail-metrics";

export interface AssetPositionMetricsGridProps {
  metrics: AssetDetailMetrics;
}

export function AssetPositionMetricsGrid({ metrics }: AssetPositionMetricsGridProps) {
  const {
    currentAsset,
    positionRow,
    isClosed,
    isTotalValue,
    isUSD,
    quantity,
    averageCost,
    totalCost,
    currentPrice,
    currentValue,
    ceilingPriceNum,
    unrealizedPnlPct,
    totalDividendsNative,
    totalDividendsBRL,
    accumulatedDividendsNative,
    periodicDividendsNative,
    yieldOnCostPct,
    totalReturnPnl,
    totalReturnPct,
    appliedCost,
    redeemedAmount,
    finalPnl,
    finalReturnPct,
    hasIrr,
    irrRate,
    irrLabel,
    irrSub,
  } = metrics;

  const costBreakdown = useMemo(() => {
    return buildAssetCostBreakdown({
      ticker: currentAsset.ticker,
      quantity,
      averagePrice: averageCost,
      currency: currentAsset.currency,
      totalCostBRL: totalCost,
      isTotalValue,
    });
  }, [averageCost, currentAsset.currency, currentAsset.ticker, isTotalValue, quantity, totalCost]);

  const pnlBreakdown = useMemo(() => {
    return buildUnrealizedPnlBreakdown({
      ticker: currentAsset.ticker,
      currentValueBRL: currentValue,
      totalCostBRL: totalCost,
      unrealizedPnlBRL: currentValue - totalCost,
      unrealizedPnlPct,
      totalDividendsBRL,
      totalReturnPnlBRL: totalReturnPnl ?? 0,
      totalReturnPct,
    });
  }, [
    currentAsset.ticker,
    currentValue,
    totalCost,
    totalDividendsBRL,
    totalReturnPct,
    totalReturnPnl,
    unrealizedPnlPct,
  ]);

  const yieldBreakdown = useMemo(() => {
    return buildYieldBreakdown({
      ticker: currentAsset.ticker,
      currency: currentAsset.currency,
      dividendsAmount: totalDividendsNative,
      totalCost,
      currentValue,
      yieldOnCostPct,
      periodicDividends: periodicDividendsNative,
      accumulatedDividends: accumulatedDividendsNative,
    });
  }, [
    accumulatedDividendsNative,
    currentAsset.currency,
    currentAsset.ticker,
    currentValue,
    periodicDividendsNative,
    totalCost,
    totalDividendsNative,
    yieldOnCostPct,
  ]);

  if (isClosed) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Custódia</span>
          <MoneyText cents={0} tone="default" className="text-sm sm:text-base font-bold text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-mono">Posição liquidada</span>
        </div>

        <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Total Aplicado</span>
          <MoneyText cents={numberToCents(appliedCost)} tone="default" className="text-sm sm:text-base font-bold" />
          <span className="text-[11px] text-muted-foreground font-mono">Custo histórico</span>
        </div>

        <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Total Resgatado</span>
          <MoneyText cents={numberToCents(redeemedAmount)} tone="default" className="text-sm sm:text-base font-bold" />
          <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
            {totalDividendsNative > 0 ? (
              <>
                +{" "}
                <MoneyText cents={numberToCents(totalDividendsNative)} currency={currentAsset.currency} variant="caption" tone="default" />{" "}
                proventos
              </>
            ) : (
              "Crédito em caixa"
            )}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Rentabilidade Final</span>
          <MoneyText
            cents={numberToCents(finalPnl)}
            sign="explicit"
            tone={finalPnl >= 0 ? "positive" : "negative"}
            className="text-sm sm:text-base font-bold"
          />
          <span className={cn("num text-[11px] font-mono font-semibold", finalPnl >= 0 ? "text-positive-strong" : "text-critical-strong")}>
            {finalReturnPct !== null ? `${formatSignedPct(finalReturnPct)} realizado` : "—"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground">
          {isTotalValue ? "Saldo Atual" : "Posição Total"}
        </span>
        <MoneyText cents={numberToCents(currentValue)} tone="default" className="text-sm sm:text-base font-bold" />
        <span className="text-[11px] text-muted-foreground font-mono truncate">
          {isTotalValue
            ? currentAsset.fixed_income_metadata?.rate_value && currentAsset.fixed_income_metadata.rate_value > 0
              ? "Na curva projetada"
              : "Saldo cadastrado manual"
            : `${formatAssetQuantity(quantity, currentAsset.asset_class ?? undefined)} cota(s)`}
        </span>
      </div>

      <div className="group flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            {isTotalValue ? "Valor Aplicado" : "Preço Médio (PM)"}
          </span>
          <CalculationMemoryModal breakdown={costBreakdown} />
        </div>
        <MoneyText
          cents={numberToCents(isTotalValue ? totalCost : averageCost)}
          currency={isTotalValue ? "BRL" : currentAsset.currency}
          tone="default"
          className="text-sm sm:text-base font-bold"
        />
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground font-mono">
          <span>{isTotalValue ? "Aporte inicial" : <>Custo: <MoneyText cents={numberToCents(totalCost)} currency="BRL" variant="caption" tone="default" /></>}</span>
          {ceilingPriceNum !== null && !isTotalValue && (
            <CeilingPriceBadge
              ceilingPrice={ceilingPriceNum}
              currentPrice={currentPrice}
              currency={currentAsset.currency}
            />
          )}
        </div>
      </div>

      <div className="group flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            {isTotalValue ? "Rendimento Total" : "Resultado Total"}
          </span>
          <CalculationMemoryModal breakdown={pnlBreakdown} />
        </div>
        <MoneyText
          cents={numberToCents(totalReturnPnl ?? 0)}
          sign="explicit"
          tone={(totalReturnPnl ?? 0) >= 0 ? "positive" : "negative"}
          className="text-sm sm:text-base font-bold"
        />
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className={cn("num font-semibold", (totalReturnPct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong")}>
            {formatSignedPct(totalReturnPct ?? 0)}
          </span>
          {totalDividendsNative > 0 && !isTotalValue ? (
            <span className="num text-muted-foreground text-[11px]">
              (Cotação {formatSignedPct(unrealizedPnlPct ?? 0)})
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
        <span
          className="text-[11px] font-medium text-muted-foreground"
          title="Taxa Interna de Retorno ponderada pelas datas de aportes, resgates e proventos"
        >
          TIR do Ativo
        </span>
        <span
          className={cn(
            "num font-mono text-sm sm:text-base font-bold whitespace-nowrap",
            hasIrr ? ((irrRate ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong") : "text-muted-foreground",
          )}
        >
          {irrLabel}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono truncate">{irrSub}</span>
      </div>

      {isTotalValue && totalDividendsNative === 0 ? (
        <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Vencimento</span>
          <span className="font-mono text-sm sm:text-base font-bold text-foreground whitespace-nowrap tabular-nums">
            {positionRow?.maturityDate ? formatDateBR(positionRow.maturityDate) : "Indeterminado"}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono truncate">
            {positionRow?.isMatured
              ? "Título vencido"
              : currentAsset.fixed_income_metadata?.is_tax_exempt
                ? "Isento de IR"
                : positionRow?.fixedIncomeResult?.hasExplicitTaxInfo
                  ? positionRow?.fixedIncomeResult?.taxCountdown
                    ? `IR ${positionRow.taxRatePct}% (cai p/ ${positionRow.fixedIncomeResult.taxCountdown.nextRatePct}% em ${positionRow.fixedIncomeResult.taxCountdown.daysRemaining}d)`
                    : `IR ${positionRow?.taxRatePct ?? 22.5}%`
                  : "Acumulativo"}
          </span>
        </div>
      ) : (
        <div className="group flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">Yield on Cost (YoC)</span>
            <CalculationMemoryModal breakdown={yieldBreakdown} />
          </div>
          <span className="num font-mono text-sm sm:text-base font-bold text-positive-strong whitespace-nowrap">
            {formatPercent(yieldOnCostPct)}%
          </span>
          {accumulatedDividendsNative > 0 ? (
            <div className="flex flex-col gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                Extrato: <MoneyText cents={numberToCents(periodicDividendsNative)} currency={currentAsset.currency} variant="caption" tone="default" />
              </span>
              <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                Acumulados: <MoneyText cents={numberToCents(accumulatedDividendsNative)} currency={currentAsset.currency} variant="caption" tone="default" />
              </span>
              <span className="text-[11px] text-muted-foreground font-mono font-semibold whitespace-nowrap">
                Total: <MoneyText cents={numberToCents(totalDividendsNative)} currency={currentAsset.currency} variant="caption" tone="default" />
                {isUSD && totalDividendsNative > 0 ? (
                  <span className="font-normal text-muted-foreground ml-1">
                    (≈ <MoneyText cents={numberToCents(totalDividendsBRL)} currency="BRL" variant="caption" tone="default" />)
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
              Proventos: <MoneyText cents={numberToCents(totalDividendsNative)} currency={currentAsset.currency} variant="caption" tone="default" />
              {isUSD && totalDividendsNative > 0 ? (
                <span className="font-normal text-muted-foreground ml-1">
                  (≈ <MoneyText cents={numberToCents(totalDividendsBRL)} currency="BRL" variant="caption" tone="default" />)
                </span>
              ) : null}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
