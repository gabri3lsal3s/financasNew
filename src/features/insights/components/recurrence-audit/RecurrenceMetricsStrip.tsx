import { MoneyText } from "@/components/ui/money-text";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";

export interface RecurrenceMetricsStripProps {
  occurrence: RecurrenceOccurrence;
}

export function RecurrenceMetricsStrip({ occurrence }: RecurrenceMetricsStripProps) {
  const isMultiMonth = Boolean(occurrence.intervalMonths && occurrence.intervalMonths > 1);
  const monthlyAmortized =
    occurrence.monthlyAmortizedCents ??
    Math.round(occurrence.averageCents / (occurrence.intervalMonths || 1));

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground line-clamp-2 break-words">
          {isMultiMonth ? "Valor por ciclo" : "Valor médio"}
        </span>
        <div className="flex items-baseline gap-1">
          <MoneyText cents={occurrence.averageCents} tone="default" className="text-base font-semibold" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {isMultiMonth ? `/${occurrence.intervalMonths}m` : "/mês"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground line-clamp-2 break-words">
          {isMultiMonth ? "Amortizado/mês" : "Custo anual"}
        </span>
        <div className="flex items-baseline gap-1">
          <MoneyText
            cents={isMultiMonth ? monthlyAmortized : occurrence.averageCents * 12}
            tone="default"
            className="text-base font-semibold"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {isMultiMonth ? "/mês" : "/ano"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground line-clamp-2 break-words">
          {isMultiMonth ? "Custo anual" : "Dia típico"}
        </span>
        {isMultiMonth ? (
          <div className="flex items-baseline gap-1">
            <MoneyText cents={monthlyAmortized * 12} tone="default" className="text-base font-semibold" />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">/ano</span>
          </div>
        ) : (
          <span className="text-base font-semibold text-foreground tabular-nums">
            {occurrence.typicalDayOfMonth ? `Dia ~${occurrence.typicalDayOfMonth}` : "Variável"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground">Confiança</span>
        <span className="text-base font-semibold text-foreground tabular-nums">
          {Math.round(occurrence.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}
