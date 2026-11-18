import { Download, Plus } from "lucide-react";
import { Button, ErrorState } from "@/components/ui";
import { MonthPicker, ReadOnlyBanner } from "@/components/modules";
import { PageHeader } from "@/components/layout";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { getErrorMessage } from "@/services/errors";
import { setStepIndex, startDemo } from "@/state";
import {
  ActiveSplitsCard,
  TransactionSummaryKpis,
} from "@/features/transactions/components";
import {
  TransactionFeedList,
  TransactionFilterBar,
  TransactionListModals,
  useTransactionList,
} from "@/features/transactions/components/list";

export function TransactionListPage() {
  const tx = useTransactionList();

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Transações"
        description="Extrato consolidado de receitas, despesas e transferências por competência"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={tx.handleExportCsv}
              disabled={tx.filteredFeedItemsCount === 0}
              aria-label="Exportar CSV"
              title={
                tx.filteredFeedItemsCount === 0
                  ? "Nenhum lançamento para exportar"
                  : "Exportar lançamentos filtrados em CSV"
              }
              className="gap-1.5"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={tx.handleNewTransaction}
              className="gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Nova transação</span>
            </Button>
          </>
        }
      />

      {tx.permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            tx.setUpgradeContext(undefined);
            tx.setUpgradeOpen(true);
          }}
        />
      )}

      <MonthPicker value={tx.month} onValueChange={tx.handleMonthChange} />

      <TransactionSummaryKpis
        incomesTotalCents={tx.incomesTotalCents}
        incomesWeightedCents={tx.incomesWeightedCents}
        expensesTotalCents={tx.expensesTotalCents}
        expensesWeightedCents={tx.expensesWeightedCents}
        balanceCents={tx.balanceCents}
        balanceWeightedCents={tx.balanceWeightedCents}
      />

      <ActiveSplitsCard month={tx.month} />

      <TransactionFilterBar
        filter={tx.filter}
        onFilterChange={tx.setFilter}
        searchQuery={tx.searchQuery}
        onSearchChange={tx.setSearchQuery}
      />

      {tx.error ? (
        <ErrorState
          message={getErrorMessage(tx.error)}
          onRetry={tx.handleRetry}
        />
      ) : (
        <TransactionFeedList
          loading={tx.loading}
          isSearching={tx.isSearching}
          searchQuery={tx.searchQuery}
          filter={tx.filter}
          feedGroups={tx.feedGroups}
          categoryById={tx.categoryById}
          priceEvolutionByExpenseId={tx.priceEvolutionByExpenseId}
          isFamilyModeEnabled={tx.isFamilyModeEnabled}
          highlightId={tx.highlightId}
          hasMore={tx.hasMore}
          effectiveVisibleCount={tx.effectiveVisibleCount}
          filteredFeedItemsCount={tx.filteredFeedItemsCount}
          recurrenceLabel={tx.recurrenceLabel}
          onSelectExpense={tx.setSelectedExpense}
          onSelectIncome={tx.setSelectedIncome}
          onClearSearch={() => tx.setSearchQuery("")}
          onNewTransaction={tx.handleNewTransaction}
          onStartDemo={() => {
            startDemo("finances");
            setStepIndex(2);
          }}
          onLoadMore={tx.loadMore}
        />
      )}

      <TransactionListModals
        activeExpense={tx.activeExpense}
        expenseOpen={tx.selectedExpense !== null}
        onExpenseOpenChange={(open) => {
          if (!open) tx.setSelectedExpense(null);
        }}
        activeIncome={tx.activeIncome}
        incomeOpen={tx.selectedIncome !== null}
        onIncomeOpenChange={(open) => {
          if (!open) tx.setSelectedIncome(null);
        }}
        showRachaPreview={tx.showRachaPreview}
        showRachaSimulation={tx.showRachaSimulation}
        onCloseRachaParams={tx.clearRachaParams}
        upgradeOpen={tx.upgradeOpen}
        onUpgradeOpenChange={tx.setUpgradeOpen}
        upgradeContext={tx.upgradeContext}
        onProceedToCheckout={(plan) => {
          tx.setUpgradeOpen(false);
          tx.navigate(buildCheckoutUrl({ plan }));
        }}
      />
    </div>
  );
}
