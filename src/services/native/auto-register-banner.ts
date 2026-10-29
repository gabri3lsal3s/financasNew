import { useSyncExternalStore } from "react";
import {
  matchCategoryBySlug,
  resolveBestMatchingCard,
  resolveMerchantIdentity,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { addPendingSuggestion, dismissPendingSuggestion, registerReceiptDeduplication } from "./suggestions-store";
import { listCategories } from "@/data/repositories/categories";
import { listCreditCards } from "@/data/repositories/credit-cards";
import {
  createExpenseWithDebt,
  createIncomeInstallments,
  deleteExpenseInstallments,
  deleteIncomeInstallments,
} from "@/data/rpc";
import { createIncome, deleteIncome } from "@/data/repositories/incomes";
import { buildExpenseInstallments, buildIncomeInstallments } from "@/features/transactions/wizard/wizard-state";
import { storeMerchantCategory } from "./merchant-storage";
import { findMatchingCategory } from "./interactive-notifications";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatCentsAsCurrency } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { toISODate } from "@/domain/money";
import {
  getCardDigitsMapping,
  getMerchantLearningMemory,
  recordTransactionLearning,
} from "@/services/merchant-learning";
import type { PaymentMethod, ReceiveType } from "@/types";

export interface AutoRegisteredTransaction {
  id: string;
  type: "expense" | "income";
  amountCents: number;
  description: string;
  merchant?: string;
  date: string;
  categoryId: string;
  categoryName?: string;
  paymentMethod?: PaymentMethod | string;
  cardId?: string | null;
  installments?: number;
  bannerTitle?: string;
  parsed: ParsedBankTransaction;
  registeredAt: number;
}

/**
 * Constrói mensagem amigável e discriminada do tipo de operação financeira.
 */
export function buildAutoRegisteredMessage(params: {
  type: "expense" | "income";
  amountCents: number;
  targetName: string;
  paymentMethod?: PaymentMethod | string;
  installments?: number;
  receiptKind?: string;
}): string {
  const formatted = formatCentsAsCurrency(params.amountCents);
  const count = params.installments && params.installments > 1 ? params.installments : 1;
  const installmentsSuffix = count > 1 ? ` (${count}x)` : "";

  if (params.type === "income") {
    if (count > 1) {
      return `Receita de ${formatted} (${count}x) de ${params.targetName} cadastrada!`;
    }
    if (params.paymentMethod === "pix" || params.receiptKind === "pix") {
      return `Pix de ${formatted} recebido de ${params.targetName} cadastrado!`;
    }
    if (params.paymentMethod === "transfer" || params.receiptKind === "wire_transfer") {
      return `Transferência de ${formatted} recebida de ${params.targetName} cadastrada!`;
    }
    return `Receita de ${formatted} de ${params.targetName} cadastrada!`;
  }

  // Despesa
  if (params.paymentMethod === "credit_card" || params.receiptKind === "card_slip") {
    return `Cartão de Crédito de ${formatted}${installmentsSuffix} para ${params.targetName} cadastrado!`;
  }
  if (params.paymentMethod === "debit") {
    return `Cartão de Débito de ${formatted} para ${params.targetName} cadastrado!`;
  }
  if (params.receiptKind === "bank_slip_payment") {
    return `Boleto de ${formatted} para ${params.targetName} cadastrado!`;
  }
  if (params.paymentMethod === "transfer" || params.receiptKind === "wire_transfer") {
    return `Transferência de ${formatted} para ${params.targetName} cadastrada!`;
  }
  if (params.paymentMethod === "cash") {
    return `Dinheiro de ${formatted} para ${params.targetName} cadastrado!`;
  }

  return `Pix de ${formatted} para ${params.targetName} cadastrado!`;
}

let activeAutoRegistered: AutoRegisteredTransaction | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setAutoRegisteredBanner(item: AutoRegisteredTransaction | null): void {
  activeAutoRegistered = item;
  notify();
}

export function getAutoRegisteredBanner(): AutoRegisteredTransaction | null {
  return activeAutoRegistered;
}

export function dismissAutoRegisteredBanner(): void {
  if (activeAutoRegistered !== null) {
    activeAutoRegistered = null;
    notify();
  }
}

