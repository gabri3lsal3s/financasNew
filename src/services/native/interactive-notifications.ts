import { LocalNotifications } from "@capacitor/local-notifications";
import {
  inferCategoryKeyword,
  matchCategoryBySlug,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { isNativePlatform } from "./platform";
import { addPendingSuggestion, dismissPendingSuggestion } from "./suggestions-store";
import { listCategories } from "@/data/repositories/categories";
import { listActiveCreditCards } from "@/data/repositories/credit-cards";
import { createExpenseWithDebt, createIncomeInstallments, deleteExpenseInstallments } from "@/data/rpc";
import { createIncome, deleteIncome } from "@/data/repositories/incomes";
import { buildExpenseInstallments, buildIncomeInstallments } from "@/features/transactions/wizard/wizard-state";
import { getErrorMessage } from "@/services/errors";
import type { Category, ReceiveType } from "@/types";

export const BANK_SUGGESTION_CHANNEL_ID = "bank_transaction_suggestions";
export const BANK_SUGGESTION_ACTION_TYPE_ID = "BANK_TRANSACTION_SUGGESTION";
export const BANK_FEEDBACK_ACTION_TYPE_ID = "BANK_TRANSACTION_FEEDBACK";

export const ACTION_QUICK_ADD = "quick_add";
export const ACTION_EDIT = "edit";
export const ACTION_UNDO = "undo_quick_add";

export interface QuickAddResult {
  success: boolean;
  createdId?: string;
  categoryName?: string;
  type: "expense" | "income";
  error?: string;
}

/**
 * Gera um identificador numérico inteiro determinístico a partir de uma string.
 * Garante compatibilidade com o ID inteiro de notificações locais no Android.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2000000000) + 1000;
}

/**
 * Formata centavos em string monetária BRL sem emojis.
 */
export function formatCurrencyBRL(cents: number): string {
  const reais = cents / 100;
  return `R$ ${reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formata o rótulo legível do meio de pagamento.
 */
export function formatMethodLabel(method?: string): string {
  switch (method) {
    case "credit_card":
      return "Cartão de Crédito";
    case "debit":
      return "Cartão de Débito";
    case "pix":
      return "Pix";
    case "transfer":
      return "TED/DOC";
    default:
      return "Outro";
  }
}

/**
 * Mapeia estabelecimentos e descrições comuns para categorias do sistema de forma determinística.
 */
export function findMatchingCategory(categories: Category[], description: string): Category | undefined {
  if (!description || categories.length === 0) return undefined;

  const slug = inferCategoryKeyword(description);
  if (slug) {
    const matched = matchCategoryBySlug(categories, slug);
    if (matched) return matched;
  }

  const descLower = description.toLowerCase();
  for (const cat of categories) {
    if (descLower.includes(cat.name.toLowerCase())) {
      return cat;
    }
  }

  return undefined;
}

/**
 * Cria o canal de notificações e registra as ações interativas no Android.
 */
export async function setupInteractiveNotificationActions(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: BANK_SUGGESTION_CHANNEL_ID,
      name: "Transações Detectadas",
      description: "Notificações interativas de compras e receitas bancárias com ação rápida",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
    });

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: BANK_SUGGESTION_ACTION_TYPE_ID,
          actions: [
            {
              id: ACTION_EDIT,
              title: "Conferir e Salvar",
            },
            {
              id: ACTION_QUICK_ADD,
              title: "Adicionar Rápido",
            },
          ],
        },
        {
          id: BANK_FEEDBACK_ACTION_TYPE_ID,
          actions: [
            {
              id: ACTION_UNDO,
              title: "Desfazer",
            },
          ],
        },
      ],
    });
  } catch {
    // Falha silenciosa
  }
}

/**
 * Emite uma notificação local interativa rica com botões [Conferir e Salvar] e [Adicionar Rápido].
 */
export async function scheduleInteractiveBankNotification(
  transaction: ParsedBankTransaction,
): Promise<number | null> {
  if (!isNativePlatform()) return null;

  try {
    await setupInteractiveNotificationActions();

    const notifId = hashString(transaction.id);

    let title = "";
    if (transaction.installments && transaction.installments > 1) {
      title = `Transação detectada (${transaction.installments}x): ${formatCurrencyBRL(transaction.amountCents)}`;
    } else if (transaction.type === "income") {
      title = `Renda detectada: ${formatCurrencyBRL(transaction.amountCents)}`;
    } else {
      title = `Transação detectada: ${formatCurrencyBRL(transaction.amountCents)}`;
    }

    const body = `${transaction.description} · ${transaction.bankName} (${formatMethodLabel(transaction.paymentMethod)})`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: BANK_SUGGESTION_CHANNEL_ID,
          actionTypeId: BANK_SUGGESTION_ACTION_TYPE_ID,
          extra: {
            suggestion: transaction,
            notificationId: notifId,
          },
        },
      ],
    });

    return notifId;
  } catch {
    return null;
  }
}

/**
 * Cancela a notificação de uma transação específica.
 */
export async function cancelInteractiveBankNotification(transactionId: string): Promise<void> {
  if (!isNativePlatform()) return;

  const notifId = hashString(transactionId);
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: notifId }, { id: notifId + 1 }],
    });
  } catch {
    // no-op
  }
}

/**
 * Grava a transação em segundo plano sem abrir a interface gráfica (QuickAdd).
 */
export async function quickAddTransaction(suggestion: ParsedBankTransaction): Promise<QuickAddResult> {
  // 1. Resiliência Online First: verifica se o dispositivo está conectado
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await notifyOfflineFailure(suggestion);
    return {
      success: false,
      type: suggestion.type,
      error: "Sem conexão com a internet.",
    };
  }

  try {
    // 2. Busca categorias do usuário para inferir categoria ou adotar fallback seguro
    const categories = await listCategories(suggestion.type).catch(() => []);
    let targetCategory = findMatchingCategory(categories, suggestion.description);
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
    const categoryName = targetCategory?.name ?? (suggestion.type === "income" ? "Renda" : "Geral");

    let createdId = "";

    if (suggestion.type === "expense") {
      // 3. Resolução de cartão para compras no crédito
      let cardId: string | null = null;
      let closingDay: number | null = null;

      if (suggestion.paymentMethod === "credit_card") {
        const cards = await listActiveCreditCards().catch(() => []);
        const matchingCard =
          cards.find((card) => card.name.toLowerCase().includes(suggestion.bankName.toLowerCase())) ||
          cards[0];

        if (matchingCard) {
          cardId = matchingCard.id;
          closingDay = matchingCard.closing_day;
        }
      }

      const count = suggestion.installments && suggestion.installments > 1 ? suggestion.installments : 1;
      const installments = buildExpenseInstallments({
        totalCents: suggestion.amountCents,
        count,
        startDate: suggestion.date,
        closingDay,
      });

      createdId = await createExpenseWithDebt({
        value: suggestion.amountCents / 100,
        date: suggestion.date,
        categoryId,
        paymentMethod: suggestion.paymentMethod || "other",
        cardId,
        description: suggestion.description || null,
        reportWeight: 1,
        installments,
      });
    } else {
      // Renda / Receita
      const receiveType: ReceiveType =
        suggestion.paymentMethod === "pix"
          ? "pix"
          : suggestion.paymentMethod === "transfer"
            ? "transfer"
            : "other";

      if (suggestion.installments && suggestion.installments > 1) {
        const installments = buildIncomeInstallments({
          totalCents: suggestion.amountCents,
          count: suggestion.installments,
          startDate: suggestion.date,
        });

        createdId = await createIncomeInstallments({
          value: suggestion.amountCents / 100,
          date: suggestion.date,
          categoryId,
          receiveType,
          installments,
          description: suggestion.description || null,
          reportWeight: 1,
        });
      } else {
        const inc = await createIncome({
          value: suggestion.amountCents / 100,
          date: suggestion.date,
          category_id: categoryId,
          receive_type: receiveType,
          description: suggestion.description || null,
          report_weight: 1,
          source_ref: null,
        });
        createdId = inc.id;
      }
    }

    // 4. Sucesso: descarta da fila de sugestões pendentes
    dismissPendingSuggestion(suggestion.id);

    // 5. Feedback com botão Desfazer
    await notifyQuickAddSuccess(suggestion, createdId, categoryName);

    return {
      success: true,
      createdId,
      categoryName,
      type: suggestion.type,
    };
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    await notifyQuickAddError(suggestion, errorMsg);
    return {
      success: false,
      type: suggestion.type,
      error: errorMsg,
    };
  }
}

/**
 * Desfaz a criação de uma transação recém-adicionada e restaura a sugestão na fila.
 */
export async function undoQuickAddTransaction(
  createdId: string,
  type: "expense" | "income",
  suggestion: ParsedBankTransaction,
): Promise<boolean> {
  try {
    if (type === "expense") {
      await deleteExpenseInstallments(createdId, "all");
    } else {
      await deleteIncome(createdId);
    }

    // Restaura a sugestão na fila
    addPendingSuggestion(suggestion);

    if (isNativePlatform()) {
      const notifId = hashString(suggestion.id);
      const feedbackId = notifId + 1;
      await LocalNotifications.cancel({ notifications: [{ id: feedbackId }] });

      await LocalNotifications.schedule({
        notifications: [
          {
            id: feedbackId,
            title: "Lançamento desfeito",
            body: "A transação voltou para a fila de sugestões pendentes.",
            channelId: BANK_SUGGESTION_CHANNEL_ID,
          },
        ],
      });

      setTimeout(() => {
        void LocalNotifications.cancel({ notifications: [{ id: feedbackId }] }).catch(() => {});
      }, 5000);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Emite notificação de feedback de sucesso com botão [Desfazer].
 */
async function notifyQuickAddSuccess(
  suggestion: ParsedBankTransaction,
  createdId: string,
  categoryName: string,
): Promise<void> {
  if (!isNativePlatform()) return;

  const notifId = hashString(suggestion.id);
  const feedbackId = notifId + 1;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: feedbackId,
          title: "Lançamento registrado",
          body: `${formatCurrencyBRL(suggestion.amountCents)} adicionado em ${categoryName}`,
          channelId: BANK_SUGGESTION_CHANNEL_ID,
          actionTypeId: BANK_FEEDBACK_ACTION_TYPE_ID,
          extra: {
            createdId,
            type: suggestion.type,
            suggestion,
            feedbackId,
          },
        },
      ],
    });

    setTimeout(() => {
      void LocalNotifications.cancel({ notifications: [{ id: feedbackId }] }).catch(() => {});
    }, 8000);
  } catch {
    // no-op
  }
}

/**
 * Emite notificação de alerta informando falta de conexão à internet.
 */
async function notifyOfflineFailure(suggestion: ParsedBankTransaction): Promise<void> {
  if (!isNativePlatform()) return;

  const notifId = hashString(suggestion.id);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: "Sem conexão à internet",
          body: "A transação continua salva nas sugestões para confirmar depois.",
          channelId: BANK_SUGGESTION_CHANNEL_ID,
          actionTypeId: BANK_SUGGESTION_ACTION_TYPE_ID,
          extra: { suggestion, notificationId: notifId },
        },
      ],
    });
  } catch {
    // no-op
  }
}

/**
 * Emite notificação de erro caso ocorra falha na chamada de gravação.
 */
async function notifyQuickAddError(
  suggestion: ParsedBankTransaction,
  errorMessage: string,
): Promise<void> {
  if (!isNativePlatform()) return;

  const notifId = hashString(suggestion.id);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: "Não foi possível salvar o lançamento",
          body: errorMessage || "A transação continua disponível no aplicativo.",
          channelId: BANK_SUGGESTION_CHANNEL_ID,
          actionTypeId: BANK_SUGGESTION_ACTION_TYPE_ID,
          extra: { suggestion, notificationId: notifId },
        },
      ],
    });
  } catch {
    // no-op
  }
}
