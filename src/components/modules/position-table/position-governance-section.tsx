import { ChevronDown, LogOut, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";
import type { PositionRow } from "@/components/modules/portfolio/position-types";

export interface PositionGovernanceSectionProps {
  mode: "quarantine" | "exit";
  rows: readonly PositionRow[];
  isOpen: boolean;
  onToggle: () => void;
  onOpen?: (assetId: string, ticker: string) => void;
  onEvaluateScore?: (assetId: string, ticker: string) => void;
}

export function PositionGovernanceSection({
  mode,
  rows,
  isOpen,
  onToggle,
  onOpen,
  onEvaluateScore,
}: PositionGovernanceSectionProps) {
  if (rows.length === 0) return null;

  const isQuarantine = mode === "quarantine";
  const Icon = isQuarantine ? ShieldAlert : LogOut;
  const title = isQuarantine ? "Ativos em Quarentena" : "Ativos em Saída / Desinvestimento";
  const description = isQuarantine
    ? "Aportes pausados para revisão de tese ou fundamentos"
    : "Meta definida em 0% — aguardando momento para liquidação";

  const totalValueBRL = rows.reduce((sum, r) => sum + r.valueBRL, 0);
  const totalPnlBRL = rows.reduce((sum, r) => sum + (r.unrealizedPnl ?? 0), 0);
  const totalCostBRL = rows.reduce(
    (sum, r) => sum + Math.max(0, r.totalCostBRL ?? r.totalCost ?? (r.valueBRL - r.unrealizedPnl)),
    0,
  );
  const overallReturnPct = totalCostBRL > 0 ? (totalPnlBRL / totalCostBRL) * 100 : null;

  const handleToggle = () => {
    triggerSensory("selection");
    onToggle();
  };

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2.5 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
        aria-expanded={isOpen}
        aria-label={`${title}, ${rows.length} ${rows.length === 1 ? "ativo" : "ativos"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={cn(
              "size-4 shrink-0 transition-colors",
              isQuarantine
                ? "text-warning-strong"
                : "text-negative-strong",
            )}
            aria-hidden="true"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                {title}
              </span>
              <Badge variant={isQuarantine ? "warning" : "negative"} size="xs">
                {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">{description}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <MoneyText cents={numberToCents(totalValueBRL)} tone="default" />
              {overallReturnPct !== null ? (
                <Badge
                  variant={overallReturnPct >= 0 ? "positive" : "negative"}
                  size="xs"
                  className="font-semibold tabular-nums"
                >
                  {formatSignedPct(overallReturnPct)}
                </Badge>
              ) : null}
            </div>
            <span className="text-[10px] text-muted-foreground">Saldo sob governança</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            <span className="hidden sm:inline">{isOpen ? "Recolher" : "Expandir"}</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-180")}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="mt-3 divide-y divide-border/60 pt-2 border-t border-border/60">
          {rows.map((row) => {
            const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
            return (
              <div
                key={row.assetId}
                onClick={() => onOpen?.(row.assetId, row.ticker)}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 py-2.5 px-2 hover:bg-surface-hover/50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-bold text-foreground">{row.ticker}</span>
                  {row.assetClass ? (
                    <Badge variant="muted" size="xs">
                      {row.assetClass}
                    </Badge>
                  ) : null}
                  {row.sector ? (
                    <span className="text-xs text-muted-foreground truncate">· {row.sector}</span>
                  ) : null}
                  {row.score !== undefined && row.score !== null ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerSensory("selection");
                        onEvaluateScore?.(row.assetId, row.ticker);
                      }}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full"
                    >
                      <Badge variant={row.score >= 7 ? "positive" : row.score >= 4 ? "warning" : "negative"} size="xs">
                        Nota {row.score}
                      </Badge>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Posição Atual
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Retorno
                    </span>
                    <div className="flex items-center gap-1.5">
                      <MoneyText
                        cents={numberToCents(row.unrealizedPnl)}
                        tone="auto"
                        sign="explicit"
                        className="text-xs font-semibold tabular-nums"
                      />
                      {effectivePct !== null ? (
                        <Badge
                          variant={effectivePct >= 0 ? "positive" : "negative"}
                          size="xs"
                          className="tabular-nums"
                        >
                          {formatSignedPct(effectivePct)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
