import { Calendar, CreditCard, Pencil } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import type { ExpenseLike } from "@/domain/insights/recurrences";
import { formatDateBR } from "@/lib/date";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { PaymentMethod } from "@/types";

export interface RecurrenceHistoryListProps {
  expenses: readonly ExpenseLike[];
  monthsCount: number;
  hasDuplicates: boolean;
  latestMonth?: string;
  onEdit: (item: ExpenseLike) => void;
}

export function RecurrenceHistoryList({
  expenses,
  monthsCount,
  hasDuplicates,
  latestMonth,
  onEdit,
}: RecurrenceHistoryListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <h4 className="text-xs font-semibold text-foreground">
          Histórico de lançamentos ({expenses.length})
        </h4>
        <span className="text-[11px] text-muted-foreground">
          Últimos {monthsCount} meses analisados
        </span>
      </div>

      {expenses.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nenhum lançamento registrado para esta ocorrência.
        </p>
      ) : (
        <ul
          className="flex flex-col gap-2"
          role="list"
          aria-label="Histórico de transações da recorrência"
        >
          {expenses.map((expense) => {
            const isDuplicateInMonth = hasDuplicates && expense.month === latestMonth;
            const paymentMethodLabel = expense.paymentMethod
              ? (PAYMENT_METHOD_LABELS[expense.paymentMethod as PaymentMethod] ?? expense.paymentMethod)
              : null;

            return (
              <li
                key={expense.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                  isDuplicateInMonth ? "border-warning/50 bg-warning/5" : "border-border/80 bg-surface"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground">
                    {expense.categoryIcon ? (
                      <CategoryIcon icon={expense.categoryIcon} className="size-4" />
                    ) : (
                      <Calendar className="size-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {formatDateBR(expense.date ?? expense.month)}
                      </span>
                      {isDuplicateInMonth ? (
                        <Badge variant="warning" size="xs">
                          Cobrança duplicada
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {expense.categoryName ? (
                        <span className="truncate">{expense.categoryName}</span>
                      ) : null}

                      {expense.cardName ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CreditCard className="size-3" aria-hidden="true" />
                          {expense.cardName}
                        </span>
                      ) : paymentMethodLabel ? (
                        <span>{paymentMethodLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <MoneyText
                    cents={expense.valueCents}
                    tone="default"
                    className="text-sm font-semibold text-foreground whitespace-nowrap"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    sensoryIntent="selection"
                    onClick={() => onEdit(expense)}
                    aria-label={`Editar lançamento de ${formatDateBR(expense.date ?? expense.month)}`}
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
