import { useNavigate } from "react-router";
import {
  inferCategoryKeyword,
  resolveBestMatchingCard,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsCurrency } from "@/services/masks";
import { autoLearnExpenseCategory, recordTransactionLearning } from "@/services/merchant-learning";
import {
  addPendingSuggestion,
  clearPendingSuggestions,
  dismissPendingSuggestion,
  storeMerchantCategory,
} from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useActiveCreditCards,
  useCreateExpense,
  useCreateIncome,
  useCreateIncomeInstallments,
  useDeleteExpense,
  useDeleteIncome,
} from "@/state";
import type { Category } from "@/types";
import { persistSuggestionTransaction } from "./persist-suggestion-transaction";

/**
 * Orquestra revisão, roteamento de aporte/provento, salvamento em 1 clique e desfazer das sugestões.
 */
export function usePendingSuggestionsActions(onSuggestionHandled?: (id: string) => void) {
  const navigate = useNavigate();
  const cardsQuery = useActiveCreditCards();
  const createExpenseMutation = useCreateExpense();
  const deleteExpenseMutation = useDeleteExpense();
  const createIncomeMutation = useCreateIncome();
  const createIncomeInstallmentsMutation = useCreateIncomeInstallments();
  const deleteIncomeMutation = useDeleteIncome();

  const handleReview = (sug: ParsedBankTransaction, categoryId?: string) => {
    onSuggestionHandled?.(sug.id);
    const inferredSlug = categoryId || sug.categorySlug || inferCategoryKeyword(sug.description);
    const params = new URLSearchParams({
      novo: sug.type,
      valor: String(sug.amountCents),
      descricao: sug.description,
      data: sug.date,
      forma: sug.paymentMethod || "pix",
      sug_id: sug.id,
    });
    if (inferredSlug) params.set("categoria", inferredSlug);
    if (sug.installments && sug.installments > 1) params.set("parcelas", String(sug.installments));

    if (sug.paymentMethod === "credit_card") {
      const matchingCard = resolveBestMatchingCard(cardsQuery.data, {
        cardLastDigits: sug.cardLastDigits,
        bankName: sug.bankName,
        issuerBank: sug.issuerBank,
        cardBrand: sug.cardBrand,
      });
      if (matchingCard) params.set("cartao", matchingCard.id);
      else {
        const cardToken = sug.cardLastDigits || sug.issuerBank || sug.bankName;
        if (cardToken) params.set("cartao", cardToken);
      }
    }
    navigate(`/?${params.toString()}`);
  };

  const handleInvestmentRouting = (sug: ParsedBankTransaction) => {
    onSuggestionHandled?.(sug.id);
    dismissPendingSuggestion(sug.id);

    const isDividend = sug.investmentSubtype === "dividend";
    const params = new URLSearchParams();
    if (isDividend) {
      params.set("tab", "proventos");
      params.set("subtab", "calendario");
      params.set("novo", "provento");
    } else {
      params.set("tab", "aporte");
      params.set("novo", "investimento");
    }

    params.set("valor", String(sug.amountCents));
    if (sug.assetTicker) params.set("ticker", sug.assetTicker);
    if (sug.description) params.set("descricao", sug.description);
    params.set("data", sug.date);
    params.set("sug_id", sug.id);
    navigate(`/investimentos?${params.toString()}`);
  };

  const handleUndo = async (createdId: string, type: "expense" | "income", suggestion: ParsedBankTransaction) => {
    try {
      triggerSensory("toggle");
      if (type === "expense") {
        await deleteExpenseMutation.mutateAsync({ expenseId: createdId, mode: "single" });
      } else {
        await deleteIncomeMutation.mutateAsync(createdId);
      }
      addPendingSuggestion(suggestion);
      pushToast({
        title: "Lançamento desfeito",
        description: "A notificação retornou à fila de sugestões.",
        variant: "default",
      });
    } catch (err) {
      pushToast({
        title: "Não foi possível desfazer",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleQuickSave = async (sug: ParsedBankTransaction, category?: Category) => {
    onSuggestionHandled?.(sug.id);
    dismissPendingSuggestion(sug.id);
    const categoryId = category?.id ?? "";
    const categoryName = category?.name ?? (sug.type === "income" ? "Renda" : "Geral");

    try {
      const { createdId, resolvedCardId } = await persistSuggestionTransaction(sug, categoryId, {
        cards: cardsQuery.data,
        createExpense: (input) => createExpenseMutation.mutateAsync(input),
        createIncome: (input) => createIncomeMutation.mutateAsync(input),
        createIncomeInstallments: (input) => createIncomeInstallmentsMutation.mutateAsync(input),
      });

      if ((sug.merchant || sug.description) && categoryId) {
        const merchantName = sug.merchant || sug.description || "";
        storeMerchantCategory(merchantName, categoryId);
        recordTransactionLearning({
          merchant: merchantName,
          categoryId,
          paymentMethod: sug.paymentMethod || (sug.type === "expense" ? "other" : "pix"),
          cardId: sug.type === "expense" && sug.paymentMethod === "credit_card" ? resolvedCardId : undefined,
          cardLastDigits: sug.cardLastDigits,
        });
      }
      if (sug.type === "expense" && categoryId) {
        autoLearnExpenseCategory(sug.merchant || sug.description || "", categoryId, sug.taxId, sug.rawText || sug.description);
      }

      triggerSensory("success");
      const typeLabel = sug.type === "income" ? "Renda" : "Despesa";
      pushToast({
        title: `${typeLabel} de ${formatCentsAsCurrency(sug.amountCents)} salva em ${categoryName}`,
        variant: "success",
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => void handleUndo(createdId, sug.type, sug),
        },
      });
    } catch (err) {
      addPendingSuggestion(sug);
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível salvar",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleDismiss = (id: string) => {
    onSuggestionHandled?.(id);
    dismissPendingSuggestion(id);
  };

  return {
    handleReview,
    handleInvestmentRouting,
    handleQuickSave,
    handleDismiss,
    handleDismissAll: () => clearPendingSuggestions(),
  };
}
