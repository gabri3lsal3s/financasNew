import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { Tabs } from "@/components/ui/tabs";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { FamilyConsolidationExpense } from "@/types";

export interface HouseholdExpenseFeedProps {
  expenses: FamilyConsolidationExpense[];
  currentUserId?: string;
  className?: string;
}

type FeedFilter = "all" | "own" | "partner";

/**
 * Extrato Consolidado das Despesas da Casa (/familia).
 * Permite filtrar de forma fluida entre despesas de toda a casa, pagas pelo usuário ou pagas pelo parceiro,
 * mantendo escaneabilidade clara de quem pagou cada item com badges sóbrios.
 */
export function HouseholdExpenseFeed({
  expenses,
  currentUserId,
  className,
}: HouseholdExpenseFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const ownExpenses = useMemo(() => {
    return expenses.filter((e) => (currentUserId ? e.user_id === currentUserId : e.is_own));
  }, [expenses, currentUserId]);

  const partnerExpenses = useMemo(() => {
    return expenses.filter((e) => (currentUserId ? e.user_id !== currentUserId : !e.is_own));
  }, [expenses, currentUserId]);

  const displayedExpenses = useMemo(() => {
    const list =
      filter === "own" ? ownExpenses : filter === "partner" ? partnerExpenses : expenses;
    return [...list].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [filter, expenses, ownExpenses, partnerExpenses]);

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
      label: `Pagas pelo Parceiro (${partnerExpenses.length})`,
      shortLabel: `Parceiro (${partnerExpenses.length})`,
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
            onValueChange={(val) => setFilter(val as FeedFilter)}
            items={tabItems}
            variant="pills"
            fullWidth={true}
            ariaLabel="Filtro do extrato familiar"
          />
        </div>
      </CardHeader>

      <CardContent>
        {displayedExpenses.length === 0 ? (
          <EmptyState
            title={
              filter === "own"
                ? "Nenhuma despesa paga por você neste mês"
                : filter === "partner"
                  ? "Nenhuma despesa paga pelo parceiro neste mês"
                  : "Nenhuma despesa familiar registrada neste mês"
            }
            description="Os gastos atribuídos à família aparecerão consolidados aqui com o pagador identificado."
            tone="default"
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-border/60">
            {displayedExpenses.map((expense) => {
              const isOwn = currentUserId ? expense.user_id === currentUserId : expense.is_own;

              return (
                <div
                  key={expense.id}
                  className="py-3 sm:py-3.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-surface-muted/60 border border-border/80 shrink-0">
                      <CategoryIcon
                        icon={expense.category_icon}
                        color={expense.category_color}
                        className="size-4"
                      />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                        {expense.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate">{expense.category_name}</span>
                        <span>•</span>
                        <span className="tabular-nums shrink-0">{formatDateBR(expense.date)}</span>
                        <span>•</span>
                        {isOwn ? (
                          <Badge variant="positive" size="xs">
                            Você
                          </Badge>
                        ) : (
                          <Badge variant="portfolio" size="xs">
                            {expense.payer_name || "Parceiro"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <MoneyText
                      cents={expense.amount_cents}
                      tone="negative"
                      className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
