import { useSyncExternalStore } from "react";
import type { ParsedBankTransaction } from "@/domain/notifications";
import { addPendingSuggestion, dismissPendingSuggestion, registerReceiptDeduplication } from "./suggestions-store";
import { listCategories } from "@/data/repositories/categories";
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

export interface AutoRegisteredTransaction {
  id: string;
  type: "expense" | "income";
  amountCents: number;
  description: string;
  merchant?: string;
  date: string;
  categoryId: string;
  categoryName?: string;
  paymentMethod?: string;
  parsed: ParsedBankTransaction;
  registeredAt: number;
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

    // 2. Busca categorias e resolve categoria mais adequada
    const categories = await listCategories(txType).catch(() => []);
    let targetCategory = findMatchingCategory(categories, parsed.merchant || parsed.description);
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
    const targetName = parsed.merchant || parsed.recipientName || parsed.payerName || "Favorecido";
    const description = parsed.description || (isIncome ? `Pix recebido de ${targetName}` : `Pix para ${targetName}`);

    let createdId = "";

    if (!isIncome) {
      const count = parsed.installments && parsed.installments > 1 ? parsed.installments : 1;
      const installments = buildExpenseInstallments({
        totalCents: parsed.amountCents,
        count,
        startDate: date,
      });

      createdId = await createExpenseWithDebt({
        value,
        date,
        categoryId,
        paymentMethod: parsed.paymentMethod || "pix",
        cardId: null,
        description,
        reportWeight: 1,
        installments,
      });
    } else {
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
          receiveType: "pix",
          description,
          reportWeight: 1,
          installments,
        });
      } else {
        const inc = await createIncome({
          value,
          date,
          category_id: categoryId,
          receive_type: "pix",
          description,
          report_weight: 1,
          source_ref: null,
        });
        createdId = inc.id;
      }
    }

    // Memoriza a categoria para o estabelecimento identificado
    if (parsed.merchant && categoryId) {
      storeMerchantCategory(parsed.merchant, categoryId);
    }

    const formattedAmount = formatCentsAsCurrency(parsed.amountCents);
    const toastTitle = `Pix de ${formattedAmount} para ${targetName} cadastrado!`;

    const autoRegItem: AutoRegisteredTransaction = {
      id: createdId,
      type: txType,
      amountCents: parsed.amountCents,
      description,
      merchant: parsed.merchant || targetName,
      date,
      categoryId,
      categoryName: targetCategory?.name,
      paymentMethod: parsed.paymentMethod || "pix",
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
