import { ArrowDownLeft, ArrowUpRight, Coins, Landmark, Plus } from "lucide-react";
import { Button, ErrorState, ResponsiveLabel, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { getErrorMessage } from "@/services/errors";
import {
  DebtFormDialog,
  DebtsUrgencyList,
  LoanFormDialog,
  LoansTabContent,
  SettleDialog,
} from "@/features/debts/components";
import { useDebtsPageState, type DebtsTabKey } from "@/features/debts/hooks/use-debts-page-state";

/** Dívidas / contas a pagar e receber (§3.4) — agrupamento inteligente por urgência + financiamentos. */
export function DebtsPage() {
  const state = useDebtsPageState();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contas & Dívidas"
        description="Contas a pagar, a receber e contratos"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Novo contrato"
              title="Novo contrato"
              className="max-sm:min-h-11 max-sm:min-w-11"
              onClick={state.handleOpenLoanForm}
            >
              <Coins aria-hidden="true" />
              <ResponsiveLabel short="Contrato" full="Novo contrato" iconOnlyBelow380 />
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label="Nova dívida"
              title="Nova dívida"
              className="max-sm:min-h-11 max-sm:min-w-11"
              onClick={() => state.handleOpenDebtForm(null)}
            >
              <Plus aria-hidden="true" />
              <ResponsiveLabel short="Dívida" full="Nova dívida" iconOnlyBelow380 />
            </Button>
          </>
        }
      />

      {state.permission.isReadOnlyMode && (
        <ReadOnlyBanner onActivatePro={() => state.requireUpgrade(undefined)} />
      )}

      {state.error ? (
        <ErrorState message={getErrorMessage(state.error)} onRetry={state.refetchAll} />
      ) : (
        <Tabs
          value={state.tab}
          onValueChange={(value) => state.handleTabChange(value as DebtsTabKey)}
          variant="underline"
          swipeable
          items={[
            {
              value: "payable",
              label: "Pagar",
              icon: <ArrowUpRight className="size-4" aria-hidden="true" />,
              content: (
                <DebtsUrgencyList
                  type="payable"
                  list={state.payableDebts}
                  totalDebtsCount={state.debts.length}
                  debtsSummary={state.debtsSummary}
                  isLoading={state.debtsLoading}
                  today={state.today}
                  thisMonth={state.thisMonth}
                  highlightId={state.highlightId}
                  showPaid={state.showPaid}
                  onToggleShowPaid={() => state.setShowPaid((prev) => !prev)}
                  onCreateNew={() => state.handleOpenDebtForm(null)}
                  onSettle={state.handleSettle}
                  onUnsettle={state.handleUnsettle}
                  onEdit={state.handleOpenDebtForm}
                />
              ),
            },
            {
              value: "receivable",
              label: "Receber",
              icon: <ArrowDownLeft className="size-4" aria-hidden="true" />,
              content: (
                <DebtsUrgencyList
                  type="receivable"
                  list={state.receivableDebts}
                  totalDebtsCount={state.debts.length}
                  debtsSummary={state.debtsSummary}
                  isLoading={state.debtsLoading}
                  today={state.today}
                  thisMonth={state.thisMonth}
                  highlightId={state.highlightId}
                  showPaid={state.showPaid}
                  onToggleShowPaid={() => state.setShowPaid((prev) => !prev)}
                  onCreateNew={() => state.handleOpenDebtForm(null)}
                  onSettle={state.handleSettle}
                  onUnsettle={state.handleUnsettle}
                  onEdit={state.handleOpenDebtForm}
                />
              ),
            },
            {
              value: "loans",
              label: "Contratos",
              icon: <Landmark className="size-4" aria-hidden="true" />,
              content: (
                <LoansTabContent
                  loans={state.loans}
                  debts={state.debts}
                  isLoading={state.loansLoading}
                  highlightId={state.highlightId}
                  onOpenNewLoan={state.handleOpenLoanForm}
                />
              ),
            },
          ]}
        />
      )}

      <DebtFormDialog
        debt={state.editingDebt}
        open={state.formOpen}
        onOpenChange={(next) => {
          state.setFormOpen(next);
          if (!next) state.setEditingDebt(null);
        }}
        onDelete={state.handleDeleteDebt}
      />

      <LoanFormDialog
        open={state.loanFormOpen}
        onOpenChange={state.setLoanFormOpen}
      />

      {state.settling ? (
        <SettleDialog
          debt={state.settling}
          open={state.settling !== null}
          onOpenChange={(next) => !next && state.setSettling(null)}
        />
      ) : null}

      <UpgradeDialog
        open={state.upgradeOpen}
        onOpenChange={state.setUpgradeOpen}
        context={state.upgradeContext}
        onProceedToCheckout={(p) => {
          state.setUpgradeOpen(false);
          state.navigate(buildCheckoutUrl({ plan: p }));
        }}
      />
    </div>
  );
}
