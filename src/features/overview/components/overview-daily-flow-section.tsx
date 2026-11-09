import { Activity } from "lucide-react";
import { DailyFlowChart } from "@/components/modules";
import type { DailyFlowItem } from "@/domain/overview";

export interface OverviewDailyFlowSectionProps {
  days: readonly DailyFlowItem[];
  hasInvestments: boolean;
}

export function OverviewDailyFlowSection({ days, hasInvestments }: OverviewDailyFlowSectionProps) {
  return (
    <section
      aria-label="Fluxo diário"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
            Fluxo diário
          </h2>
        </div>
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 text-[11px] shrink-0 flex-wrap">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-positive-strong shrink-0" /> Receitas
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-negative-strong shrink-0" /> Despesas
          </span>
          {hasInvestments && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-portfolio shrink-0" /> Investimentos
            </span>
          )}
        </div>
      </div>

      <DailyFlowChart days={days} />
    </section>
  );
}
