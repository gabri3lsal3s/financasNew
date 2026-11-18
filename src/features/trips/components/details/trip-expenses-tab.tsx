import { Pencil, Plus, Receipt, Scale, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { TripExpense, TripMember } from "@/types/trips";

export interface TripExpensesTabProps {
  expenses: readonly TripExpense[];
  members: readonly TripMember[];
  isHost: boolean;
  filterMyExpenses: boolean;
  onClearFilter: () => void;
  onOpenRebalance: () => void;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: TripExpense) => void;
  onDeleteExpense: (expense: TripExpense) => void;
}

export function TripExpensesTab({
  expenses,
  members,
  isHost,
  filterMyExpenses,
  onClearFilter,
  onOpenRebalance,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
}: TripExpensesTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="text-xs font-semibold text-foreground">
          {filterMyExpenses ? "Meus Gastos na Viagem" : "Gastos do Grupo"}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {isHost && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenRebalance}
              className="gap-1.5"
              title="Rateia todas as despesas da viagem igualmente entre todos os membros"
            >
              <Scale className="size-3.5" aria-hidden="true" />
              <span>Equilibrar Tudo</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onOpenAddExpense}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Nova Despesa</span>
          </Button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          tone="default"
          icon={<Receipt className="size-6" aria-hidden="true" />}
          title={filterMyExpenses ? "Nenhum gasto seu encontrado" : "Nenhuma despesa lançada"}
          description={
            filterMyExpenses
              ? "Você ainda não possui despesas registradas como pagador nesta viagem."
              : "Adicione o primeiro gasto da viagem para dividir com os amigos ou compartilhe o link público."
          }
          action={
            filterMyExpenses ? (
              <Button
                type="button"
                size="default"
                variant="outline"
                onClick={onClearFilter}
                className="gap-1.5"
              >
                Ver Todos os Gastos
              </Button>
            ) : (
              <Button
                type="button"
                size="default"
                variant="solid"
                onClick={onOpenAddExpense}
                className="gap-1.5"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Adicionar Despesa</span>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {expenses.map((expense) => {
            const payer = members.find((m) => m.id === expense.paid_by_member_id);
            const eligibleMembers = members.filter(
              (m) =>
                !m.joined_date ||
                !expense.expense_date ||
                expense.expense_date >= m.joined_date,
            );
            const isCustom = expense.split_type === "custom";
            const participantCount = isCustom
              ? (expense.splits?.length ?? 0)
              : eligibleMembers.length > 0
                ? eligibleMembers.length
                : members.length;
            const isPartial = isCustom || participantCount < members.length;

            return (
              <Card
                key={expense.id}
                className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-surface shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 break-words">
                    {expense.description}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    {expense.linked_personal_expense_id && (
                      <Badge size="xs" variant="positive">
                        Vinculada ao Cartão
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Pago por{" "}
                    <span className="font-medium text-foreground">
                      {payer?.name ?? "Membro"}
                    </span>{" "}
                    em{" "}
                    <span className="tabular-nums">
                      {formatDateBR(expense.expense_date)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/80">
                  <MoneyText
                    cents={expense.amount_cents}
                    tone="default"
                    className="font-bold text-sm"
                  />

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      sensoryIntent="selection"
                      onClick={() => onEditExpense(expense)}
                      className="size-10 sm:size-8 text-muted-foreground hover:text-foreground"
                      title="Editar despesa"
                      aria-label={`Editar despesa ${expense.description}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      sensoryIntent="selection"
                      onClick={() => onDeleteExpense(expense)}
                      className="size-10 sm:size-8 text-muted-foreground hover:text-critical-strong"
                      title="Excluir despesa"
                      aria-label={`Excluir despesa ${expense.description}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
