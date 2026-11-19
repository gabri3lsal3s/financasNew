import { Calendar, FileText, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL, formatSignedPct } from "@/services/masks";

export interface SnapshotsLedgerTableProps {
  points: readonly PortfolioMonthlySeriesPoint[];
  currentMonthStr?: string;
  onCloseModal: () => void;
  onGenerateReport?: (month: string) => void;
  onCalibrate: (point: PortfolioMonthlySeriesPoint) => void;
  onRestore: (point: PortfolioMonthlySeriesPoint) => void;
  onDelete: (month: string) => void;
}

export function SnapshotsLedgerTable({
  points,
  currentMonthStr,
  onCloseModal,
  onGenerateReport,
  onCalibrate,
  onRestore,
  onDelete,
}: SnapshotsLedgerTableProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="size-6" />}
        title="Nenhum mês encontrado"
        description="Não há registros de snapshots para o período selecionado."
        headingLevel="h3"
      />
    );
  }

  return (
    <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 shadow-xs w-full">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-surface border-b border-border/80 text-muted-foreground font-medium">
          <tr>
            <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Competência</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Patrimônio</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Custo</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Proventos Mês</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Proventos Acum.</th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-foreground bg-surface-hover/70 border-x border-border/80"
            >
              Mês (TWR %)
            </th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Retorno Total</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">TWR Acum.</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Cota (R$)</th>
            <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap print:hidden">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 font-medium">
          {points.map((pt) => {
            const isCurrent = pt.month === currentMonthStr;
            const effectiveGain =
              pt.totalReturnPnl !== undefined ? pt.totalReturnPnl : pt.valueBRL - pt.costBRL;
            const effectivePct =
              pt.totalReturnPct !== undefined
                ? pt.totalReturnPct
                : pt.costBRL > 0
                  ? ((pt.valueBRL - pt.costBRL) / pt.costBRL) * 100
                  : 0;
            const formattedLabel = formatMonthYear(pt.month);

            return (
              <tr
                key={pt.month}
                className={cn(
                  "transition-colors",
                  isCurrent ? "bg-portfolio/10 font-semibold" : "hover:bg-surface-hover/70",
                )}
              >
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">{formattedLabel}</span>
                    {isCurrent ? (
                      <Badge variant="portfolio" size="xs">atual</Badge>
                    ) : pt.status === "provisional" ? (
                      <Badge variant="warning" size="xs" title="Snapshot provisório em aberto">provisório</Badge>
                    ) : pt.snapshotOrigin === "sem_snapshot" || pt.snapshotOrigin === "carry_forward" ? (
                      <Badge
                        variant="muted"
                        size="xs"
                        className="opacity-75"
                        title="Competência sem fechamento cadastrado pelo usuário"
                      >
                        sem snapshot
                      </Badge>
                    ) : pt.isManuallyCalibrated ? (
                      <Badge
                        variant="warning"
                        size="xs"
                        title={
                          pt.autoTotalValue != null
                            ? `Calibrado manualmente. Original: ${formatCentsAsBRL(numberToCents(pt.autoTotalValue))}`
                            : "Calibrado manualmente pelo usuário"
                        }
                      >
                        calibrado
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="xs" title="Fechamento oficial de mercado">fechado</Badge>
                    )}
                  </div>
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-foreground">
                  <MoneyText cents={numberToCents(pt.valueBRL)} tone="default" />
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap text-muted-foreground">
                  <MoneyText cents={numberToCents(pt.costBRL)} tone="default" />
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <MoneyText
                    cents={numberToCents(pt.monthDividendsBRL ?? 0)}
                    tone={(pt.monthDividendsBRL ?? 0) > 0 ? "positive" : "default"}
                    className={(pt.monthDividendsBRL ?? 0) > 0 ? "font-semibold" : "text-muted-foreground font-normal"}
                  />
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <MoneyText cents={numberToCents(pt.accumulatedDividendsBRL ?? 0)} tone="positive" className="font-semibold" />
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold bg-surface-hover/30 border-x border-border/60">
                  {pt.twrMonthPct !== null && pt.twrMonthPct !== undefined ? (
                    <span
                      className={cn(
                        "num inline-flex items-center justify-end px-2 py-0.5 rounded-md text-xs font-bold font-mono",
                        pt.twrMonthPct >= 0
                          ? "bg-positive/10 text-positive-strong"
                          : "bg-negative/10 text-negative-strong",
                      )}
                    >
                      {formatSignedPct(pt.twrMonthPct, 2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-sans font-normal">—</span>
                  )}
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <span className={cn("num font-semibold", effectiveGain >= 0 ? "text-positive-strong" : "text-negative-strong")}>
                    {effectivePct !== null ? formatSignedPct(effectivePct, 1) : "—"}
                  </span>
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-semibold">
                  {pt.twrAccumulatedPct !== null && pt.twrAccumulatedPct !== undefined ? (
                    <span className={cn("num", pt.twrAccumulatedPct >= 0 ? "text-positive-strong" : "text-negative-strong")}>
                      {formatSignedPct(pt.twrAccumulatedPct, 1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-sans font-normal">—</span>
                  )}
                </td>

                <td className="py-2.5 px-3 text-right whitespace-nowrap text-muted-foreground">
                  {pt.sharePrice !== null && pt.sharePrice !== undefined ? (
                    <MoneyText cents={numberToCents(pt.sharePrice)} tone="default" />
                  ) : (
                    <span className="text-muted-foreground font-sans font-normal">—</span>
                  )}
                </td>

                <td className="py-2.5 px-3 text-center whitespace-nowrap print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    {onGenerateReport ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onCloseModal();
                          onGenerateReport(pt.month);
                        }}
                        className="size-8 p-0 shrink-0 text-muted-foreground hover:text-portfolio hover:bg-portfolio/10"
                        aria-label={`Abrir relatório de ${formattedLabel}`}
                        title={`Abrir relatório de ${formattedLabel}`}
                      >
                        <FileText className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                    {!isCurrent ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onCalibrate(pt)}
                          className="size-8 p-0 shrink-0 text-muted-foreground hover:text-portfolio hover:bg-portfolio/10"
                          aria-label={`Calibrar snapshot de ${formattedLabel}`}
                          title={`Calibrar snapshot de ${formattedLabel}`}
                        >
                          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                        </Button>
                        {pt.isManuallyCalibrated && pt.autoTotalValue != null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRestore(pt)}
                            className="size-8 p-0 shrink-0 text-muted-foreground hover:text-portfolio hover:bg-portfolio/10"
                            aria-label={`Restaurar fechamento oficial de ${formattedLabel}`}
                            title={`Restaurar fechamento oficial de ${formattedLabel}`}
                          >
                            <RotateCcw className="size-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(pt.month)}
                          className="size-8 p-0 shrink-0 text-muted-foreground hover:text-negative-strong hover:bg-negative/10"
                          aria-label={`Excluir snapshot de ${formattedLabel}`}
                          title={`Excluir snapshot de ${formattedLabel}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
