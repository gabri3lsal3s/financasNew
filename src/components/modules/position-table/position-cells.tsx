import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { inferSectorFromTicker } from "@/domain/portfolio";
import {
  formatFixedIncomeRateLabel,
  getAllocationStatusBadgeMeta,
  getScoreBadgeMeta,
} from "@/domain/portfolio/position-grouping";
import { cn } from "@/lib/utils";
import type { PositionRow } from "@/components/modules/portfolio/position-types";
import { triggerSensory } from "@/services/sensory";

export interface PositionTickerCellProps {
  row: PositionRow;
  onOpen?: (assetId: string, ticker: string) => void;
  onEvaluateScore?: (assetId: string, ticker: string) => void;
}

export function PositionTickerCell({
  row,
  onOpen,
  onEvaluateScore,
}: PositionTickerCellProps) {
  const rfLabel = formatFixedIncomeRateLabel(row, true);
  const resolvedSector = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
  const shouldShowScore = !row.isCash && (row.score !== undefined || Boolean(onEvaluateScore));
  const scoreMeta = getScoreBadgeMeta(row.score);
  const statusMeta = getAllocationStatusBadgeMeta(row.allocationStatus);

  const scoreBadge = shouldShowScore ? (
    <Badge variant={scoreMeta.variant} size="xs">
      {scoreMeta.label}
    </Badge>
  ) : null;

  const statusBadge = !row.isCash && statusMeta ? (
    <Badge variant={statusMeta.variant} size="xs">
      {statusMeta.label}
    </Badge>
  ) : null;

  const tickerHeading = (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "truncate font-mono text-sm font-semibold text-foreground",
            onOpen && "group-hover:text-primary transition-colors",
          )}
        >
          {row.ticker}
        </span>
        {rfLabel ? (
          <Badge variant={row.isMatured ? "critical" : "muted"} size="xs">
            {rfLabel}
          </Badge>
        ) : null}
      </div>
      {resolvedSector ? (
        <span className="truncate text-[11px] text-muted-foreground font-normal">
          {resolvedSector}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {onOpen ? (
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onOpen(row.assetId, row.ticker);
          }}
          className="group inline-flex min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1 -ml-1.5 text-left transition-colors hover:bg-surface-hover/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          aria-label={`Ver detalhes de ${row.ticker}`}
          title={`Ver detalhes de ${row.ticker}`}
        >
          {tickerHeading}
        </button>
      ) : (
        <div className="flex min-w-0 flex-col gap-0.5">{tickerHeading}</div>
      )}

      {shouldShowScore || statusBadge ? (
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          {scoreBadge &&
            (onEvaluateScore ? (
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onEvaluateScore(row.assetId, row.ticker);
                }}
                aria-label={`Avaliar nota de ${row.ticker}`}
                className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {scoreBadge}
              </button>
            ) : (
              scoreBadge
            ))}
          {statusBadge}
        </div>
      ) : null}
    </div>
  );
}

export interface PositionStatusDotProps {
  dotTone: "manual" | "fallback" | "auto";
  manualTitle: string;
  fallbackTitle?: string;
  autoTitle?: string;
}

export function PositionStatusDot({
  dotTone,
  manualTitle,
  fallbackTitle,
  autoTitle,
}: PositionStatusDotProps) {
  if (dotTone === "manual") {
    return (
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
        title={manualTitle}
      />
    );
  }
  if (dotTone === "fallback") {
    return (
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
        title={fallbackTitle}
      />
    );
  }
  if (!autoTitle) return null;
  return (
    <span
      aria-hidden="true"
      className="size-1 rounded-full bg-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      title={autoTitle}
    />
  );
}

export interface PositionActionMoneyCellProps {
  cents: number;
  ariaLabel: string;
  tooltipTitle: string;
  onAction?: () => void;
  dotTone: "manual" | "fallback" | "auto";
  manualTitle: string;
  fallbackTitle?: string;
  autoTitle?: string;
  emphasized?: boolean;
}

export function PositionActionMoneyCell({
  cents,
  ariaLabel,
  tooltipTitle,
  onAction,
  dotTone,
  manualTitle,
  fallbackTitle,
  autoTitle,
  emphasized = false,
}: PositionActionMoneyCellProps) {
  const dot = (
    <PositionStatusDot
      dotTone={dotTone}
      manualTitle={manualTitle}
      fallbackTitle={fallbackTitle}
      autoTitle={autoTitle}
    />
  );

  if (onAction) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        sensoryIntent="selection"
        onClick={onAction}
        aria-label={ariaLabel}
        title={tooltipTitle}
        className="group h-auto py-0.5 px-1.5 -mr-1.5 gap-1.5 justify-end font-semibold text-foreground"
      >
        <MoneyText
          cents={cents}
          tone="default"
          className={cn(
            "group-hover:text-primary transition-colors text-sm",
            emphasized && "font-semibold text-foreground",
          )}
        />
        {dot}
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      <MoneyText
        cents={cents}
        tone="default"
        className={cn("text-sm", emphasized && "font-semibold text-foreground")}
      />
      {dotTone === "auto" ? null : dot}
    </div>
  );
}
