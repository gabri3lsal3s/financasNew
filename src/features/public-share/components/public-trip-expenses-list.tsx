import { Receipt } from "lucide-react";
import { Badge, Card, EmptyState, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { PublicTripExpense, PublicTripMember } from "@/types/trips";

export interface PublicTripExpensesListProps {
  expenses: PublicTripExpense[];
  members: PublicTripMember[];
}

/**
 * Extrato cronológico das despesas compartilhadas na viagem pública.
 */
export function PublicTripExpensesList({ expenses, members }: PublicTripExpensesListProps) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
        title="Nenhum gasto registrado"
        description="Clique em 'Adicionar Despesa' para lançar o primeiro gasto do grupo."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {expenses.map((expense) => {
        const payer = members.find((m) => m.id === expense.paid_by_member_id);
        const isCustom = expense.split_type === "custom";
        const isPartial = isCustom || (expense.splits && expense.splits.length < members.length);
        const participantCount = expense.splits?.length ?? members.length;

        return (
          <Card
            key={expense.id}
            className="border-border/80 bg-surface shadow-xs rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-foreground truncate">
                  {expense.description}
                </span>
                <Badge size="xs" variant="muted">
                  {expense.category_name}
                </Badge>
                {isPartial ? (
                  <Badge size="xs" variant="warning">
                    {participantCount} de {members.length} amigos
                  </Badge>
                ) : (
                  <Badge size="xs" variant="muted">
                    Todos ({members.length})
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pago por <span className="font-medium text-foreground">{payer?.name ?? "Membro"}</span> em{" "}
                {formatDateBR(expense.expense_date)}
              </p>
            </div>

            <div className="text-right shrink-0">
              <MoneyText
                cents={expense.amount_cents}
                variant="value"
                tone="default"
                className="text-xs font-bold"
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
