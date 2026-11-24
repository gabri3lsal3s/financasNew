import { lazy, Suspense, useMemo } from "react";
import { ConfirmDialog } from "@/components/ui";
import {
  CardInvoicePrintView,
  ReportDocumentLayout,
  ReportInsufficientDataModal,
  UpgradeDialog,
  type CardInvoiceExpenseRow,
  type CardInvoicePaymentRow,
} from "@/components/modules";
import type { MixedCardSplitResult } from "@/domain/business";
import type { CompetenceSummary } from "@/domain/cards";
import { evaluateFaturaReadiness } from "@/domain/reports";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { monthLabel } from "@/lib/date";
import { useAuth } from "@/hooks";
import { InternalTransferDialog } from "@/features/business/components/internal-transfer-dialog";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { CardBillRollover, CardPayment, CreditCard, Expense } from "@/types";
import type { CardPaymentDialogMode } from "../hooks/use-cards-page-state";
import { BatchInvoicePaymentDialog } from "./batch-invoice-payment-dialog";
import { BillRolloverDialog } from "./bill-rollover-dialog";
import { CardChargeDialog } from "./card-charge-dialog";
import { CardFormDialog } from "./card-form-dialog";
import { PaymentDialog } from "./payment-dialog";

const StatementImportDialog = lazy(() =>
  import("@/features/cards/components/statement-import-dialog").then((m) => ({
    default: m.StatementImportDialog,
  })),
);

export interface CardsPageModalsProps {
  cards: CreditCard[];
  selectedCard: CreditCard | null;
  cardId: string | null;
  effectiveMonth: string;
  summary: CompetenceSummary | undefined;
  previousUnpaidSummaries: CompetenceSummary[];
  formOpen: boolean;
  fromUrl: boolean;
  editingCard: CreditCard | null;
  onCloseForm: (open: boolean) => void;
  onCardDeleted: (deletedId: string) => void;
  deletingPayment: CardPayment | null;
  onCloseDeletePayment: () => void;
  onConfirmDeletePayment: () => void;
  deletingRollover?: CardBillRollover | null;
  onCloseDeleteRollover?: () => void;
  onConfirmDeleteRollover?: () => void;
  paymentMode: CardPaymentDialogMode;
  onClosePayment: () => void;
  rolloverOpen?: boolean;
  onRolloverOpenChange?: (open: boolean) => void;
  chargeOpen?: boolean;
  onCloseCharge?: (open: boolean) => void;
  mixedCardSplit?: MixedCardSplitResult | null;
  reimbursementOpen?: boolean;
  onCloseReimbursement?: (open: boolean) => void;
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
  batchPaymentOpen: boolean;
  onBatchPaymentOpenChange: (open: boolean) => void;
  selectedExpense: Expense | null;
  onCloseExpense: () => void;
  printOpen: boolean;
  onPrintOpenChange: (open: boolean) => void;
  printExpenseRows: CardInvoiceExpenseRow[];
  printChargeRows?: CardInvoiceExpenseRow[];
  printPaymentRows: CardInvoicePaymentRow[];
  upgradeOpen: boolean;
  onUpgradeOpenChange: (open: boolean) => void;
  upgradeContext: string | undefined;
  onProceedToCheckout: (url: string) => void;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onCompetenceChange?: (newMonth: string) => void;
}

