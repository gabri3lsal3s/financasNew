import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatAssetQuantity } from "@/services/formatting";
import { buildPositionPriceTooltip, type PositionRow } from "./position-types";

export interface PositionMobileCardMetricsProps {
  row: PositionRow;
  onCalibrateAsset?: (assetId: string, ticker: string, currentValueCents: number) => void;
  onSetManualPrice?: (
    assetId: string,
    ticker: string,
    currency: PositionRow["currency"],
    priceBRL: number,
    source: PositionRow["source"],
    priceQuote?: number,
    pricingMode?: PositionRow["pricingMode"],
    usdRate?: number,
  ) => void;
}

export function PositionMobileCardMetrics({
  row,
  onCalibrateAsset,
  onSetManualPrice,
}: PositionMobileCardMetricsProps) {
  const isManualRf =
    row.source === "manual" ||
    !row.fixedIncomeMetadata?.rate_value ||
    row.fixedIncomeMetadata.rate_value <= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-2.5 border-t border-border/50 text-xs">
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
          {row.pricingMode === "total_value" ? "Preço Inicial" : "Quantidade"}
        </span>
        <span className="num font-semibold text-foreground whitespace-nowrap tabular-nums">
          {row.isCash ? (
            "—"
          ) : row.pricingMode === "total_value" ? (
            <MoneyText
              cents={numberToCents(row.totalCostBRL ?? row.totalCost ?? row.averageCost)}
              currency={row.currency}
              tone="default"
            />
          ) : (
            formatAssetQuantity(row.quantity, row.assetClass ?? undefined)
          )}
        </span>
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
          {row.pricingMode === "total_value" ? "Saldo Atual" : "Preço"}
        </span>
        {row.isCash ? (
          <span className="font-semibold text-foreground whitespace-nowrap">1:1</span>
        ) : row.pricingMode === "total_value" && onCalibrateAsset ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            onClick={() => onCalibrateAsset(row.assetId, row.ticker, numberToCents(row.valueBRL))}
            aria-label={`Calibrar saldo de ${row.ticker}`}
            className="relative z-10 h-auto min-h-11 sm:min-h-6 py-1 px-1.5 -mx-1.5 justify-start font-semibold text-foreground whitespace-nowrap tabular-nums w-fit"
            title={
              row.fixedIncomeResult && row.fixedIncomeResult.businessDaysAccrued > 0
                ? `Saldo projetado (+${row.fixedIncomeResult.businessDaysAccrued}d úteis) — clique para calibrar`
                : "Calibrar saldo com extrato oficial"
            }
          >
            <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />
            {isManualRf ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                title="Saldo cadastrado manual — informe a taxa para cálculo automático"
              />
            ) : null}
          </Button>
        ) : onSetManualPrice ? (
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent="selection"
              onClick={() =>
                onSetManualPrice(
                  row.assetId,
                  row.ticker,
                  row.currency,
                  row.priceBRL,
                  row.source,
                  row.priceQuote,
                  row.pricingMode,
                  row.usdRate,
                )
              }
              aria-label={`Cotação de ${row.ticker}`}
              title={buildPositionPriceTooltip(row)}
              className="relative z-10 h-auto min-h-11 sm:min-h-6 py-1 px-1.5 -mx-1.5 justify-start font-semibold text-foreground whitespace-nowrap tabular-nums w-fit"
            >
              <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
              {row.source === "manual" ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Preço manual"
                />
              ) : row.source === "fallback" || row.isEstimate || row.staleIssue ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                  title={row.staleIssue?.message ?? "Preço estimado ou defasado"}
                />
              ) : null}
            </Button>
            {row.currency === "USD" && row.priceQuote ? (
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums -mt-0.5">
                US$ {row.priceQuote.toFixed(2)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground whitespace-nowrap tabular-nums">
              <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
              {row.source === "manual" ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Preço manual"
                />
              ) : row.source === "fallback" || row.isEstimate || row.staleIssue ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                  title={row.staleIssue?.message ?? "Preço estimado ou defasado"}
                />
              ) : null}
            </span>
            {row.currency === "USD" && row.priceQuote ? (
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                US$ {row.priceQuote.toFixed(2)}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="col-span-2 sm:col-span-1 flex items-baseline justify-between sm:flex-col sm:justify-start min-w-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/50">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
          Lucro/Prejuízo
        </span>
        {row.isCash ? (
          <span className="font-semibold text-muted-foreground">—</span>
        ) : (
          <MoneyText
            cents={numberToCents(row.unrealizedPnl)}
            tone="auto"
            sign="explicit"
            className="font-semibold whitespace-nowrap tabular-nums"
          />
        )}
      </div>
    </div>
  );
}
