import { useState } from "react";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { getErrorMessage } from "@/services/errors";
import { useDeleteCardBillRollover, useDeleteCardPayment, useUpdateCard } from "@/state";
import type { CardBillRollover, CardPayment, CreditCard, Expense } from "@/types";

export type CardPaymentDialogMode = "payment" | "refund" | null;

export interface UseCardsActionsOptions {
  isReadOnlyMode: boolean;
  onRefetchAll: () => void;
}

/** Gerencia estados de modais, guardas read-only e mutações de cartões e faturas. */
export function useCardsActions({
  isReadOnlyMode,
  onRefetchAll,
}: UseCardsActionsOptions) {
  const updateCardMutation = useUpdateCard();
  const deleteCardPaymentMutation = useDeleteCardPayment();
  const deleteCardBillRolloverMutation = useDeleteCardBillRollover();
  const { open: formOpen, setOpen: setFormOpen, fromUrl } = useCreateDeepLink("cartao");

  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<CardPayment | null>(null);
  const [deletingRollover, setDeletingRollover] = useState<CardBillRollover | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<CardPaymentDialogMode>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchPaymentOpen, setBatchPaymentOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [reimbursementOpen, setReimbursementOpen] = useState(false);
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

  const handleOpenCharge = () => {
    if (isReadOnlyMode) {
      requireUpgrade("Lançar Encargo no Cartão");
      return;
    }
    setChargeOpen(true);
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

  const handleOpenRollover = () => {
    if (isReadOnlyMode) {
      requireUpgrade("Rolar Fatura para Próximo Mês");
      return;
    }
    setRolloverOpen(true);
  };

  const handleOpenReimbursement = () => {
    if (isReadOnlyMode) {
      requireUpgrade("Registrar Reembolso de Cartão");
      return;
    }
    setReimbursementOpen(true);
  };

  const handleDeletePaymentClick = (payment: CardPayment) => {
    if (isReadOnlyMode) {
      requireUpgrade("Excluir Pagamento de Fatura");
      return;
    }
    setDeletingPayment(payment);
  };

  const handleDeleteRolloverClick = (rollover: CardBillRollover) => {
    if (isReadOnlyMode) {
      requireUpgrade("Desfazer Rolagem de Fatura");
      return;
    }
    setDeletingRollover(rollover);
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

  const handleConfirmDeleteRollover = () => {
    if (!deletingRollover) return;
    if (isReadOnlyMode) {
      requireUpgrade("Desfazer Rolagem de Fatura");
      return;
    }
    setActionError(null);
    const targetId = deletingRollover.id;
    setDeletingRollover(null);
    void Promise.resolve(deleteCardBillRolloverMutation.mutateAsync(targetId)).catch(() => undefined);
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
    deletingRollover,
    setDeletingRollover,
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
    rolloverOpen,
    setRolloverOpen,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    requireUpgrade,
    chargeOpen,
    setChargeOpen,
    handleOpenCharge,
    reimbursementOpen,
    setReimbursementOpen,
    handleOpenReimbursement,
    handleOpenForm,
    handleOpenPayment,
    handleOpenImport,
    handleOpenBatchPayment,
    handleOpenRollover,
    handleDeletePaymentClick,
    handleDeleteRolloverClick,
    handleDeactivateCard,
    handleConfirmDeletePayment,
    handleConfirmDeleteRollover,
    refetchAll,
  };
}
