import { useMemo, useState } from "react";
import { Calendar, Printer } from "lucide-react";
import { Badge, Button, EmptyState, Modal, usePrint } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface PortfolioSnapshotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: PortfolioMonthlySeriesPoint[];
  currentMonthStr?: string;
}

/**
 * Diálogo modal analítico de evolução patrimonial histórica.
 *
 * Apresenta a auditoria completa mês a mês dos snapshots em formato tabular
 * (padrão CVM/ANBIMA), com filtros por ano, métricas consolidadas do período
 * e opção de impressão/PDF.
 */
export function PortfolioSnapshotsDialog({
  open,
  onOpenChange,
  series,
  currentMonthStr,
}: PortfolioSnapshotsDialogProps) {
  const { printing, triggerPrint } = usePrint("Extrato_Evolucao_Patrimonial.pdf");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // Anos únicos presentes na série (ordenados decrescentemente)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    for (const point of series) {
      const yr = point.month.slice(0, 4);
      if (yr) yearsSet.add(yr);
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [series]);

  // Série filtrada pelo ano selecionado
  const filteredSeries = useMemo(() => {
    if (selectedYear === "all") {
      return series;
    }
    return series.filter((pt) => pt.month.startsWith(selectedYear));
  }, [series, selectedYear]);

  // Ordenação cronológica decrescente para tabela (mais recente no topo)
  const sortedTablePoints = useMemo(() => {
    return [...filteredSeries].sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredSeries]);

  // Métricas de resumo do período filtrado
  const summary = useMemo(() => {
    if (filteredSeries.length === 0) {
      return {
        totalMonths: 0,
        latestValueBRL: 0,
        latestCostBRL: 0,
        periodDividendsBRL: 0,
        latestTwrPct: null,
      };
    }

    // Cronologicamente ordenado (do mais antigo ao mais recente)
    const chronological = [...filteredSeries].sort((a, b) => a.month.localeCompare(b.month));
    const latest = chronological[chronological.length - 1];
    const earliest = chronological[0];

    const latestValueBRL = latest?.valueBRL ?? 0;
    const latestCostBRL = latest?.costBRL ?? 0;

    // Proventos auferidos no período selecionado
    const periodDividendsBRL = chronological.reduce(
      (acc, pt) => acc + (pt.monthDividendsBRL ?? 0),
      0,
    );

    // TWR do ponto mais recente do período
    const latestTwrPct = latest?.twrAccumulatedPct ?? null;

    return {
      totalMonths: chronological.length,
      latestValueBRL,
      latestCostBRL,
      periodDividendsBRL:
        periodDividendsBRL > 0
          ? periodDividendsBRL
          : (latest?.accumulatedDividendsBRL ?? 0) - (earliest?.accumulatedDividendsBRL ?? 0),
      latestTwrPct,
    };
  }, [filteredSeries]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Extrato Analítico de Evolução Patrimonial"
      description="Auditoria cronológica da evolução de patrimônio, custos, proventos e rentabilidade ponderada (TWR) mês a mês."
      size="2xl"
      headerActions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => triggerPrint()}
          disabled={printing || series.length === 0}
          className="gap-1.5 h-8 text-xs px-2.5 print:hidden cursor-pointer"
        >
          <Printer className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {printing ? "Preparando..." : "Imprimir / PDF"}
          </span>
          <span className="sm:hidden">{printing ? "..." : "PDF"}</span>
        </Button>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {/* Barra de Filtros por Ano */}
        {availableYears.length > 1 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">
              Ano:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                selectedYear === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface text-muted-foreground hover:text-foreground border border-border/80",
              )}
            >
              Todos ({series.length}m)
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                  selectedYear === yr
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-surface text-muted-foreground hover:text-foreground border border-border/80",
                )}
              >
                {yr}
              </button>
            ))}
          </div>
        ) : null}

        {/* Painel de Resumo do Período Filtrado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-border/80 bg-surface/70 p-3 sm:p-4 shadow-2xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Período</span>
            <span className="text-sm sm:text-base font-semibold text-foreground">
              {summary.totalMonths} {summary.totalMonths === 1 ? "mês" : "meses"}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Patrimônio Final</span>
            <MoneyText
              cents={numberToCents(summary.latestValueBRL)}
              tone="default"
              className="text-sm sm:text-base font-bold text-foreground tabular-nums whitespace-nowrap"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Custo Aplicado</span>
            <MoneyText
              cents={numberToCents(summary.latestCostBRL)}
              tone="default"
              className="text-sm sm:text-base font-medium text-muted-foreground tabular-nums whitespace-nowrap"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">TWR Acumulado</span>
            <span
              className={cn(
                "font-mono text-sm sm:text-base font-bold tabular-nums whitespace-nowrap",
                (summary.latestTwrPct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {summary.latestTwrPct !== null
                ? `${summary.latestTwrPct >= 0 ? "+" : ""}${summary.latestTwrPct.toFixed(1)}%`
                : "—"}
            </span>
          </div>
        </div>

        {/* Tabela Analítica de Snapshots */}
        {sortedTablePoints.length === 0 ? (
          <EmptyState
            icon={<Calendar className="size-6" />}
            title="Nenhum mês encontrado"
            description="Não há registros de snapshots para o período selecionado."
            headingLevel="h3"
          />
        ) : (
          <div className="max-h-[55vh] overflow-y-auto overflow-x-auto rounded-xl border border-border/80 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface border-b border-border/80 text-muted-foreground font-medium z-10">
                <tr>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                    Competência
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Patrimônio
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Custo
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Proventos Acum.
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Mês (TWR %)
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Retorno Total
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    TWR Acum.
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                    Cota (R$)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {sortedTablePoints.map((pt) => {
                  const isCurrent = pt.month === currentMonthStr;
                  const effectiveGain =
                    pt.totalReturnPnl !== undefined
                      ? pt.totalReturnPnl
                      : pt.valueBRL - pt.costBRL;
                  const effectivePct =
                    pt.totalReturnPct !== undefined
                      ? pt.totalReturnPct
                      : pt.costBRL > 0
                        ? ((pt.valueBRL - pt.costBRL) / pt.costBRL) * 100
                        : 0;

                  return (
                    <tr
                      key={pt.month}
                      className={cn(
                        "transition-colors",
                        isCurrent
                          ? "bg-portfolio/10 font-semibold"
                          : "hover:bg-surface-hover/70",
                      )}
                    >
                      {/* Competência */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground">
                            {formatMonthYear(pt.month)}
                          </span>
                          {isCurrent ? (
                            <Badge variant="portfolio" size="xs">
                              atual
                            </Badge>
                          ) : null}
                        </div>
                      </td>

                      {/* Patrimônio */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-foreground">
                        <MoneyText
                          cents={numberToCents(pt.valueBRL)}
                          tone="default"
                          className="tabular-nums"
                        />
                      </td>

                      {/* Custo */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-muted-foreground">
                        <MoneyText
                          cents={numberToCents(pt.costBRL)}
                          tone="default"
                          className="tabular-nums"
                        />
                      </td>

                      {/* Proventos Acumulados */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <MoneyText
                          cents={numberToCents(pt.accumulatedDividendsBRL ?? 0)}
                          tone="positive"
                          className="tabular-nums font-semibold"
                        />
                      </td>

                      {/* Rentabilidade no Mês (TWR %) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-semibold">
                        {pt.twrMonthPct !== null && pt.twrMonthPct !== undefined ? (
                          <span
                            className={
                              pt.twrMonthPct >= 0
                                ? "text-positive-strong"
                                : "text-negative-strong"
                            }
                          >
                            {pt.twrMonthPct >= 0 ? "+" : ""}
                            {pt.twrMonthPct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-sans font-normal">—</span>
                        )}
                      </td>

                      {/* Retorno Total % Contábil */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={cn(
                            "tabular-nums font-semibold",
                            effectiveGain >= 0 ? "text-positive-strong" : "text-negative-strong",
                          )}
                        >
                          {effectivePct !== null
                            ? `${effectivePct >= 0 ? "+" : ""}${effectivePct.toFixed(1)}%`
                            : "—"}
                        </span>
                      </td>

                      {/* TWR Acumulado % */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-semibold">
                        {pt.twrAccumulatedPct !== null && pt.twrAccumulatedPct !== undefined ? (
                          <span
                            className={
                              pt.twrAccumulatedPct >= 0
                                ? "text-positive-strong"
                                : "text-negative-strong"
                            }
                          >
                            {pt.twrAccumulatedPct >= 0 ? "+" : ""}
                            {pt.twrAccumulatedPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-sans font-normal">—</span>
                        )}
                      </td>

                      {/* Cota da Carteira */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-muted-foreground">
                        {pt.sharePrice !== null && pt.sharePrice !== undefined ? (
                          <span>R$&nbsp;{pt.sharePrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground font-sans font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
