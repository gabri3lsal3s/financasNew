import { useMemo, useState } from "react";
import { CalendarCheck2, Check, Sparkles, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { buildMonthlyClosingBreakdown } from "@/domain/calculation-memory";
import type { MonthlyClosingSummary } from "@/domain/insights";
import { monthLabel } from "@/lib/date";

export interface MonthlyClosingCardProps {
  summary: MonthlyClosingSummary;
  onDismiss: (closedMonth: string) => void;
  onApplyLimit: (categoryId: string, limitCents: number, categoryName: string) => Promise<void> | void;
}

export function MonthlyClosingCard({
  summary,
  onDismiss,
  onApplyLimit,
}: MonthlyClosingCardProps) {
  const [appliedCategoryIds, setAppliedCategoryIds] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const closingBreakdown = useMemo(() => buildMonthlyClosingBreakdown(summary), [summary]);

  const handleApply = async (categoryId: string, limitCents: number, name: string) => {
    try {
      setApplyingId(categoryId);
      await onApplyLimit(categoryId, limitCents, name);
      setAppliedCategoryIds((prev) => (prev.includes(categoryId) ? prev : [...prev, categoryId]));
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <section
      aria-label="Ritual de fechamento mensal"
      className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0"
    >
      <div className="flex items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarCheck2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              Fechamento de {monthLabel(summary.closedMonth)}
            </h2>
            <Badge variant="positive" size="xs" className="shrink-0">
              Mês encerrado
            </Badge>
            <CalculationMemoryModal breakdown={closingBreakdown} priority="p1" />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          onClick={() => onDismiss(summary.closedMonth)}
          aria-label="Dispensar resumo de fechamento"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer shrink-0"
        >
          <X className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Dispensar</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <div className="flex flex-col gap-0.5 rounded-lg bg-surface-raised/80 p-3 min-w-0">
          <span className="text-[11px] text-muted-foreground">Receitas do mês</span>
          <MoneyText cents={summary.incomeCents} tone="positive" className="text-sm sm:text-base font-semibold" />
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg bg-surface-raised/80 p-3 min-w-0">
          <span className="text-[11px] text-muted-foreground">Despesas do mês</span>
          <MoneyText cents={summary.expenseCents} tone="negative" className="text-sm sm:text-base font-semibold" />
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg bg-surface-raised/80 p-3 min-w-0">
          <span className="text-[11px] text-muted-foreground">Resultado líquido</span>
          <MoneyText
            cents={summary.balanceCents}
            tone={summary.balanceCents >= 0 ? "positive" : "negative"}
            className="text-sm sm:text-base font-semibold"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-positive/25 bg-positive/5 px-3 py-2 text-xs text-foreground">
        <Sparkles className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">{summary.highlightAchievement}</span>
      </div>

      {summary.limitSuggestions.length > 0 ? (
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            Ajustes sugeridos de orçamento para o novo ciclo
          </p>
          <div className="flex flex-col gap-2 min-w-0">
            {summary.limitSuggestions.map((s) => {
              const isApplied = appliedCategoryIds.includes(s.categoryId);
              const isApplying = applyingId === s.categoryId;
              return (
                <div
                  key={s.categoryId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-surface-raised/60 p-3 text-xs min-w-0"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <Badge variant={s.kind === "increase" ? "warning" : "positive"} size="xs">
                        {s.kind === "increase" ? "Aumentar teto" : "Reduzir teto"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {s.reason} De{" "}
                      <MoneyText cents={s.currentLimitCents} tone="default" className="text-[11px] font-medium" />{" "}
                      para{" "}
                      <MoneyText cents={s.suggestedLimitCents} tone="default" className="text-[11px] font-semibold" />
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isApplied ? "outline" : "default"}
                    disabled={isApplied || isApplying}
                    sensoryIntent="success"
                    onClick={() => void handleApply(s.categoryId, s.suggestedLimitCents, s.name)}
                    className="shrink-0 h-8 px-3 text-xs gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    <span>{isApplied ? "Aplicado" : "Aplicar teto"}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
