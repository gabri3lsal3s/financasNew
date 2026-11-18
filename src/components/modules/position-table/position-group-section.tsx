import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";
import {
  getAssetClassMeta,
  PositionMobileCard,
  type PositionRow,
  type PositionTableProps,
} from "@/components/modules/portfolio";
import type { PositionColumnDef } from "./position-columns";
import { PositionDesktopHeader, PositionDesktopRow } from "./position-desktop-row";

export interface PositionGroupSectionProps {
  mode: "class" | "sector";
  variant: "mobile" | "desktop";
  groupKey: string;
  primaryTitle: string;
  secondaryClassLabel?: string;
  classNameForIcon: string;
  count: number;
  totalValueBRL: number;
  totalPct: number;
  groupRentab: number | null;
  rows: readonly PositionRow[];
  isExpanded: boolean;
  onToggle: () => void;
  highlightId?: string | null;
  columns: readonly PositionColumnDef[];
  onOpen?: (assetId: string, ticker: string) => void;
  onCalibrateAsset?: PositionTableProps["onCalibrateAsset"];
  onEvaluateScore?: PositionTableProps["onEvaluateScore"];
  onSetManualPrice?: PositionTableProps["onSetManualPrice"];
}

export function PositionGroupSection({
  mode,
  variant,
  primaryTitle,
  secondaryClassLabel,
  classNameForIcon,
  count,
  totalValueBRL,
  totalPct,
  groupRentab,
  rows,
  isExpanded,
  onToggle,
  highlightId,
  columns,
  onOpen,
  onCalibrateAsset,
  onEvaluateScore,
  onSetManualPrice,
}: PositionGroupSectionProps) {
  const meta = getAssetClassMeta(classNameForIcon);
  const Icon = meta.icon;
  const ariaPrefix = mode === "sector" ? "Setor" : "Classe";
  const ariaLabel = `${ariaPrefix} ${primaryTitle}, ${count} ativos, total de ${totalValueBRL} reais`;

  const handleToggle = () => {
    triggerSensory("selection");
    onToggle();
  };

  if (variant === "mobile") {
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-label={ariaLabel}
          className="flex w-full flex-col gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg transition-colors hover:bg-surface-hover/50 p-1 -m-1 min-h-11"
        >
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              {mode === "sector" ? (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground tracking-tight truncate">
                    {primaryTitle}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium">{secondaryClassLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {count} {count === 1 ? "ativo" : "ativos"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-foreground tracking-tight truncate">
                    {primaryTitle}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    ({count} {count === 1 ? "ativo" : "ativos"})
                  </span>
                </div>
              )}
            </div>
            <span className="text-muted-foreground shrink-0 p-1">
              {isExpanded ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-4" aria-hidden="true" />
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 w-full pt-2 border-t border-border/50">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] text-muted-foreground">Saldo:</span>
              <MoneyText
                cents={numberToCents(totalValueBRL)}
                tone="default"
                className="text-xs font-bold text-foreground"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="muted" size="xs">
                {formatPercent(totalPct)}%
              </Badge>
              {groupRentab !== null ? (
                <Badge variant={groupRentab >= 0 ? "positive" : "negative"} size="xs">
                  {formatSignedPct(groupRentab)}
                </Badge>
              ) : null}
            </div>
          </div>
        </button>

        {isExpanded ? (
          <ul className="flex flex-col gap-2 pt-2 border-t border-border/50">
            {rows.map((row) => (
              <PositionMobileCard
                key={row.assetId}
                row={row}
                highlightId={highlightId}
                onOpen={onOpen}
                onCalibrateAsset={onCalibrateAsset}
                onEvaluateScore={onEvaluateScore}
                onSetManualPrice={onSetManualPrice}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-3 bg-surface-hover/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border-y border-border/50 first:border-t-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="truncate text-xs font-bold uppercase tracking-wider text-foreground">
            {primaryTitle}
          </span>
          {mode === "sector" && secondaryClassLabel ? (
            <Badge variant="muted" size="xs">
              {secondaryClassLabel}
            </Badge>
          ) : null}
          <span className="text-[11px] text-muted-foreground shrink-0">
            ({count} {count === 1 ? "ativo" : "ativos"})
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <MoneyText
                cents={numberToCents(totalValueBRL)}
                tone="default"
                className="font-bold text-foreground"
              />
              <span className="text-muted-foreground tabular-nums">({formatPercent(totalPct)}%)</span>
            </div>
            {groupRentab !== null ? (
              <Badge
                variant={groupRentab >= 0 ? "positive" : "negative"}
                size="xs"
                className={cn("font-semibold tabular-nums")}
              >
                {formatSignedPct(groupRentab)}
              </Badge>
            ) : null}
          </div>
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="bg-surface border-t border-border/50">
          <PositionDesktopHeader columns={columns} isSubHeader />
          {rows.map((row) => (
            <PositionDesktopRow
              key={row.assetId}
              row={row}
              columns={columns}
              isHighlighted={highlightId === row.assetId}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
