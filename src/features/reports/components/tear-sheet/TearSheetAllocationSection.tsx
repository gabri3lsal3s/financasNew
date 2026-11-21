import { PieChart } from "lucide-react";
import { ReportStackedBar } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { TearSheetAllocationRow, TearSheetStackedSegment } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";

export interface TearSheetAllocationSectionProps {
  alignmentScore: number;
  stackedSegments: readonly TearSheetStackedSegment[];
  allocationRows: readonly TearSheetAllocationRow[];
}

export function TearSheetAllocationSection({
  alignmentScore,
  stackedSegments,
  allocationRows,
}: TearSheetAllocationSectionProps) {
  return (
    <section aria-label="Matriz de Rebalanceamento" className="break-inside-avoid flex flex-col gap-3 print:gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5 print:pb-1">
        <div className="flex items-center gap-1.5">
          <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            Diagnóstico de Alocação por Classe (Target vs. Actual)
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono num">
          Equilíbrio Geral: <strong className="text-foreground">{alignmentScore}%</strong>
        </span>
      </div>

      <ReportStackedBar title="Distribuição Atual da Carteira" segments={stackedSegments} height={8} />

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 shadow-xs print:overflow-visible">
        <table className="w-full min-w-[560px] sm:min-w-0 text-left text-xs border-collapse table-fixed">
          <colgroup>
            <col className="w-[26%] min-w-[120px]" />
            <col className="w-[17%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[17%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
              <th className="py-1.5 px-3 print:py-1 print:px-2">Classe</th>
              <th className="py-1.5 px-2.5 text-right print:py-1 print:px-2">Atual (R$)</th>
              <th className="py-1.5 px-2 text-right print:py-1 print:px-1.5">Atual (%)</th>
              <th className="py-1.5 px-2 text-right print:py-1 print:px-1.5">Meta (%)</th>
              <th className="py-1.5 px-2.5 text-right print:py-1 print:px-2">Gap (R$)</th>
              <th className="py-1.5 px-3 text-center print:py-1 print:px-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {allocationRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma classe de ativo sob custódia para diagnóstico.
                </td>
              </tr>
            ) : (
              allocationRows.map((row) => (
                <tr key={row.assetClass} className="even:bg-muted/20 print:even:bg-muted/20">
                  <td className="py-1.5 px-3 print:py-0.5 print:px-2 font-semibold text-foreground whitespace-nowrap">
                    {row.assetClass}
                  </td>
                  <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right num font-mono font-bold text-foreground whitespace-nowrap">
                    <MoneyText cents={numberToCents(row.currentBRL)} tone="default" hideCurrency />
                  </td>
                  <td className="py-1.5 px-2 print:py-0.5 print:px-1.5 text-right num font-mono text-muted-foreground whitespace-nowrap">
                    {formatPercent(row.currentPct)}%
                  </td>
                  <td className="py-1.5 px-2 print:py-0.5 print:px-1.5 text-right num font-mono text-muted-foreground whitespace-nowrap">
                    {formatPercent(row.targetPct)}%
                  </td>
                  <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right num font-mono whitespace-nowrap">
                    <MoneyText
                      cents={numberToCents(row.deviationBRL)}
                      sign="explicit"
                      hideCurrency
                      tone={row.isDeficit || row.isSurplus ? "default" : "positive"}
                      className={cn(
                        "font-bold",
                        row.isDeficit
                          ? "text-primary-strong"
                          : row.isSurplus
                            ? "text-muted-foreground"
                            : "",
                      )}
                    />
                  </td>
                  <td className="py-1.5 px-3 print:py-0.5 print:px-2 text-center whitespace-nowrap">
                    <Badge
                      variant={row.isDeficit ? "default" : row.isSurplus ? "muted" : "positive"}
                      size="xs"
                      className="font-bold font-sans whitespace-nowrap"
                    >
                      {row.isDeficit ? "Abaixo da Meta" : row.isSurplus ? "Acima da Meta" : "Equilibrado"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
