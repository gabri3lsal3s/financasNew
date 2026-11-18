import { MoneyText } from "@/components/ui/money-text";
import { formatDailyFlowDayLabel } from "@/domain/charts";
import type { DailyFlowItem } from "@/domain/overview";

export interface DailyFlowTooltipProps {
  day: DailyFlowItem;
  scrubLeft?: string;
  hasInvestments: boolean;
}

/**
 * Tooltip flutuante com receitas, despesas, investimentos e saldo líquido do dia focado.
 */
export function DailyFlowTooltip({ day, scrubLeft, hasInvestments }: DailyFlowTooltipProps) {
  const netCents = day.incomeCents - day.expenseCents;

  return (
    <div
      className="pointer-events-none absolute top-0 z-tooltip -translate-x-1/2 rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md p-2.5 text-xs min-w-36 animate-in fade-in zoom-in-95 duration-100 shadow-sm"
      style={{ left: `clamp(76px, ${scrubLeft}, calc(100% - 76px))` }}
      role="tooltip"
    >
      <div className="flex items-center justify-between border-b border-border/80 pb-1 mb-1.5">
        <span className="font-semibold text-foreground">
          {formatDailyFlowDayLabel(day.day, day.dayOfMonth)}
        </span>
        <MoneyText
          cents={netCents}
          tone={netCents >= 0 ? "positive" : "negative"}
          className="text-[11px]"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-positive-strong" /> Entradas
          </span>
          <MoneyText cents={day.incomeCents} tone="positive" sign="explicit" className="privacy-mask text-[11px]" />
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-negative-strong" /> Saídas
          </span>
          <MoneyText cents={day.expenseCents} tone="negative" sign="explicit" className="privacy-mask text-[11px]" />
        </div>
        {hasInvestments ? (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-portfolio" /> Investimentos
            </span>
            <MoneyText cents={day.investmentCents} tone="portfolio" sign="explicit" className="privacy-mask text-[11px]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
