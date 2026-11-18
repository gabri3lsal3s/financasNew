import { PieChart } from "lucide-react";
import { CategoryDonut, type DonutSlice } from "@/components/modules";
import { Badge } from "@/components/ui";
import type { DailyFlowItem } from "@/domain/overview";
import { cn } from "@/lib/utils";
import { OverviewDailyFlowSection } from "./overview-daily-flow-section";

export interface OverviewChartsSectionProps {
  dailyFlow: DailyFlowItem[];
  investmentCents: number;
  grossExpenseCents: number;
  donutSlices: DonutSlice[];
  totalActiveCategoriesCount: number;
  onSliceSelect: (slice: DonutSlice) => void;
}

/**
 * Seção analítica da Home com Fluxo Diário e Donut de Distribuição por Categoria.
 */
export function OverviewChartsSection({
  dailyFlow,
  investmentCents,
  grossExpenseCents,
  donutSlices,
  totalActiveCategoriesCount,
  onSliceSelect,
}: OverviewChartsSectionProps) {
  return (
    <section
      aria-label="Análises do período"
      className={cn("grid gap-3 min-w-0", donutSlices.length > 0 ? "lg:grid-cols-2" : "")}
    >
      <OverviewDailyFlowSection days={dailyFlow} hasInvestments={investmentCents > 0} />
      {donutSlices.length > 0 ? (
        <section
          aria-label="Distribuição por categoria"
          className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
                Distribuição por categoria
              </h2>
            </div>
            <Badge variant="muted" size="xs">
              {totalActiveCategoriesCount}{" "}
              {totalActiveCategoriesCount === 1 ? "categoria" : "categorias"}
            </Badge>
          </div>
          <CategoryDonut
            slices={donutSlices}
            totalCents={grossExpenseCents}
            onSliceClick={onSliceSelect}
          />
        </section>
      ) : null}
    </section>
  );
}
