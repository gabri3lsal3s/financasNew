import { ArrowUpRight, Layers, PieChart, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, EmptyState, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent, formatSignedPct } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { PortfolioPositionRow } from "@/state";

export interface AllocationBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "class" | "sector";
  groupName: string | null;
  parentClassName?: string | null;
  rows: PortfolioPositionRow[];
  totalPortfolioBRL: number;
  targetPercent?: number | null;
  onSelectAsset?: (assetId: string) => void;
  onNavigateToTargets?: () => void;
}

/**
 * AllocationBreakdownDialog — Raio-X Analítico de Classes e Setores da Carteira (§F36 e §F41).
 */
export function AllocationBreakdownDialog({
  open,
  onOpenChange,
  type,
  groupName,
  parentClassName,
  rows,
  totalPortfolioBRL,
  targetPercent = null,
  onSelectAsset,
  onNavigateToTargets,
}: AllocationBreakdownDialogProps) {
  if (!groupName) return null;

  const matchedRows = rows.filter((r) => {
    if (type === "class") {
      return (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === groupName;
    }
    const sec = r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass);
    return sec === groupName && (!parentClassName || !r.assetClass || r.assetClass === parentClassName);
  });

  const groupTotalBRL = matchedRows.reduce((acc, r) => acc + r.valueBRL, 0);
  const groupCostBRL = matchedRows.reduce((acc, r) => acc + r.totalCostBRL, 0);
  const groupUnrealizedPnlBRL = groupTotalBRL - groupCostBRL;
  const groupUnrealizedPct = groupCostBRL > 0 ? (groupUnrealizedPnlBRL / groupCostBRL) * 100 : 0;
  const groupDividendsBRL = matchedRows.reduce((acc, r) => acc + (r.dividends ?? 0), 0);
  const currentPctOfPortfolio = totalPortfolioBRL > 0 ? (groupTotalBRL / totalPortfolioBRL) * 100 : 0;
  const hasTarget = targetPercent !== null && targetPercent !== undefined && targetPercent > 0;
  const gap = hasTarget ? targetPercent - currentPctOfPortfolio : 0;
  const sortedRows = [...matchedRows].sort((a, b) => b.valueBRL - a.valueBRL);

  const handleAssetClick = (assetId: string) => {
    triggerSensory("selection");
    onOpenChange(false);
    onSelectAsset?.(assetId);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={groupName}
      size="lg"
      description={
        type === "class"
          ? `Raio-X da classe de ativos · ${matchedRows.length} ativo(s) em custódia`
          : `Raio-X do setor${parentClassName ? ` (${parentClassName})` : ""} · ${matchedRows.length} ativo(s) em custódia`
      }
      headerActions={
        <Badge variant="muted" size="sm" className="gap-1 font-medium">
          {type === "class" ? <Layers className="size-3 text-muted-foreground" aria-hidden="true" /> : <PieChart className="size-3 text-muted-foreground" aria-hidden="true" />}
          <span>{type === "class" ? "Classe" : "Setor"}</span>
        </Badge>
      }
      footer={
        <ModalFooter borderless className={onNavigateToTargets ? "sm:justify-between" : undefined}>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          {onNavigateToTargets ? (
            <Button type="button" size="sm" onClick={() => { onOpenChange(false); onNavigateToTargets(); }} className="gap-1.5">
              <Target className="size-3.5" aria-hidden="true" />
              <span>Ajustar metas de alocação</span>
            </Button>
          ) : null}
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Posição Atual</span>
            <MoneyText cents={numberToCents(groupTotalBRL)} tone="default" className="text-base sm:text-lg font-bold" />
            <span className="text-[11px] text-muted-foreground font-mono">{formatPercent(currentPctOfPortfolio)}% da carteira</span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Meta de Alocação</span>
            <span className="num font-mono text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
              {hasTarget ? `${formatPercent(targetPercent)}%` : "Sem meta"}
            </span>
            <span className={cn("text-[11px] font-mono font-medium", hasTarget && gap > 0 ? "text-positive-strong" : "text-muted-foreground")}>
              {hasTarget ? (gap > 0 ? `+${formatPercent(gap)}% (Recebe aporte)` : `${formatPercent(gap)}% (Acima)`) : "Definir nas Metas"}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rentabilidade</span>
            <div className={cn("num font-mono text-base sm:text-lg font-bold flex items-center gap-1", groupUnrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong")}>
              {groupUnrealizedPnlBRL >= 0 ? <TrendingUp className="size-4 shrink-0" aria-hidden="true" /> : <TrendingDown className="size-4 shrink-0" aria-hidden="true" />}
              <span>{formatSignedPct(groupUnrealizedPct)}</span>
            </div>
            <MoneyText cents={numberToCents(groupUnrealizedPnlBRL)} sign="explicit" variant="caption" />
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Proventos Totais</span>
            <MoneyText cents={numberToCents(groupDividendsBRL)} tone="positive" className="text-base sm:text-lg font-bold" />
            <span className="text-[11px] text-muted-foreground">
              Custo: <MoneyText cents={numberToCents(groupCostBRL)} tone="default" variant="caption" />
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Ativos em Custódia ({matchedRows.length})</h4>
            <span className="text-[11px] text-muted-foreground">Toque no ativo para abrir a ficha completa</span>
          </div>

          {sortedRows.length === 0 ? (
            <EmptyState title="Nenhum ativo alocado" description="Nenhum ativo alocado neste grupo." headingLevel="h3" />
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
              {sortedRows.map((row) => {
                const relativePctInGroup = groupTotalBRL > 0 ? (row.valueBRL / groupTotalBRL) * 100 : 0;
                return (
                  <button
                    key={row.assetId}
                    type="button"
                    onClick={() => handleAssetClick(row.assetId)}
                    className="flex w-full text-left flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 hover:bg-surface-hover/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{row.ticker}</span>
                        {row.sector ? <Badge variant="muted" size="xs">{row.sector}</Badge> : null}
                        {row.currency === "USD" ? <Badge variant="portfolio" size="xs">USD</Badge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)} cota(s) @{" "}
                        <MoneyText cents={numberToCents(row.averageCost)} currency={row.currency} variant="caption" tone="default" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                      <div className="flex flex-col items-start sm:items-end">
                        <MoneyText cents={numberToCents(row.valueBRL)} tone="default" className="text-xs sm:text-sm font-semibold" />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatPercent(relativePctInGroup)}% do grupo · {formatPercent(row.pct)}% total
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 min-w-[70px]">
                        <span className={cn("num font-mono text-xs font-semibold", row.unrealizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong")}>
                          {row.unrealizedPct !== null ? formatSignedPct(row.unrealizedPct) : "—"}
                        </span>
                        <MoneyText cents={numberToCents(row.unrealizedPnl)} sign="explicit" variant="caption" />
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground shrink-0 hidden sm:block" aria-hidden="true" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
