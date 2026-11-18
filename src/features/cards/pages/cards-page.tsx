import { FileUp, Plus } from "lucide-react";
import { Alert, Badge, Button, ErrorState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { CreditCardWallet, ReadOnlyBanner, TransactionRow } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { formatDateBR, monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import {
  CardInvoiceExpensesFeed,
  CardInvoicePaymentsFeed,
  CardsEmptyState,
  CardsPageModals,
  CardsPageSkeleton,
  InvoiceCompetenceToolbar,
  InvoiceKpisSection,
} from "@/features/cards/components";
import { useCardsPageState } from "@/features/cards/hooks/use-cards-page-state";
import type { Expense } from "@/types";

/**
 * Página de Gestão Completa de Cartões de Crédito:
 * - Carteira / Carrossel 3D com modelo interativo
 * - Fatura por competência (previsto, pago, saldo aberto, estornos)
 * - Extrato discriminado de despesas e pagamentos/estornos
 */
export function CardsPage() {
  const state = useCardsPageState();

  const renderInvoiceRow = (expense: Expense) => {
    const category = state.categoryById.get(expense.category_id);
    const title = expense.description || category?.name || "Despesa";
    return (
      <TransactionRow
        key={expense.id}
        title={title}
        date={formatDateBR(expense.date)}
        subtitle={category?.name && expense.description ? category.name : undefined}
        amountCents={numberToCents(expense.value)}
        reportWeight={expense.report_weight}
        kind="expense"
        icon={category?.icon}
        iconColor={category?.color}
        badges={
          expense.installments_total > 1 ? (
            <Badge variant="muted" size="xs" className="font-mono">
              {expense.installment_number}/{expense.installments_total}
            </Badge>
          ) : undefined
        }
        onClick={() => state.setSelectedExpense(expense)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cartões de Crédito"
        description="Gestão integrada de cartões, faturas por competência, limites e conciliação"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={state.handleOpenImport}
              className="gap-1.5"
            >
              <FileUp className="size-3.5" aria-hidden="true" />
              <span>Importar Fatura</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => state.handleOpenForm(null)}
              className="gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Novo Cartão</span>
            </Button>
          </>
        }
      />

      {state.permission.isReadOnlyMode && (
        <ReadOnlyBanner onActivatePro={() => state.requireUpgrade(undefined)} />
      )}

      {!state.queryError && state.actionError ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error">{state.actionError}</Alert>
          <div className="flex flex-wrap items-center gap-2">
            {(state.actionError.includes("desativá-lo") || state.actionError.includes("histórico")) &&
            state.selectedCard &&
            state.selectedCard.is_active ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void state.handleDeactivateCard(state.selectedCard!)}
              >
                Desativar cartão {state.selectedCard.name}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={state.refetchAll}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {state.queryError ? (
        <ErrorState message={getErrorMessage(state.queryError)} onRetry={state.refetchAll} />
      ) : state.loading ? (
        <CardsPageSkeleton />
      ) : state.cards.length === 0 ? (
        <CardsEmptyState onAddFirstCard={() => state.handleOpenForm(null)} />
      ) : (
        <>
          <section
            aria-label="Carteira de Cartões"
            data-tour="cards-content"
            className={cn(
              "flex flex-col items-center justify-center p-3.5 sm:p-6 rounded-2xl bg-surface border border-border/80 shadow-xs transition-colors",
              state.selectedCard && state.isHighlighted(state.selectedCard.id) && "ring-2 ring-primary",
            )}
          >
            <CreditCardWallet
              cards={state.cards}
              selectedCardId={state.selectedCard?.id ?? null}
              primaryCardId={state.primaryCardId}
              onSelectCard={state.selectCard}
              onEditCard={state.handleOpenForm}
              onNewCard={() => state.handleOpenForm(null)}
              usedLimitMap={state.usedLimitMap}
              competenceMonth={state.effectiveMonth}
            />
          </section>

          <div className="flex flex-col gap-4 sm:gap-5">
            <InvoiceCompetenceToolbar
              effectiveMonth={state.effectiveMonth}
              onSelectMonth={state.setMonth}
              selectedCard={state.selectedCard}
              summary={state.summary}
              invStatus={state.invStatus}
              getMonthStatus={state.getMonthStatus}
              previousUnpaidSummaries={state.previousUnpaidSummaries}
              onOpenPayment={state.handleOpenPayment}
              onOpenBatchPayment={state.handleOpenBatchPayment}
            />

            <InvoiceKpisSection
              summary={state.summary}
              cardSubscriptionImpact={state.cardSubscriptionImpact}
              onIgnoreSubscriptionItem={state.ignoreSubscriptionItem}
            />
          </div>

          <CardInvoiceExpensesFeed
            monthLabelStr={monthLabel(state.effectiveMonth)}
            competenceExpenses={state.competenceExpenses}
            installments={state.installments}
            regular={state.regular}
            selectedCard={state.selectedCard}
            onOpenImport={state.handleOpenImport}
            onOpenPrint={() => state.setPrintOpen(true)}
            onExportCsv={state.handleExportInvoice}
            renderInvoiceRow={renderInvoiceRow}
          />

          <CardInvoicePaymentsFeed
            competencePayments={state.competencePayments}
            onDeletePayment={state.handleDeletePaymentClick}
          />
        </>
      )}

      <CardsPageModals
        cards={state.cards}
        selectedCard={state.selectedCard}
        cardId={state.cardId}
        effectiveMonth={state.effectiveMonth}
        summary={state.summary}
        previousUnpaidSummaries={state.previousUnpaidSummaries}
        formOpen={state.formOpen}
        fromUrl={state.fromUrl}
        editingCard={state.editingCard}
        onCloseForm={state.handleFormOpenChange}
        onCardDeleted={state.handleCardDeleted}
        deletingPayment={state.deletingPayment}
        onCloseDeletePayment={() => state.setDeletingPayment(null)}
        onConfirmDeletePayment={state.handleConfirmDeletePayment}
        paymentMode={state.paymentMode}
        onClosePayment={() => state.setPaymentMode(null)}
        importOpen={state.importOpen}
        onImportOpenChange={state.setImportOpen}
        batchPaymentOpen={state.batchPaymentOpen}
        onBatchPaymentOpenChange={state.setBatchPaymentOpen}
        selectedExpense={state.selectedExpense}
        onCloseExpense={() => state.setSelectedExpense(null)}
        printOpen={state.printOpen}
        onPrintOpenChange={state.setPrintOpen}
        printExpenseRows={state.printExpenseRows}
        printPaymentRows={state.printPaymentRows}
        upgradeOpen={state.upgradeOpen}
        onUpgradeOpenChange={state.setUpgradeOpen}
        upgradeContext={state.upgradeContext}
        onProceedToCheckout={(url) => state.navigate(url)}
      />
    </div>
  );
}
