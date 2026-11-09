import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { calculateYieldOnCost } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatSignedPct } from "@/services/masks/percent";
import type { PositionRow } from "./position-types";
import { formatQuantity } from "./position-types";

export interface PositionMobileCardProps {
  row: PositionRow;
  highlightId?: string | null;
  onOpen?: (assetId: string, ticker: string) => void;
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

export function PositionMobileCard({
  row,
  highlightId,
  onOpen,
  onCalibrateAsset,
  onSetManualPrice,
}: PositionMobileCardProps) {
  const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
  const pctLabel = row.isCash || effectivePct === null ? "—" : formatSignedPct(effectivePct);
  const pctTone =
    row.isCash || effectivePct === null
      ? "text-muted-foreground"
      : effectivePct >= 0
        ? "text-positive-strong"
        : "text-negative-strong";
  const effectiveDividends = row.currency === "USD" ? (row.dividendsNative ?? row.dividends) : row.dividends;
  const effectiveCost =
    row.currency === "USD" ? (row.totalCost ?? row.totalCostBRL) : (row.totalCostBRL ?? row.totalCost);
  const yoc =
    effectiveDividends && effectiveDividends > 0 && effectiveCost && effectiveCost > 0
      ? calculateYieldOnCost(effectiveDividends, effectiveCost)
      : 0;
  const isClickable = Boolean(onOpen);

  return (
    <li
      id={`asset-card-${row.assetId}`}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Ver detalhes de ${row.ticker}` : undefined}
      onClick={isClickable ? () => onOpen?.(row.assetId, row.ticker) : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.(row.assetId, row.ticker);
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs transition-colors scroll-mt-24",
        highlightId === row.assetId && "bg-primary/10 ring-2 ring-primary shadow-xs",
        isClickable &&
          "cursor-pointer hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      {/* Linha 1: Ticker | Valor Total, Rentabilidade e YoC */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-mono text-base font-bold text-foreground">{row.ticker}</span>
          {row.isMatured ? (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-critical-strong shrink-0">
              Vencido
            </span>
          ) : row.fixedIncomeMetadata ? (
            <span className="rounded bg-surface-hover/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
              {row.fixedIncomeMetadata.rate_type === "cdi"
                ? `${row.fixedIncomeMetadata.rate_value}% CDI`
                : row.fixedIncomeMetadata.rate_type === "selic"
                  ? `${row.fixedIncomeMetadata.rate_value}% Selic`
                  : row.fixedIncomeMetadata.rate_type === "pre"
                    ? `${row.fixedIncomeMetadata.rate_value}% a.a.`
                    : `IPCA + ${row.fixedIncomeMetadata.rate_value}%`}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              {row.pricingMode !== "total_value" && (
                <MoneyText
                  cents={numberToCents(row.valueBRL)}
                  tone="default"
                  className="text-sm font-bold text-foreground"
                />
              )}
              <span
                className={cn(
                  "num text-xs font-bold px-1.5 py-0.5 rounded",
                  pctTone,
                  effectivePct !== null && effectivePct >= 0 ? "bg-positive/10" : "bg-negative/10",
                )}
              >
                {pctLabel}
              </span>
            </div>
            {yoc > 0 ? (
              <div className="flex items-center gap-1.5 text-[10px]">
                {row.unrealizedPct !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                    title={`Variação da cotação: ${formatSignedPct(row.unrealizedPct)}`}
                  >
                    Cota {formatSignedPct(row.unrealizedPct)}
                  </span>
                ) : null}
                <span
                  className="text-portfolio font-medium"
                  title={`Yield on Cost acumulado: ${formatCentsAsBRL(numberToCents(row.dividends ?? 0))}`}
                >
                  YoC {yoc.toFixed(1)}%
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Linha 2: Métricas de Custódia em layout adaptativo mobile-first */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-2.5 border-t border-border/50 text-xs">
        {/* Coluna 1: Preço Inicial ou Quantidade */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium whitespace-nowrap">
            {row.pricingMode === "total_value" ? "Preço Inicial" : "Quantidade"}
          </span>
          <span className="font-semibold text-foreground whitespace-nowrap tabular-nums">
            {row.isCash ? (
              "—"
            ) : row.pricingMode === "total_value" ? (
              <MoneyText
                cents={numberToCents(row.totalCostBRL ?? row.totalCost ?? row.averageCost)}
                currency={row.currency}
                tone="default"
              />
            ) : (
              formatQuantity(row.quantity)
            )}
          </span>
        </div>

        {/* Coluna 2: Saldo Atual ou Preço */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium whitespace-nowrap">
            {row.pricingMode === "total_value" ? "Saldo Atual" : "Preço"}
          </span>
          {row.isCash ? (
            <span className="font-semibold text-foreground whitespace-nowrap">1:1</span>
          ) : row.pricingMode === "total_value" && onCalibrateAsset ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCalibrateAsset(row.assetId, row.ticker, numberToCents(row.valueBRL));
              }}
              aria-label={`Calibrar saldo de ${row.ticker}`}
              className="inline-flex items-center gap-1 font-semibold text-foreground cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded whitespace-nowrap tabular-nums"
              title="Calibrar saldo com extrato oficial"
            >
              <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />
              {row.source === "manual" ||
              !row.fixedIncomeMetadata?.rate_value ||
              row.fixedIncomeMetadata.rate_value <= 0 ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Saldo cadastrado manual"
                />
              ) : null}
            </button>
          ) : onSetManualPrice ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetManualPrice(
                  row.assetId,
                  row.ticker,
                  row.currency,
                  row.priceBRL,
                  row.source,
                  row.priceQuote,
                  row.pricingMode,
                  row.usdRate,
                );
              }}
              aria-label={`Cotação de ${row.ticker}`}
              className="inline-flex items-center gap-1 font-semibold text-foreground cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded whitespace-nowrap tabular-nums"
            >
              <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
              {row.source === "manual" ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Preço manual"
                />
              ) : null}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground whitespace-nowrap tabular-nums">
              <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
              {row.source === "manual" ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Preço manual"
                />
              ) : null}
            </span>
          )}
        </div>

        {/* Coluna 3: Lucro/Prejuízo com span no mobile para nunca esmagar centavos */}
        <div className="col-span-2 sm:col-span-1 flex items-baseline justify-between sm:flex-col sm:justify-start min-w-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/30">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium whitespace-nowrap">
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
    </li>
  );
}
