import { Calendar, Receipt } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  MoneyText,
} from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { SharedFamilyExpenseItem } from "@/types";

export interface FamilyBudgetExpensesCardProps {
  expenses: SharedFamilyExpenseItem[];
}

/**
 * Listagem mensal das despesas compartilhadas no link público do Orçamento Familiar.
 */
export function FamilyBudgetExpensesCard({ expenses }: FamilyBudgetExpensesCardProps) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
        title="Nenhuma despesa familiar registrada neste mês"
        description="Conforme as compras e contas da casa forem adicionadas pelo titular, elas serão listadas aqui instantaneamente."
      />
    );
  }

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border/80">
        <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Despesas Familiares do Mês</span>
          </span>
          <Badge variant="muted" size="xs">
            {expenses.length === 1 ? "1 lançamento" : `${expenses.length} lançamentos`}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Apenas transações e compras assinaladas como despesa do lar
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <ul className="divide-y divide-border/80" aria-label="Lista de despesas familiares">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">
                  {expense.description}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {expense.category_name && (
                    <>
                      <span className="truncate">{expense.category_name}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>{formatDateBR(expense.date)}</span>
                  </span>
                  {expense.payer_name && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Badge variant="muted" size="xs">
                        {expense.payer_name}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <MoneyText cents={expense.amount_cents} variant="value" tone="default" />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
