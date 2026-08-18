import { jaccardTokens, tokenize } from "@/domain/predictions";
import type { PredictionEntry } from "@/domain/predictions";
import type { ExistingExpenseForReconciliation, ReconciliationItem, StatementTransaction } from "./types";

/**
 * Calcula o score de similaridade multidimensional (0 a 100) entre um item
 * do extrato e uma despesa já existente no app.
 *
 * Pesos:
 * - 50% Componente Monetário (exige exatidão de centavos).
 * - 25% Componente Temporal (proximidade de data).
 * - 25% Componente Textual (similaridade de Jaccard entre descrições).
 */
export function calculateMatchScore(
  statement: StatementTransaction,
  existing: ExistingExpenseForReconciliation,
): number {
  // 1. Componente Monetário (50%)
  if (statement.amountCents !== existing.valueCents) {
    return 0; // Exige exatidão monetária em compras de cartão
  }
  const scoreValue = 50;

  // 2. Componente Temporal (25%)
  const stmtTime = new Date(`${statement.date}T00:00:00`).getTime();
  const existTime = new Date(`${existing.date}T00:00:00`).getTime();
  const diffDays = Math.abs((stmtTime - existTime) / 86_400_000);

  let scoreDate = 0;
  if (diffDays === 0) {
    scoreDate = 25;
  } else if (diffDays === 1) {
    scoreDate = 20;
  } else if (diffDays <= 3) {
    scoreDate = 12;
  } else if (diffDays <= 7) {
    scoreDate = 5;
  }

  // 3. Componente Textual (25%)
  const tokensStmt = tokenize(statement.cleanDescription);
  const tokensExist = tokenize(existing.description);
  const similarity = jaccardTokens(tokensStmt, tokensExist);
  const scoreText = Math.round(similarity * 25);

  return Math.min(100, scoreValue + scoreDate + scoreText);
}

/**
 * Encontra a melhor categoria preditiva a partir do histórico de lançamentos.
 */
export function predictCategoryForDescription(
  cleanDescription: string,
  history: PredictionEntry[],
  defaultCategoryId: string,
): string {
  if (history.length === 0) return defaultCategoryId;

  const targetTokens = tokenize(cleanDescription);
  if (targetTokens.length === 0) return defaultCategoryId;

  let bestScore = -1;
  let bestCategoryId = defaultCategoryId;

  for (const entry of history) {
    if (!entry.categoryId) continue;

    const entryTokens = tokenize(entry.description);
    const sim = jaccardTokens(targetTokens, entryTokens);

    if (sim > bestScore && sim >= 0.25) {
      bestScore = sim;
      bestCategoryId = entry.categoryId;
    }
  }

  return bestCategoryId;
}

/**
 * Processa a reconciliação completa de uma lista de transações de extrato
 * contra a lista de despesas já existentes na competência.
 */
export function reconcileStatementTransactions(params: {
  statementTransactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  history: PredictionEntry[];
  defaultCategoryId: string;
}): ReconciliationItem[] {
  const { statementTransactions, existingExpenses, history, defaultCategoryId } = params;

  // Mapa de despesas existentes que já receberam match para evitar duplo match
  const matchedExistingIds = new Set<string>();

  return statementTransactions.map((tx) => {
    // Pagamento de fatura: ignorado por padrão
    if (tx.isPayment) {
      return {
        transaction: tx,
        status: "unmatched_new",
        score: 0,
        suggestedCategoryId: defaultCategoryId,
        selectedCategoryId: defaultCategoryId,
        selected: false,
        ignoredByDefault: true,
      };
    }

    // Procura o melhor match entre as despesas existentes ainda não vinculadas
    let bestMatch: ExistingExpenseForReconciliation | null = null;
    let bestScore = -1;

    for (const existing of existingExpenses) {
      if (matchedExistingIds.has(existing.id)) continue;

      // Se tiver mesmo statement_hash gravado, é match exato imediato
      if (existing.statementHash && existing.statementHash === tx.statementHash) {
        bestMatch = existing;
        bestScore = 100;
        break;
      }

      const score = calculateMatchScore(tx, existing);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    // Classificação
    if (bestMatch && bestScore >= 85) {
      matchedExistingIds.add(bestMatch.id);
      return {
        transaction: tx,
        status: "exact_match",
        score: bestScore,
        matchedExpenseId: bestMatch.id,
        matchedExpenseDescription: bestMatch.description,
        matchedExpenseDate: bestMatch.date,
        matchedExpenseValueCents: bestMatch.valueCents,
        suggestedCategoryId: bestMatch.categoryId,
        selectedCategoryId: bestMatch.categoryId,
        // Já conciliado: fica desmarcado por padrão para não duplicar
        selected: false,
      };
    }

    if (bestMatch && bestScore >= 50) {
      matchedExistingIds.add(bestMatch.id);
      return {
        transaction: tx,
        status: "probable_match",
        score: bestScore,
        matchedExpenseId: bestMatch.id,
        matchedExpenseDescription: bestMatch.description,
        matchedExpenseDate: bestMatch.date,
        matchedExpenseValueCents: bestMatch.valueCents,
        suggestedCategoryId: bestMatch.categoryId,
        selectedCategoryId: bestMatch.categoryId,
        // Sugestão: marcado para revisão do usuário
        selected: true,
      };
    }

    // Novo lançamento (não encontrado no app)
    const suggestedCatId = predictCategoryForDescription(tx.cleanDescription, history, defaultCategoryId);

    return {
      transaction: tx,
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: suggestedCatId,
      selectedCategoryId: suggestedCatId,
      // Novo lançamento: marcado para importação
      selected: !tx.isRefund,
    };
  });
}
