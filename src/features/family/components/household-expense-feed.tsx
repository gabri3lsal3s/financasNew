import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { TransactionRow } from "@/components/modules/transaction-row";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { FamilyConsolidationExpense } from "@/types";

export interface HouseholdExpenseFeedProps {
  expenses: FamilyConsolidationExpense[];
  currentUserId?: string;
  className?: string;
}

type FeedFilter = "all" | "own" | "partner";

const PAGE_SIZE = 50;

/**
 * Extrato Consolidado das Despesas da Casa (/familia).
 * Permite filtrar entre despesas de toda a casa, pagas pelo usuário ou por demais membros,
 * com paginação incremental de 50 itens para preservar fluidez.
 */
export function HouseholdExpenseFeed({
  expenses,
  currentUserId,
  className,
}: HouseholdExpenseFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);

  const ownExpenses = useMemo(() => {
    return expenses.filter((e) => (currentUserId ? e.user_id === currentUserId : e.is_own));
  }, [expenses, currentUserId]);

  const partnerExpenses = useMemo(() => {
    return expenses.filter((e) => (currentUserId ? e.user_id !== currentUserId : !e.is_own));
  }, [expenses, currentUserId]);

  const sortedExpenses = useMemo(() => {
    const list =
      filter === "own" ? ownExpenses : filter === "partner" ? partnerExpenses : expenses;
    return [...list].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [filter, expenses, ownExpenses, partnerExpenses]);

  const visibleExpenses = sortedExpenses.slice(0, visibleLimit);
  const remainingCount = Math.max(0, sortedExpenses.length - visibleExpenses.length);

  const handleFilterChange = (val: string) => {
    setFilter(val as FeedFilter);
    setVisibleLimit(PAGE_SIZE);
  };

  const tabItems = [
    {
      value: "all",
      label: `Todas da Casa (${expenses.length})`,
      shortLabel: `Todas (${expenses.length})`,
    },
    {
      value: "own",
      label: `Pagas por Você (${ownExpenses.length})`,
      shortLabel: `Você (${ownExpenses.length})`,
    },
    {
      value: "partner",
      label: `Demais Membros (${partnerExpenses.length})`,
      shortLabel: `Outros (${partnerExpenses.length})`,
    },
  ];

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Extrato Familiar</span>
        </CardTitle>

        <div className="w-full sm:w-auto">
          <Tabs
            value={filter}
            onValueChange={handleFilterChange}
            items={tabItems}
            variant="pills"
            fullWidth={false}
            ariaLabel="Filtro do extrato familiar"
          />
        </div>
      </CardHeader>

      <CardContent>
        {sortedExpenses.length === 0 ? (
          <EmptyState
            title={
              filter === "own"
                ? "Nenhuma despesa paga por você neste mês"
                : filter === "partner"
                  ? "Nenhuma despesa paga por outros membros neste mês"
                  : "Nenhuma despesa familiar registrada neste mês"
            }
            description="Os gastos atribuídos à família aparecerão consolidados aqui com o pagador identificado."
            tone="default"
            className="py-10"
          />
        ) : (
          <div className="space-y-3">
            <div className="divide-y divide-border/80">
              {visibleExpenses.map((expense) => {
                const isOwn = currentUserId ? expense.user_id === currentUserId : expense.is_own;

                return (
                  <TransactionRow
                    key={expense.id}
                    title={expense.description}
                    subtitle={expense.category_name}
                    date={formatDateBR(expense.date)}
                    amountCents={expense.amount_cents}
                    kind="expense"
                    icon={expense.category_icon}
                    iconColor={expense.category_color}
                    variant="flat"
                    badges={
                      isOwn ? (
                        <Badge variant="positive" size="xs">
                          Você
                        </Badge>
                      ) : (
                        <Badge variant="portfolio" size="xs">
                          {expense.payer_name || "Membro"}
                        </Badge>
                      )
                    }
                  />
                );
              })}
            </div>

            {remainingCount > 0 && (
              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="w-full sm:w-auto"
                >
                  Carregar mais ({remainingCount}{" "}
                  {remainingCount === 1 ? "restante" : "restantes"})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