export function subscribeAutoRegisteredBanner(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoRegisteredBanner(): AutoRegisteredTransaction | null {
  return useSyncExternalStore(
    subscribeAutoRegisteredBanner,
    getAutoRegisteredBanner,
    getAutoRegisteredBanner,
  );
}

/**
 * Reverte o auto-cadastro de comprovante (ação Desfazer):
 * 1. Remove o registro persistido via RPC/repositório.
 * 2. Restaura o comprovante na fila de sugestões para não perder os dados.
 * 3. Oculta o banner e emite feedback sensorial e toast de confirmação.
 */
export async function revertAutoRegisteredTransaction(
  item: AutoRegisteredTransaction,
): Promise<boolean> {
  try {
    if (item.type === "expense") {
      await deleteExpenseInstallments(item.id, "single");
    } else {
      await deleteIncome(item.id).catch(async () => {
        await deleteIncomeInstallments(item.id, "single");
      });
    }

    if (item.parsed) {
      addPendingSuggestion(item.parsed);
    }

    dismissAutoRegisteredBanner();
    triggerSensory("action");

    pushToast({
      title: "Lançamento desfeito com sucesso",
      description: "O comprovante foi devolvido para a fila de sugestões pendentes.",
      variant: "default",
    });

    return true;
  } catch (err) {
    triggerSensory("warning");
    pushToast({
      title: "Erro ao desfazer lançamento",
      description: getErrorMessage(err),
      variant: "destructive",
    });
    return false;
  }
}

/**
 * Executa o auto-cadastro imediato do comprovante bancário via RPC transacional.
 */
export async function autoRegisterReceipt(
  parsed: ParsedBankTransaction,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // 1. Registra a assinatura do comprovante na janela de 10 min de deduplicação cruzada
    registerReceiptDeduplication(parsed);
    dismissPendingSuggestion(parsed.id);

    const isIncome = parsed.nature === "income" || parsed.type === "income";
    const txType: "expense" | "income" = isIncome ? "income" : "expense";

    // 2. Resolve identidade do estabelecimento com memória do usuário
    const userMemory = getMerchantLearningMemory();
    const targetSource = isIncome
      ? (parsed.payerName || parsed.merchant || parsed.description)
      : (parsed.merchant || parsed.description);

    const identity = resolveMerchantIdentity({
      merchantOrDescription: targetSource,
      rawText: parsed.rawText,
      taxId: parsed.taxId,
      userMemory,
    });

    const targetName = isIncome
      ? (parsed.payerName || identity.friendlyName || parsed.merchant || "Favorecido")
      : (identity.friendlyName ||
         parsed.merchant ||
         parsed.recipientName ||
         parsed.payerName ||
         "Favorecido");

    // 3. Busca categorias e resolve categoria mais adequada
    const categories = await listCategories(txType).catch(() => []);
    let targetCategory = identity.categorySlug
      ? matchCategoryBySlug(categories, identity.categorySlug)
      : undefined;

    if (!targetCategory) {
      targetCategory = findMatchingCategory(categories, targetName);
    }
    if (!targetCategory && categories.length > 0) {
      targetCategory =
        categories.find(
          (c) =>
            c.name.toLowerCase().includes("outros") ||
            c.name.toLowerCase().includes("diversos") ||
            c.name.toLowerCase().includes("geral"),
        ) || categories[0];
    }

    const categoryId = targetCategory?.id ?? "";
    const value = parsed.amountCents / 100;
    const date = parsed.date || toISODate(new Date());

    // 4. Resolve cartão de crédito cadastrado ativo quando pertinente
    const isCardRelevant =
      !isIncome &&
      (Boolean(parsed.cardId) ||
        Boolean(parsed.cardLastDigits) ||
        parsed.paymentMethod === "credit_card" ||
        parsed.receiptKind === "card_slip" ||
        Boolean(parsed.installments && parsed.installments > 1));

    const allCards = isCardRelevant ? await listCreditCards().catch(() => []) : [];
    const cardDigitsMapping = getCardDigitsMapping();

    let resolvedCard = parsed.cardId
      ? allCards.find((c) => c.id === parsed.cardId && c.is_active !== false)
      : undefined;

    if (!resolvedCard && allCards.length > 0) {
      resolvedCard = resolveBestMatchingCard(allCards, {
        cardId: parsed.cardId || identity.preferredCardId,
        cardLastDigits: parsed.cardLastDigits,
        bankName: parsed.bankName || parsed.issuerBank,
        issuerBank: parsed.issuerBank,
        cardBrand: parsed.cardBrand,
        cardDigitsMapping,
        preferredCardId: identity.preferredCardId,
      });
    }

    // 5. Determina forma de pagamento real e cartão vinculado
    const isCardSlip =
      parsed.receiptKind === "card_slip" ||
      Boolean(parsed.installments && parsed.installments > 1 && !isIncome);

    let paymentMethod: PaymentMethod =
      (identity.preferredPaymentMethod as PaymentMethod) ||
      (parsed.paymentMethod as PaymentMethod) ||
      (resolvedCard || isCardSlip ? "credit_card" : "pix");

    if (resolvedCard && (!parsed.paymentMethod || parsed.paymentMethod === "credit_card")) {
      paymentMethod = "credit_card";
    }

    const cardId = paymentMethod === "credit_card" ? (resolvedCard?.id ?? null) : null;

    let description = parsed.description;
    if (!description) {
      if (isIncome) {
        description = `Pix recebido de ${targetName}`;
      } else if (paymentMethod === "credit_card") {
        description = targetName;
      } else {
        description = `Pix para ${targetName}`;
      }
    } else if (identity.friendlyName) {
      description = identity.friendlyName;
    }

    let createdId = "";

    if (!isIncome) {
      const count = parsed.installments && parsed.installments > 1 ? parsed.installments : 1;
      const installments = buildExpenseInstallments({
        totalCents: parsed.amountCents,
        count,
        startDate: date,
        closingDay: paymentMethod === "credit_card" ? (resolvedCard?.closing_day ?? null) : null,
      });

      createdId = await createExpenseWithDebt({
        value,
        date,
        categoryId,
        paymentMethod,
        cardId,
        description,
        reportWeight: 1,
        installments,
      });
    } else {
      let receiveType: ReceiveType = "pix";
      if (paymentMethod === "transfer" || parsed.receiptKind === "wire_transfer") {
        receiveType = "transfer";
      } else if (paymentMethod === "cash") {
        receiveType = "cash";
      } else if (paymentMethod === "other") {
        receiveType = "other";
      }

      if (parsed.installments && parsed.installments > 1) {
        const installments = buildIncomeInstallments({
          totalCents: parsed.amountCents,
          count: parsed.installments,
          startDate: date,
        });

        createdId = await createIncomeInstallments({
          value,
          date,
          categoryId,
          receiveType,
          description,
          reportWeight: 1,
          installments,
        });
      } else {
        const inc = await createIncome({
          value,
          date,
          category_id: categoryId,
          receive_type: receiveType,
          description,
          report_weight: 1,
          source_ref: null,
        });
        createdId = inc.id;
      }
    }

    // Memoriza estabelecimento e vínculos de cartão e dígitos
    if (parsed.merchant && categoryId) {
      storeMerchantCategory(parsed.merchant, categoryId);
    }
    recordTransactionLearning({
      merchant: targetName,
      categoryId,
      paymentMethod,
      cardId: cardId ?? undefined,
      cardLastDigits: parsed.cardLastDigits,
      taxId: parsed.taxId || identity.taxId,
    });

    const count = parsed.installments && parsed.installments > 1 ? parsed.installments : 1;
    const toastTitle = buildAutoRegisteredMessage({
      type: txType,
      amountCents: parsed.amountCents,
      targetName,
      paymentMethod,
      installments: count,
      receiptKind: parsed.receiptKind,
    });

    const autoRegItem: AutoRegisteredTransaction = {
      id: createdId,
      type: txType,
      amountCents: parsed.amountCents,
      description,
      merchant: parsed.merchant || targetName,
      date,
      categoryId,
      categoryName: targetCategory?.name,
      paymentMethod,
      cardId,
      installments: count,
      bannerTitle: toastTitle,
      parsed,
      registeredAt: Date.now(),
    };

    // Atualiza o banner persistente na Home
    setAutoRegisteredBanner(autoRegItem);

    // Feedback sensorial de sucesso
    triggerSensory("success");

    // Toast com ação de Desfazer (5s)
    pushToast({
      title: toastTitle,
      variant: "success",
      duration: 5000,
      action: {
        label: "Desfazer (5s)",
        onClick: () => {
          void revertAutoRegisteredTransaction(autoRegItem);
        },
      },
    });

    return { success: true, id: createdId };
  } catch (err) {
    // Falha: retém na fila de sugestões para não perder o comprovante
    addPendingSuggestion(parsed);
    triggerSensory("warning");
    const errMsg = getErrorMessage(err);
    pushToast({
      title: "Erro ao cadastrar comprovante",
      description: errMsg,
      variant: "destructive",
    });
    return { success: false, error: errMsg };
  }
}
