import { calculateMatchScore, predictCategoryForDescription } from "./scorer";
import {
  isCreditCardPayment,
  isInternalTransferOrInvestment,
  isRefundOrReturn,
  isLikelyIncomeDescription,
  inferReceiveTypeFromDescription,
} from "./clean";
import type {
  BankReconciliationResult,
  BankTransactionItem,
  BankTransactionKind,
  CategoryPredictionSource,
  ExistingExpenseForReconciliation,
  ExistingIncomeForReconciliation,
  StatementTransaction,
} from "./types";

interface ReconcileBankParams {
  statementTransactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  existingIncomes: ExistingIncomeForReconciliation[];
  categoryPredictionHistory: CategoryPredictionSource[];
  defaultCategoryId: string;
}

/**
 * Reconcilia transações de extrato de conta corrente contra despesas e receitas cadastradas no app.
 */
export function reconcileBankTransactions(params: ReconcileBankParams): BankReconciliationResult {
  const {
    statementTransactions,
    existingExpenses,
    existingIncomes,
    categoryPredictionHistory,
    defaultCategoryId,
  } = params;

  const matchedExpenseIds = new Set<string>();
  const matchedIncomeIds = new Set<string>();
  const items: BankTransactionItem[] = [];

  for (const tx of statementTransactions) {
    // 1. Heurísticas de detecção de natureza e travas anti-fragilidade
    const isCcPay = isCreditCardPayment(tx.rawDescription);
    const isTransferInvest = isInternalTransferOrInvestment(tx.rawDescription);
    const isRefund = tx.isRefund || isRefundOrReturn(tx.rawDescription);
    const isLikelyIncome = isLikelyIncomeDescription(tx.rawDescription);

    let kind: BankTransactionKind = "expense";
    let ignoredByDefault = false;
    let ignoreReason: string | undefined;

    if (isCcPay) {
      kind = "card_payment_ignored";
      ignoredByDefault = true;
      ignoreReason = "Pagamento de fatura de cartão de crédito";
    } else if (isTransferInvest) {
      kind = "transfer_ignored";
      ignoredByDefault = true;
      ignoreReason = "Transferência interna ou aporte em investimentos";
    } else if (tx.isRefund || isRefund || isLikelyIncome) {
      kind = "income";
    }

    // 2. Reconciliação para ENTRADAS (Receitas)
    if (kind === "income") {
      let bestIncome: ExistingIncomeForReconciliation | null = null;
      let highestScore = 0;

      for (const inc of existingIncomes) {
        if (matchedIncomeIds.has(inc.id)) continue;

        // Se o hash de extrato coincidir exatamente
        if (inc.statementHash && inc.statementHash === tx.statementHash) {
          bestIncome = inc;
          highestScore = 100;
          break;
        }

        // Se valor for igual
        if (inc.valueCents === tx.amountCents) {
          let currentScore = 50;
          // Mesma data
          if (inc.date === tx.date) {
            currentScore = 85;
          }
          if (currentScore > highestScore) {
            highestScore = currentScore;
            bestIncome = inc;
          }
        }
      }

      if (bestIncome && highestScore >= 50) {
        matchedIncomeIds.add(bestIncome.id);
        const status = highestScore >= 85 ? "exact_match" : "probable_match";
        const receiveType = bestIncome.receiveType ?? inferReceiveTypeFromDescription(tx.rawDescription);

        items.push({
          transaction: tx,
          kind: "income",
          status,
          score: highestScore,
          matchedIncomeId: bestIncome.id,
          matchedIncomeDescription: bestIncome.description,
          matchedIncomeDate: bestIncome.date,
          matchedIncomeValueCents: bestIncome.valueCents,
          suggestedCategoryId: defaultCategoryId,
          selectedCategoryId: defaultCategoryId,
          suggestedReceiveType: receiveType,
          selectedReceiveType: receiveType,
          selected: false, // Itens já conciliados vêm desmarcados por padrão
          ignoredByDefault,
          ignoreReason,
        });
      } else {
        const receiveType = inferReceiveTypeFromDescription(tx.rawDescription);
        items.push({
          transaction: tx,
          kind: "income",
          status: "unmatched_new",
          score: 0,
          suggestedCategoryId: defaultCategoryId,
          selectedCategoryId: defaultCategoryId,
          suggestedReceiveType: receiveType,
          selectedReceiveType: receiveType,
          selected: !ignoredByDefault,
          ignoredByDefault,
          ignoreReason,
        });
      }
      continue;
    }

    // 3. Reconciliação para SAÍDAS (Despesas e Ignoradas)
    let bestExpense: ExistingExpenseForReconciliation | null = null;
    let highestScore = 0;

    for (const exp of existingExpenses) {
      if (matchedExpenseIds.has(exp.id)) continue;

      if (exp.statementHash && exp.statementHash === tx.statementHash) {
        bestExpense = exp;
        highestScore = 100;
        break;
      }

      const score = calculateMatchScore(tx, exp);
      if (score > highestScore) {
        highestScore = score;
        bestExpense = exp;
      }
    }

    if (bestExpense && highestScore >= 50) {
      matchedExpenseIds.add(bestExpense.id);
      const status = highestScore >= 85 ? "exact_match" : "probable_match";

      items.push({
        transaction: tx,
        kind,
        status,
        score: highestScore,
        matchedExpenseId: bestExpense.id,
        matchedExpenseDescription: bestExpense.description,
        matchedExpenseDate: bestExpense.date,
        matchedExpenseValueCents: bestExpense.valueCents,
        suggestedCategoryId: bestExpense.categoryId,
        selectedCategoryId: bestExpense.categoryId,
        selected: false, // Itens conciliados vêm desmarcados por padrão
        ignoredByDefault,
        ignoreReason,
      });
    } else {
      const predictedCategory = predictCategoryForDescription(
        tx.cleanDescription,
        categoryPredictionHistory,
        defaultCategoryId,
      );

      items.push({
        transaction: tx,
        kind,
        status: "unmatched_new",
        score: 0,
        suggestedCategoryId: predictedCategory,
        selectedCategoryId: predictedCategory,
        selected: !ignoredByDefault,
        ignoredByDefault,
        ignoreReason,
      });
    }
  }

  // 4. Identifica lançamentos existentes no app que não constam no extrato
  const unmatchedExistingExpenses = existingExpenses.filter(
    (exp) => !matchedExpenseIds.has(exp.id),
  );
  const unmatchedExistingIncomes = existingIncomes.filter(
    (inc) => !matchedIncomeIds.has(inc.id),
  );

  return {
    items,
    unmatchedExistingExpenses,
    unmatchedExistingIncomes,
  };
}
