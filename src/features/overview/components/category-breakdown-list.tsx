import { ReceiptText } from "lucide-react";
import { MoneyText } from "@/components/ui";
import { formatDateBR, monthLabel } from "@/lib/date";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import type { Category, CreditCard, Expense } from "@/types";

export interface CategoryBreakdownListProps {
  category: Category;
  month: string;
  expenses: Expense[];
  cards: CreditCard[];
}

export function CategoryBreakdownList({
  category,
  month,
  expenses,
  cards,
}: CategoryBreakdownListProps) {
  const sortedExpenses = [...expenses].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-0.5">
        <span className="flex items-center gap-1.5">
          <ReceiptText className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Lançamentos ({sortedExpenses.length})</span>
        </span>
      </div>

      {sortedExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border border-dashed border-border/80 bg-surface-hover/20">
          <p className="text-xs text-muted-foreground">
            Nenhum lançamento registrado nesta categoria em {monthLabel(month)}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface overflow-hidden">
          {sortedExpenses.map((expense) => {
            const paymentLabel = expense.card_id
              ? cardMap.get(expense.card_id) ?? "Cartão"
              : expense.payment_method === "pix"
                ? "Pix"
                : expense.payment_method === "debit"
                  ? "Débito"
                  : "Conta";

            const grossCents = numberToCents(expense.value);
            const weight = expense.report_weight ?? 1;
            const weightedCents = Math.round(grossCents * weight);

            return (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 p-2.5 sm:p-3 text-xs hover:bg-surface-hover/40 transition-colors"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-foreground truncate">
                    {expense.description?.trim() || category.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span>{formatDateBR(expense.date)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{paymentLabel}</span>
                    {expense.installments_total > 1 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-foreground/80 tabular-nums">
                          {expense.installment_number}/{expense.installments_total}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 text-right">
                  <MoneyText
                    cents={weightedCents}
                    tone="default"
                    className={cn(
                      "text-xs sm:text-sm",
                      weight === 0 ? "text-muted-foreground font-normal" : "text-foreground font-semibold",
                    )}
                  />
                  {weight !== 1 ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <span>Bruto:</span>
                      <MoneyText cents={grossCents} tone="default" variant="caption" className="text-muted-foreground" />
                      <span>({Math.round(weight * 100)}%)</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
