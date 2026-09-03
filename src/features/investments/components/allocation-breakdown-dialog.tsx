import { Layers, PieChart, Target, TrendingDown, TrendingUp, ArrowUpRight } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker } from "@/domain/portfolio";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
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
 *
 * Exibido ao clicar nas fatias/legendas dos gráficos Donut ou nas telas de metas.
 * Apresenta o patrimônio consolidado do grupo, custo, rentabilidade não realizada,
 * proventos acumulados, comparativo com a meta e a lista detalhada de ativos.
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

  // Filtra ativos pertencentes ao grupo selecionado
  const matchedRows = rows.filter((r) => {
    if (type === "class") {
      const cls = r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe");
      return cls === groupName;
    }
    // Setor
    const sec = r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass);
    if (sec !== groupName) return false;
    if (parentClassName && r.assetClass && r.assetClass !== parentClassName) {
      return false;
    }
    return true;
  });

  // Agregações financeiras
  const groupTotalBRL = matchedRows.reduce((acc, r) => acc + r.valueBRL, 0);
  const groupCostBRL = matchedRows.reduce((acc, r) => acc + r.totalCostBRL, 0);
  const groupUnrealizedPnlBRL = groupTotalBRL - groupCostBRL;
  const groupUnrealizedPct = groupCostBRL > 0 ? (groupUnrealizedPnlBRL / groupCostBRL) * 100 : 0;
  const groupDividendsBRL = matchedRows.reduce((acc, r) => acc + (r.dividends ?? 0), 0);

  const currentPctOfPortfolio = totalPortfolioBRL > 0 ? (groupTotalBRL / totalPortfolioBRL) * 100 : 0;
  const hasTarget = targetPercent !== null && targetPercent !== undefined && targetPercent > 0;
  const gap = hasTarget ? targetPercent - currentPctOfPortfolio : 0;
  const isUnderallocated = gap > 0;

  // Ordenação por valor decrescente
  const sortedRows = [...matchedRows].sort((a, b) => b.valueBRL - a.valueBRL);

  const handleAssetClick = (assetId: string) => {
    triggerSensory("selection");
    onOpenChange(false);
    onSelectAsset?.(assetId);
  };

  const handleGoToTargets = () => {
    triggerSensory("selection");
    onOpenChange(false);
    onNavigateToTargets?.();
  };

  return (
    <ResponsiveDialog
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
        <div className="flex items-center gap-2">
          {type === "class" ? (
            <Badge variant="muted" size="sm" className="gap-1 font-medium">
              <Layers className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Classe</span>
            </Badge>
          ) : (
            <Badge variant="muted" size="sm" className="gap-1 font-medium">
              <PieChart className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Setor</span>
            </Badge>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between w-full gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>

          {onNavigateToTargets ? (
            <Button
              type="button"
              size="sm"
              onClick={handleGoToTargets}
              className="w-full sm:w-auto gap-1.5"
            >
              <Target className="size-3.5" aria-hidden="true" />
              <span>Ajustar metas de alocação</span>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Grade de Métricas e KPIs Consolidados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Posição Atual */}
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Posição Atual
            </span>
            <div className="num font-mono text-base sm:text-lg font-bold text-foreground">
              <MoneyText cents={numberToCents(groupTotalBRL)} />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {currentPctOfPortfolio.toFixed(1)}% da carteira
            </span>
          </div>

          {/* Meta e Gap */}
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Meta de Alocação
            </span>
            <div className="num font-mono text-base sm:text-lg font-bold text-foreground">
              {hasTarget ? `${targetPercent.toFixed(1)}%` : "Sem meta"}
            </div>
            {hasTarget ? (
              <span
                className={cn(
                  "text-[11px] font-mono font-medium",
                  isUnderallocated ? "text-positive-strong" : "text-muted-foreground",
                )}
              >
                {isUnderallocated ? `+${gap.toFixed(1)}% (Recebe aporte)` : `${gap.toFixed(1)}% (Acima)`}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Definir nas Metas</span>
            )}
          </div>

          {/* Rentabilidade Não Realizada */}
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Rentabilidade
            </span>
            <div
              className={cn(
                "num font-mono text-base sm:text-lg font-bold flex items-center gap-1",
                groupUnrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {groupUnrealizedPnlBRL >= 0 ? (
                <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{groupUnrealizedPct >= 0 ? "+" : ""}{groupUnrealizedPct.toFixed(2)}%</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {groupUnrealizedPnlBRL >= 0 ? "+" : ""}
              <MoneyText cents={numberToCents(groupUnrealizedPnlBRL)} tone={groupUnrealizedPnlBRL >= 0 ? "positive" : "negative"} />
            </span>
          </div>

          {/* Proventos Acumulados */}
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Proventos Totais
            </span>
            <div className="num font-mono text-base sm:text-lg font-bold text-positive-strong">
              <MoneyText cents={numberToCents(groupDividendsBRL)} tone="positive" />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Custo: <MoneyText cents={numberToCents(groupCostBRL)} tone="default" />
            </span>
          </div>
        </div>

        {/* Lista de Ativos do Grupo */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Ativos em Custódia ({matchedRows.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Toque no ativo para abrir a ficha completa
            </span>
          </div>

          {sortedRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
              Nenhum ativo alocado neste grupo.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden shadow-2xs">
              {sortedRows.map((row) => {
                const relativePctInGroup = groupTotalBRL > 0 ? (row.valueBRL / groupTotalBRL) * 100 : 0;
                const assetUnrealizedPnl = row.unrealizedPnl;
                const assetUnrealizedPct = row.unrealizedPct;

                return (
                  <div
                    key={row.assetId}
                    onClick={() => handleAssetClick(row.assetId)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 hover:bg-surface-hover/60 transition-colors cursor-pointer"
                  >
                    {/* Identificação do Ativo */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {row.ticker}
                        </span>
                        {row.sector ? (
                          <Badge variant="muted" size="xs">
                            {row.sector}
                          </Badge>
                        ) : null}
                        {row.currency === "USD" ? (
                          <Badge variant="portfolio" size="xs">
                            USD
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {row.quantity} cota(s) @ <MoneyText cents={numberToCents(row.averageCost)} currency={row.currency} />
                      </span>
                    </div>

                    {/* Dados Financeiros */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                      {/* Posição e Participação */}
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="font-mono text-xs sm:text-sm font-semibold text-foreground">
                          <MoneyText cents={numberToCents(row.valueBRL)} />
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {relativePctInGroup.toFixed(1)}% do grupo · {row.pct.toFixed(1)}% total
                        </span>
                      </div>

                      {/* Variação */}
                      <div className="flex flex-col items-end shrink-0 min-w-[70px]">
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold",
                            assetUnrealizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong",
                          )}
                        >
                          {assetUnrealizedPct !== null
                            ? `${assetUnrealizedPct >= 0 ? "+" : ""}${assetUnrealizedPct.toFixed(1)}%`
                            : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {assetUnrealizedPnl >= 0 ? "+" : ""}
                          <MoneyText cents={numberToCents(assetUnrealizedPnl)} tone={assetUnrealizedPnl >= 0 ? "positive" : "negative"} />
                        </span>
                      </div>

                      <ArrowUpRight className="size-4 text-muted-foreground shrink-0 hidden sm:block" aria-hidden="true" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