/** Hospeda os modais e fluxos auxiliares da página de Cartões. */
export function CardsPageModals({
  selectedCard,
  cardId,
  effectiveMonth,
  summary,
  previousUnpaidSummaries,
  formOpen,
  fromUrl,
  editingCard,
  onCloseForm,
  onCardDeleted,
  deletingPayment,
  onCloseDeletePayment,
  onConfirmDeletePayment,
  deletingRollover,
  onCloseDeleteRollover,
  onConfirmDeleteRollover,
  paymentMode,
  onClosePayment,
  rolloverOpen,
  onRolloverOpenChange,
  chargeOpen,
  onCloseCharge,
  mixedCardSplit,
  reimbursementOpen,
  onCloseReimbursement,
  importOpen,
  onImportOpenChange,
  batchPaymentOpen,
  onBatchPaymentOpenChange,
  selectedExpense,
  onCloseExpense,
  printOpen,
  onPrintOpenChange,
  printExpenseRows,
  printChargeRows,
  printPaymentRows,
  upgradeOpen,
  onUpgradeOpenChange,
  upgradeContext,
  onProceedToCheckout,
  isReadOnlyMode,
  aiExtractionEnabled,
  onCompetenceChange,
}: CardsPageModalsProps) {
  const { user } = useAuth();
  const accountHolder = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Titular";

  const faturaReadiness = useMemo(
    () =>
      evaluateFaturaReadiness({
        hasCard: Boolean(selectedCard),
        expenseCount: printExpenseRows.length,
        totalBrutoCents: summary?.previstoBrutoCents ?? 0,
        paymentCount: printPaymentRows.length,
        totalPaidCents: summary?.pagoCents ?? 0,
        isWeightedIdentical:
          (summary?.previstoBrutoCents ?? 0) === (summary?.previstoPonderadoCents ?? 0) &&
          printExpenseRows.every((e) => e.valueCents === e.reportValueCents),
        hasInstallments: printExpenseRows.some(
          (e) =>
            e.installments &&
            e.installments !== "—" &&
            e.installments !== "1/1" &&
            !e.installments.toLowerCase().includes("vista"),
        ),
      }),
    [selectedCard, printExpenseRows, printPaymentRows, summary],
  );

  return (
    <>
      <CardFormDialog
        card={editingCard}
        open={formOpen || fromUrl}
        onOpenChange={onCloseForm}
        onDeleted={onCardDeleted}
      />

      {deletingPayment && (
        <ConfirmDialog
          open={deletingPayment !== null}
          onOpenChange={(next) => {
            if (!next) onCloseDeletePayment();
          }}
          title={deletingPayment.amount < 0 ? "Excluir estorno" : "Excluir pagamento de fatura"}
          description={
            deletingPayment.amount < 0
              ? "Tem certeza que deseja excluir este estorno? A receita automática correspondente no extrato também será removida."
              : "Tem certeza que deseja excluir este pagamento de fatura? O saldo da fatura será recalculado automaticamente."
          }
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={onConfirmDeletePayment}
        />
      )}

      {deletingRollover && onCloseDeleteRollover && onConfirmDeleteRollover ? (
        <ConfirmDialog
          open={deletingRollover !== null}
          onOpenChange={(next) => {
            if (!next) onCloseDeleteRollover();
          }}
          title={
            deletingRollover.kind === "refinance"
              ? "Desfazer parcelamento de fatura"
              : "Desfazer rolagem de fatura"
          }
          description={
            deletingRollover.kind === "refinance"
              ? "Todas as parcelas do principal e os juros lançados nas faturas futuras serão removidos, restaurando o saldo original da fatura. Atenção: eventual entrada já paga permanece no extrato bancário e deve ser estornada separadamente se necessário."
              : "O saldo transferido e os encargos vinculados desta rolagem serão removidos, restaurando o saldo da fatura de origem."
          }
          confirmLabel="Desfazer"
          variant="destructive"
          onConfirm={onConfirmDeleteRollover}
        />
      ) : null}

      {selectedCard && cardId && rolloverOpen && onRolloverOpenChange ? (
        <BillRolloverDialog
          cardId={cardId}
          cardName={selectedCard.name}
          competenceMonth={effectiveMonth}
          openBalanceCents={summary?.saldoBrutoCents ?? 0}
          open={rolloverOpen}
          onOpenChange={onRolloverOpenChange}
        />
      ) : null}

      {cardId && paymentMode ? (
        <PaymentDialog
          cardId={cardId}
          competenceMonth={effectiveMonth}
          mode={paymentMode}
          open={paymentMode !== null}
          onOpenChange={(next) => {
            if (!next) onClosePayment();
          }}
          openBalanceCents={summary?.saldoBrutoCents ?? 0}
        />
      ) : null}

      {cardId ? (
        <CardChargeDialog
          cardId={cardId}
          competenceMonth={effectiveMonth}
          open={Boolean(chargeOpen)}
          onOpenChange={(next) => {
            if (onCloseCharge) onCloseCharge(next);
          }}
        />
      ) : null}

      {reimbursementOpen && mixedCardSplit && selectedCard ? (
        <InternalTransferDialog
          open={reimbursementOpen}
          onOpenChange={(next) => {
            onCloseReimbursement?.(next);
          }}
          defaultKind="card_reimbursement"
          defaultAmountCents={mixedCardSplit.pendingReimbursementCents}
          sourceRef={mixedCardSplit.sourceRefKey}
          defaultDescription={`Reembolso fatura ${selectedCard.name} (${effectiveMonth})`}
        />
      ) : null}

      {importOpen && (
        <Suspense fallback={null}>
          <StatementImportDialog
            open={importOpen}
            onOpenChange={onImportOpenChange}
            card={selectedCard}
            competenceMonth={effectiveMonth}
            userId={user?.id ?? null}
            isReadOnlyMode={isReadOnlyMode}
            aiExtractionEnabled={aiExtractionEnabled}
            onCompetenceChange={onCompetenceChange}
          />
        </Suspense>
      )}

      {selectedCard && previousUnpaidSummaries.length > 0 && (
        <BatchInvoicePaymentDialog
          open={batchPaymentOpen}
          onOpenChange={onBatchPaymentOpenChange}
          card={selectedCard}
          unpaidSummaries={previousUnpaidSummaries}
        />
      )}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(next) => {
          if (!next) onCloseExpense();
        }}
      />

      {printOpen && faturaReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={printOpen}
          onOpenChange={onPrintOpenChange}
          reportTitle={`Fatura — ${selectedCard?.name ?? "Cartão de Crédito"}`}
          periodLabel={monthLabel(effectiveMonth)}
          blockingReasons={faturaReadiness.blockingReasons}
        />
      )}

      {printOpen && faturaReadiness.canGenerate && selectedCard && summary ? (
        <ReportDocumentLayout
          open={printOpen}
          onOpenChange={onPrintOpenChange}
          title={`Fatura — ${selectedCard.name}`}
          documentTitle={`AXIR_Fatura_${selectedCard.name.replace(/[^a-zA-Z0-9_\u00C0-\u00FF]+/g, "_")}_${effectiveMonth}.pdf`}
          size="2xl"
        >
          <CardInvoicePrintView
            cardName={selectedCard.name}
            competenceMonth={effectiveMonth}
            competenceLabel={monthLabel(effectiveMonth)}
            totalBrutoCents={summary.previstoBrutoCents}
            totalPonderadoCents={summary.previstoPonderadoCents}
            pagoCents={summary.pagoCents}
            saldoAbertoCents={summary.saldoBrutoCents}
            saldoPonderadoCents={summary.saldoPonderadoCents}
            expenses={printExpenseRows}
            charges={printChargeRows}
            payments={printPaymentRows}
            accountHolder={accountHolder}
          />
        </ReportDocumentLayout>
      ) : null}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={onUpgradeOpenChange}
        context={upgradeContext}
        onProceedToCheckout={(plan) => {
          onUpgradeOpenChange(false);
          onProceedToCheckout(buildCheckoutUrl({ plan }));
        }}
      />
    </>
  );
}
