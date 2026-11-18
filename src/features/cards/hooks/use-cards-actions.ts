import { useState } from "react";
import { serializeCardInvoiceCsv } from "@/domain/export";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { getErrorMessage } from "@/services/errors";
import { downloadCsv } from "@/services/export-actions";
import { useDeleteCardPayment, useUpdateCard } from "@/state";
import type { CardPayment, Category, CreditCard, Expense } from "@/types";
import { buildInvoiceExpenseRows, slugifyCardFilename } from "./cards-page-selectors";

export type CardPaymentDialogMode = "payment" | "refund" | null;

export interface UseCardsActionsOptions {
  isReadOnlyMode: boolean;
  selectedCard: CreditCard | null;
  competenceExpenses: readonly Expense[];
  categoryById: Map<string, Category>;
  effectiveMonth: string;
  onRefetchAll: () => void;
}

/** Gerencia estados de modais, guardas read-only e mutações de cartões e faturas. */
export function useCardsActions({
  isReadOnlyMode,
  selectedCard,
  competenceExpenses,
  categoryById,
  effectiveMonth,
  onRefetchAll,
}: UseCardsActionsOptions) {
  const updateCardMutation = useUpdateCard();
  const deleteCardPaymentMutation = useDeleteCardPayment();
  const { open: formOpen, setOpen: setFormOpen, fromUrl } = useCreateDeepLink("cartao");

  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<CardPayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<CardPaymentDialogMode>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchPaymentOpen, setBatchPaymentOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const requireUpgrade = (context?: string) => {
    setUpgradeContext(context);
    setUpgradeOpen(true);
  };

  const handleOpenForm = (card: CreditCard | null) => {
    if (isReadOnlyMode) {
      requireUpgrade(card ? "Editar Cartão de Crédito" : "Adicionar Cartão de Crédito");
      return;
    }
    setActionError(null);
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleOpenPayment = (mode: CardPaymentDialogMode) => {
    if (isReadOnlyMode) {
      requireUpgrade("Registrar Pagamento / Estorno de Fatura");
      return;
    }
    setPaymentMode(mode);
  };

  const handleOpenImport = () => {
    if (isReadOnlyMode) {
      requireUpgrade("Importar Fatura de Cartão");
      return;
    }
    setImportOpen(true);
  };

  const handleOpenBatchPayment = () => {
    if (isReadOnlyMode) {
      requireUpgrade("Quitar Faturas Anteriores");
      return;
    }
    setBatchPaymentOpen(true);
  };

  const handleDeletePaymentClick = (payment: CardPayment) => {
    if (isReadOnlyMode) {
      requireUpgrade("Excluir Pagamento de Fatura");
      return;
    }
    setDeletingPayment(payment);
  };

  const handleDeactivateCard = async (card: CreditCard) => {
    if (isReadOnlyMode) {
      requireUpgrade("Desativar Cartão de Crédito");
      return;
    }
    setActionError(null);
    try {
      await updateCardMutation.mutateAsync({
        id: card.id,
        input: {
          name: card.name,
          brand: card.brand,
          credit_limit: card.credit_limit,
          closing_day: card.closing_day,
          due_day: card.due_day,
          color: card.color,
          is_active: false,
        },
      });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleConfirmDeletePayment = () => {
    if (!deletingPayment) return;
    if (isReadOnlyMode) {
      requireUpgrade("Excluir Pagamento de Fatura");
      return;
    }
    setActionError(null);
    setDeletingPayment(null);
    void Promise.resolve(deleteCardPaymentMutation.mutateAsync(deletingPayment.id)).catch(() => undefined);
  };

  const handleExportInvoice = () => {
    if (!selectedCard || competenceExpenses.length === 0) return;
    const rows = buildInvoiceExpenseRows(competenceExpenses, categoryById);
    downloadCsv(`fatura_${slugifyCardFilename(selectedCard.name)}_${effectiveMonth}.csv`, serializeCardInvoiceCsv(rows));
  };

  const refetchAll = () => {
    setActionError(null);
    onRefetchAll();
  };

  return {
    formOpen,
    setFormOpen,
    fromUrl,
    editingCard,
    setEditingCard,
    deletingPayment,
    setDeletingPayment,
    selectedExpense,
    setSelectedExpense,
    actionError,
    setActionError,
    paymentMode,
    setPaymentMode,
    printOpen,
    setPrintOpen,
    importOpen,
    setImportOpen,
    batchPaymentOpen,
    setBatchPaymentOpen,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    requireUpgrade,
    handleOpenForm,
    handleOpenPayment,
    handleOpenImport,
    handleOpenBatchPayment,
    handleDeletePaymentClick,
    handleDeactivateCard,
    handleConfirmDeletePayment,
    handleExportInvoice,
    refetchAll,
  };
}
