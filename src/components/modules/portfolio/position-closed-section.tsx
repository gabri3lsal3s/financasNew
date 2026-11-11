import { Archive, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import type { PositionRow } from "./position-types";

export interface PositionClosedSectionProps {
  closedRows: PositionRow[];
  isOpen: boolean;
  onToggle: () => void;
  onOpen?: (assetId: string, ticker: string) => void;
}

export function PositionClosedSection({
  closedRows,
  isOpen,
  onToggle,
  onOpen,
}: PositionClosedSectionProps) {
  if (closedRows.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Archive
            className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate">
            Posições Encerradas ({closedRows.length}{" "}
            {closedRows.length === 1 ? "ativo liquidado" : "ativos liquidados"})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground shrink-0">
          <span>{isOpen ? "Recolher" : "Expandir histórico"}</span>
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-180")}
            aria-hidden="true"
          />
        </div>
      </button>

      {isOpen ? (
        <div className="mt-3 divide-y divide-border/60 pt-2 border-t border-border/60">
          {closedRows.map((row) => {
            const finalPnl = row.totalReturnPnl ?? row.unrealizedPnl ?? 0;
            const hasPnl = finalPnl !== 0;
            const pnlTone = finalPnl >= 0 ? "positive" : "negative";
            const returnPct =
              row.finalReturnPct !== undefined && row.finalReturnPct !== null
                ? row.finalReturnPct
                : row.historicalCostBRL && row.historicalCostBRL > 0
                  ? Math.round((finalPnl / row.historicalCostBRL) * 10000) / 100
                  : null;

            return (
              <div
                key={row.assetId}
                onClick={() => onOpen?.(row.assetId, row.ticker)}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-2 hover:bg-surface-hover/50 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
                  <Badge variant="muted" size="xs">
                    Encerrada
                  </Badge>
                  {row.assetClass ? (
                    <span className="text-xs text-muted-foreground truncate">({row.assetClass})</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 text-right">
                  {row.historicalCostBRL && row.historicalCostBRL > 0 ? (
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Aplicado
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        <MoneyText cents={numberToCents(row.historicalCostBRL)} tone="default" />
                      </span>
                    </div>
                  ) : null}

                  {row.historicalRedeemedBRL && row.historicalRedeemedBRL > 0 ? (
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Resgatado
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        <MoneyText cents={numberToCents(row.historicalRedeemedBRL)} tone="default" />
                      </span>
                    </div>
                  ) : null}

                  {row.dividends && row.dividends > 0 ? (
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Proventos
                      </span>
                      <span className="text-xs font-semibold text-positive-strong">
                        <MoneyText cents={numberToCents(row.dividends)} tone="positive" />
                      </span>
                    </div>
                  ) : null}

                  <div className="flex flex-col items-start sm:items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Resultado Final
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          finalPnl >= 0 ? "text-positive-strong" : "text-critical-strong",
                        )}
                      >
                        <MoneyText
                          cents={numberToCents(finalPnl)}
                          sign="explicit"
                          tone={hasPnl ? pnlTone : "default"}
                        />
                      </span>
                      {returnPct !== null ? (
                        <Badge variant={returnPct >= 0 ? "positive" : "critical"} size="xs">
                          {formatSignedPct(returnPct)}
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
