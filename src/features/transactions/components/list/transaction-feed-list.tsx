import { ArrowLeftRight, Calendar, ChevronDown, Plus, Sparkles, X } from "lucide-react";
import { Button, EmptyState, MoneyText, Skeleton, SkeletonList } from "@/components/ui";
import { HighlightRow } from "@/components/modules";
import type { DailyFeedGroup, FeedFilter } from "@/domain/expenses";
import type { ExpensePriceEvolution } from "@/domain/insights";
import { formatDateBR } from "@/lib/date";
import type { Category, Expense, Income } from "@/types";
import { ExpenseRow, IncomeRow } from "./transaction-feed-rows";

export interface TransactionFeedListProps {
  loading: boolean;
  isSearching: boolean;
  searchQuery: string;
  filter: FeedFilter;
  feedGroups: DailyFeedGroup[];
  categoryById: Map<string, Category>;
  priceEvolutionByExpenseId: Map<string, ExpensePriceEvolution>;
  isFamilyModeEnabled: boolean;
  highlightId: string | null;
  hasMore: boolean;
  effectiveVisibleCount: number;
  filteredFeedItemsCount: number;
  recurrenceLabel: (recurrenceId: string | null | undefined) => string | undefined;
  onSelectExpense: (expense: Expense) => void;
  onSelectIncome: (income: Income) => void;
  onClearSearch: () => void;
  onNewTransaction: () => void;
  onStartDemo: () => void;
  onLoadMore: () => void;
}

function getEmptyDescription(filter: FeedFilter, isSearching: boolean, searchQuery: string): string {
  if (isSearching) {
    return `Nenhum lançamento corresponde ao termo "${searchQuery.trim()}". Tente buscar por outro termo ou limpe a busca.`;
  }
  if (filter === "incomes") return "Nenhuma receita registrada neste mês.";
  if (filter === "expenses") return "Nenhuma despesa registrada neste mês.";
  if (filter === "recurring") return "Nenhum lançamento recorrente neste mês.";
  if (filter === "installments") return "Nenhum lançamento parcelado neste mês.";
  return "Registre sua primeira transação para acompanhar suas finanças neste mês.";
}

/** Feed agrupado por dia com loading skeleton, estado vazio calmo e paginação progressiva. */
export function TransactionFeedList({
  loading,
  isSearching,
  searchQuery,
  filter,
  feedGroups,
  categoryById,
  priceEvolutionByExpenseId,
  isFamilyModeEnabled,
  highlightId,
  hasMore,
  effectiveVisibleCount,
  filteredFeedItemsCount,
  recurrenceLabel,
  onSelectExpense,
  onSelectIncome,
  onClearSearch,
  onNewTransaction,
  onStartDemo,
  onLoadMore,
}: TransactionFeedListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3.5 sm:gap-4" data-tour="transactions-content">
        <div
          data-tour="transactions-feed-card"
          className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 bg-surface-raised/60 border-b border-border/60">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="p-3.5 sm:p-4">
            <SkeletonList rows={4} />
          </div>
        </div>
      </div>
    );
  }

  if (feedGroups.length === 0) {
    return (
      <div data-tour="transactions-feed-card" className="w-full">
        <EmptyState
          icon={<ArrowLeftRight className="size-6" aria-hidden="true" />}
          title={isSearching ? "Nenhum resultado encontrado" : "Nenhum lançamento encontrado"}
          description={getEmptyDescription(filter, isSearching, searchQuery)}
          action={
            isSearching ? (
              <Button
                size="sm"
                variant="outline"
                sensoryIntent="selection"
                onClick={onClearSearch}
                className="mt-2 gap-1.5"
              >
                <X className="size-3.5" aria-hidden="true" />
                Limpar busca
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button size="sm" onClick={onNewTransaction} className="gap-1.5">
                  <Plus className="size-4" aria-hidden="true" />
                  Novo lançamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  sensoryIntent="selection"
                  onClick={onStartDemo}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Ver exemplo na Simulação
                </Button>
              </div>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4" data-tour="transactions-content">
      {feedGroups.map((group, index) => (
        <section
          key={group.date}
          data-tour={index === 0 ? "transactions-feed-card" : undefined}
          aria-label={`Lançamentos de ${formatDateBR(group.date)}`}
          className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-surface-raised/60 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{formatDateBR(group.date)}</span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              ({group.items.length} {group.items.length === 1 ? "lançamento" : "lançamentos"})
            </span>
          </div>

          <div className="divide-y divide-border/50">
            {group.items.map((item) => (
              <HighlightRow key={item.id} highlightId={highlightId} id={item.id}>
                {item.kind === "income" && item.rawIncome ? (
                  <IncomeRow
                    income={item.rawIncome}
                    category={categoryById.get(item.categoryId)}
                    recurrenceLabel={recurrenceLabel(item.recurrenceId)}
                    isFamilyModeEnabled={isFamilyModeEnabled}
                    onClick={() => onSelectIncome(item.rawIncome!)}
                  />
                ) : item.rawExpense ? (
                  <ExpenseRow
                    expense={item.rawExpense}
                    category={categoryById.get(item.categoryId)}
                    recurrenceLabel={recurrenceLabel(item.recurrenceId)}
                    isFamilyModeEnabled={isFamilyModeEnabled}
                    priceEvolution={priceEvolutionByExpenseId.get(item.rawExpense.id)}
                    onClick={() => onSelectExpense(item.rawExpense!)}
                  />
                ) : null}
              </HighlightRow>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2 bg-muted/35 border-t border-border/60 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">
              Total do dia
            </span>
            <div className="flex items-center gap-2 sm:gap-3 tabular-nums shrink-0">
              <MoneyText
                cents={group.netCents}
                tone={group.netCents > 0 ? "positive" : group.netCents < 0 ? "negative" : "default"}
                sign="auto"
                variant="caption"
                className="font-semibold"
              />
              {group.netCents !== group.weightedNetCents ? (
                <span className="inline-flex items-center gap-1 border-l border-border/80 pl-2 sm:pl-3">
                  <span className="text-[11px] text-muted-foreground">Pond:</span>
                  <MoneyText
                    cents={group.weightedNetCents}
                    tone={
                      group.weightedNetCents > 0
                        ? "positive"
                        : group.weightedNetCents < 0
                          ? "negative"
                          : "default"
                    }
                    sign="auto"
                    variant="caption"
                    className="font-medium text-muted-foreground"
                  />
                </span>
              ) : null}
            </div>
          </div>
        </section>
      ))}

      {hasMore ? (
        <div className="flex flex-col items-center justify-center pt-2 pb-4 gap-2 border-t border-border/50 mt-2">
          <Button
            variant="outline"
            size="sm"
            sensoryIntent="selection"
            onClick={onLoadMore}
            className="gap-1.5"
            aria-label={`Carregar mais lançamentos. ${filteredFeedItemsCount - effectiveVisibleCount} lançamentos restantes`}
          >
            <span>Carregar mais lançamentos ({filteredFeedItemsCount - effectiveVisibleCount} restantes)</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Button>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            Exibindo {effectiveVisibleCount} de {filteredFeedItemsCount} lançamentos
          </span>
        </div>
      ) : null}
    </div>
  );
}
