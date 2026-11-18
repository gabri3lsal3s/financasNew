import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker } from "@/domain/portfolio";
import {
  calculatePositionRowYoC,
  formatFixedIncomeRateLabel,
  getAllocationStatusBadgeMeta,
  getScoreBadgeMeta,
} from "@/domain/portfolio/position-grouping";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";
import { PositionMobileCardMetrics } from "./position-mobile-card-metrics";
import type { PositionRow } from "./position-types";

export interface PositionMobileCardProps {
  row: PositionRow;
  highlightId?: string | null;
  onOpen?: (assetId: string, ticker: string) => void;
  onCalibrateAsset?: (assetId: string, ticker: string, currentValueCents: number) => void;
  onEvaluateScore?: (assetId: string, ticker: string) => void;
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
  onEvaluateScore,
  onSetManualPrice,
}: PositionMobileCardProps) {
  const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
  const pctLabel = row.isCash || effectivePct === null ? "—" : formatSignedPct(effectivePct);
  const yoc = calculatePositionRowYoC(row);
  const isClickable = Boolean(onOpen);
  const resolvedSector = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
  const rfLabel = formatFixedIncomeRateLabel(row, false);
  const scoreMeta = getScoreBadgeMeta(row.score);
  const statusMeta = getAllocationStatusBadgeMeta(row.allocationStatus);

  return (
    <li
      id={`asset-card-${row.assetId}`}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs transition-colors scroll-mt-24",
        highlightId === row.assetId && "bg-primary/10 ring-2 ring-primary shadow-xs",
        isClickable && "hover:bg-surface-hover",
      )}
    >
      {isClickable ? (
        <button
          type="button"
          aria-label={`Ver detalhes de ${row.ticker}`}
          onClick={() => {
            triggerSensory("selection");
            onOpen?.(row.assetId, row.ticker);
          }}
          className="absolute inset-0 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : null}

      {/* Linha 1: Ticker, badges de governança e métricas de retorno */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0 gap-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="truncate font-mono text-base font-bold text-foreground">{row.ticker}</span>
            {rfLabel ? (
              <Badge variant={row.isMatured ? "critical" : "muted"} size="xs">
                {rfLabel}
              </Badge>
            ) : null}
            {!row.isCash && (row.score !== undefined || Boolean(onEvaluateScore)) ? (
              onEvaluateScore ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onEvaluateScore(row.assetId, row.ticker);
                  }}
                  aria-label={`Avaliar nota de ${row.ticker}`}
                  className="relative z-10 inline-flex items-center shrink-0 cursor-pointer rounded-full after:absolute after:-inset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Badge variant={scoreMeta.variant} size="xs">
                    {scoreMeta.label}
                  </Badge>
                </button>
              ) : (
                <Badge variant={scoreMeta.variant} size="xs">
                  {scoreMeta.label}
                </Badge>
              )
            ) : null}
            {!row.isCash && statusMeta ? (
              <Badge variant={statusMeta.variant} size="xs">
                {statusMeta.label}
              </Badge>
            ) : null}
          </div>
          {resolvedSector ? (
            <span className="truncate text-[11px] text-muted-foreground font-normal">
              {resolvedSector}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {row.pricingMode !== "total_value" ? (
              <MoneyText
                cents={numberToCents(row.valueBRL)}
                tone="default"
                className="text-sm font-bold text-foreground"
              />
            ) : null}
            <Badge
              variant={effectivePct === null || row.isCash ? "muted" : effectivePct >= 0 ? "positive" : "negative"}
              size="xs"
              className="font-bold tabular-nums"
            >
              {pctLabel}
            </Badge>
          </div>
          {yoc > 0 ? (
            <div className="flex items-center gap-1.5 text-[10px]">
              {row.unrealizedPct !== null ? (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                  )}
                  title={`Variação da cotação: ${formatSignedPct(row.unrealizedPct)}`}
                >
                  Cota {formatSignedPct(row.unrealizedPct)}
                </span>
              ) : null}
              <span
                className="text-portfolio font-medium tabular-nums"
                title={`Yield on Cost acumulado: ${formatCentsAsBRL(numberToCents(row.dividends ?? 0))}`}
              >
                YoC {formatPercent(yoc)}%
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Linha 2: Métricas de Custódia e ações contextuais agrupadas (M6) */}
      <PositionMobileCardMetrics
        row={row}
        onCalibrateAsset={onCalibrateAsset}
        onSetManualPrice={onSetManualPrice}
      />
    </li>
  );
}
