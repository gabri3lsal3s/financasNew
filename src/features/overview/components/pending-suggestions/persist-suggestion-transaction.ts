import { resolveBestMatchingCard, type ParsedBankTransaction } from "@/domain/notifications";
import {
  buildExpenseInstallments,
  buildIncomeInstallments,
} from "@/features/transactions/wizard/wizard-state";
import type { CreditCard, ReceiveType } from "@/types";

interface PersistSuggestionDeps {
  cards?: CreditCard[];
  createExpense: (input: {
    value: number;
    date: string;
    categoryId: string;
    paymentMethod: string;
    cardId: string | null;
    description: string | null;
    reportWeight: number;
    installments: ReturnType<typeof buildExpenseInstallments>;
  }) => Promise<string>;
  createIncome: (input: {
    value: number;
    date: string;
    category_id: string;
    receive_type: ReceiveType;
    description: string | null;
    report_weight: number;
    source_ref: null;
  }) => Promise<{ id: string }>;
  createIncomeInstallments: (input: {
    value: number;
    date: string;
    categoryId: string;
    receiveType: ReceiveType;
    description: string | null;
    reportWeight: number;
    installments: ReturnType<typeof buildIncomeInstallments>;
  }) => Promise<string>;
}

/**
 * Persiste uma transação sugerida via notificação como despesa ou receita (à vista ou parcelada).
 */
export async function persistSuggestionTransaction(
  sug: ParsedBankTransaction,
  categoryId: string,
  deps: PersistSuggestionDeps,
): Promise<{ createdId: string; resolvedCardId?: string }> {
  if (sug.type === "expense") {
    let cardId: string | null = null;
    let closingDay: number | null = null;
    let resolvedCardId: string | undefined;

    if (sug.paymentMethod === "credit_card") {
      const matchingCard = resolveBestMatchingCard(deps.cards, {
        cardLastDigits: sug.cardLastDigits,
        bankName: sug.bankName,
        issuerBank: sug.issuerBank,
        cardBrand: sug.cardBrand,
      });
      if (matchingCard) {
        cardId = matchingCard.id;
        resolvedCardId = matchingCard.id;
        closingDay = matchingCard.closing_day;
      }
    }

    const count = sug.installments && sug.installments > 1 ? sug.installments : 1;
    const installments = buildExpenseInstallments({
      totalCents: sug.amountCents,
      count,
      startDate: sug.date,
      closingDay,
    });
    const createdId = await deps.createExpense({
      value: sug.amountCents / 100,
      date: sug.date,
      categoryId,
      paymentMethod: sug.paymentMethod || "other",
      cardId,
      description: sug.description || null,
      reportWeight: 1,
      installments,
    });
    return { createdId, resolvedCardId };
  }

  const receiveType: ReceiveType =
    sug.paymentMethod === "pix" ? "pix" : sug.paymentMethod === "transfer" ? "transfer" : "other";
  if (sug.installments && sug.installments > 1) {
    const installments = buildIncomeInstallments({
      totalCents: sug.amountCents,
      count: sug.installments,
      startDate: sug.date,
    });
    const createdId = await deps.createIncomeInstallments({
      value: sug.amountCents / 100,
      date: sug.date,
      categoryId,
      receiveType,
      description: sug.description || null,
      reportWeight: 1,
      installments,
    });
    return { createdId };
  }

  const row = await deps.createIncome({
    value: sug.amountCents / 100,
    date: sug.date,
    category_id: categoryId,
    receive_type: receiveType,
    description: sug.description || null,
    report_weight: 1,
    source_ref: null,
  });
  return { createdId: row.id };
}
