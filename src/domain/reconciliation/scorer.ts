import { jaccardTokens, tokenize } from "@/domain/predictions";
import { addMonthsClamped, toISODate } from "@/domain/money/parcelar";
import type {
  CategoryPredictionSource,
  ExistingExpenseForReconciliation,
  ReconciliationItem,
  ReconciliationResult,
  StatementTransaction,
} from "./types";

export interface MatchScoreOptions {
  predictedCategoryId?: string;
  cardScope?: "personal" | "business";
}

function hasTemporalEquivalenceForInstallments(
  stmtDate: string,
  existDate: string,
  current: number,
): boolean {
  if (stmtDate === existDate) return true;
  const stmtDay = Number.parseInt(stmtDate.slice(8, 10), 10);
  const existDay = Number.parseInt(existDate.slice(8, 10), 10);
  if (!Number.isNaN(stmtDay) && !Number.isNaN(existDay) && Math.abs(stmtDay - existDay) <= 2) {
    return true;
  }

  if (current > 1) {
    const deltaMonths = current - 1;
    const stmtTime = new Date(`${stmtDate}T00:00:00`);
    if (!Number.isNaN(stmtTime.getTime())) {
      const shiftedFromStmt = toISODate(addMonthsClamped(stmtTime, deltaMonths));
      const shiftedTime = new Date(`${shiftedFromStmt}T00:00:00`).getTime();
      const existTime = new Date(`${existDate}T00:00:00`).getTime();
      if (!Number.isNaN(shiftedTime) && !Number.isNaN(existTime)) {
        if (Math.abs((shiftedTime - existTime) / 86_400_000) <= 2) {
          return true;
        }
      }
    }

    const existTimeObj = new Date(`${existDate}T00:00:00`);
    if (!Number.isNaN(existTimeObj.getTime())) {
      const shiftedFromExist = toISODate(addMonthsClamped(existTimeObj, deltaMonths));
      const shiftedExistTime = new Date(`${shiftedFromExist}T00:00:00`).getTime();
      const stmtTimeVal = new Date(`${stmtDate}T00:00:00`).getTime();
      if (!Number.isNaN(shiftedExistTime) && !Number.isNaN(stmtTimeVal)) {
        if (Math.abs((shiftedExistTime - stmtTimeVal) / 86_400_000) <= 2) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Calcula o score de similaridade multidimensional (0 a 100) entre um item
 * do extrato e uma despesa já existente no app.
 *
 * Pesos e Componentes:
 * - 50% Componente Monetário (exatidão de centavos ou tolerância fuzzy de microdiscrepância).
 * - 35% Componente Temporal (proximidade de data ou equivalência temporal para parcelamentos).
 * - 15% Componente Textual (similaridade de Jaccard entre descrições).
 * - +10% Bônus de Categoria Compartilhada.
 * - +15% Bônus Semântico de Encargo.
 * - +25%/-20% Bônus/Penalidade de Coincidência de Parcelamento.
 *
 * TRAVA ESTRUTURAL ABSOLUTA:
 * Se houver qualquer divergência de centavos (diffCents > 0), o score é limitado ao teto de 79 pontos,
 * garantindo que nunca seja classificado como exact_match.
 */
export function calculateMatchScore(
  statement: StatementTransaction,
  existing: ExistingExpenseForReconciliation,
  options?: MatchScoreOptions,
): number {
  // 0. Isolamento Estrito de Escopo (PF vs PJ)
  if (options?.cardScope && existing.scope && options.cardScope !== existing.scope) {
    return 0;
  }

  // 1. Componente Monetário (máx 50%)
  const diffCents = Math.abs(statement.amountCents - existing.valueCents);
  let scoreValue: number;
  if (diffCents === 0) {
    scoreValue = 50; // Exatidão perfeita de centavos
  } else if (diffCents === 1) {
    scoreValue = 30; // Microdiscrepância de 1 centavo (ex.: R$ 100 / 3 ou Amazon vs Livros)
  } else if (diffCents <= 5) {
    scoreValue = 20; // Microdiscrepância de até 5 centavos
  } else {
    return 0; // Valores monetários incompatíveis
  }

  // 2. Componente Temporal (máx 35%)
  let scoreDate = 0;
  const stmtDateStr = statement.originalDate || statement.date;
  const isSameInstallmentSeries =
    statement.installment &&
    statement.installment.total > 1 &&
    existing.installmentNumber !== null &&
    existing.installmentsTotal !== null &&
    statement.installment.current === existing.installmentNumber &&
    statement.installment.total === existing.installmentsTotal;

  if (
    isSameInstallmentSeries &&
    hasTemporalEquivalenceForInstallments(
      stmtDateStr,
      existing.date,
      statement.installment!.current,
    )
  ) {
    scoreDate = 35; // Equivalência temporal plena para parcelas
  } else {
    const stmtTime = new Date(`${stmtDateStr}T00:00:00`).getTime();
    const existTime = new Date(`${existing.date}T00:00:00`).getTime();
    const diffDays = Math.abs((stmtTime - existTime) / 86_400_000);

    if (diffDays === 0) {
      scoreDate = 35; // Mesmo dia
    } else if (diffDays === 1) {
      scoreDate = 25; // 1 dia de diferença (D+1 do processamento do cartão)
    } else if (diffDays <= 3) {
      scoreDate = 15;
    } else if (diffDays <= 7) {
      scoreDate = 10;
    } else {
      const stmtDay = stmtDateStr.slice(8, 10);
      const existDay = existing.date.slice(8, 10);
      if (stmtDay === existDay) {
        scoreDate = 10;
      }
    }
  }

  // 3. Componente Textual (15%)
  const tokensStmt = tokenize(statement.cleanDescription);
  const tokensExist = tokenize(existing.description);
  const similarity = jaccardTokens(tokensStmt, tokensExist);
  const scoreText = Math.round(similarity * 15);

  // 4. Bônus de Categoria Compartilhada (+10%)
  let bonusCategory = 0;
  if (
    options?.predictedCategoryId &&
    existing.categoryId &&
    options.predictedCategoryId === existing.categoryId
  ) {
    bonusCategory = 10;
  }

  // 5. Bônus Semântico de Encargo (+15%)
  let bonusCharge = 0;
  if (
    statement.inferredChargeKind &&
    statement.inferredChargeKind !== "regular" &&
    existing.chargeKind &&
    existing.chargeKind !== "regular" &&
    statement.inferredChargeKind === existing.chargeKind
  ) {
    bonusCharge = 15;
  }

  // 6. Bônus/Penalidade de Coincidência de Parcelamento
  let bonusInstallment = 0;
  if (
    statement.installment &&
    statement.installment.total > 1 &&
    existing.installmentNumber !== null &&
    existing.installmentsTotal !== null &&
    existing.installmentsTotal > 1
  ) {
    if (
      statement.installment.current === existing.installmentNumber &&
      statement.installment.total === existing.installmentsTotal
    ) {
      bonusInstallment = 25;
    } else {
      bonusInstallment = -20;
    }
  }

  let totalScore =
    scoreValue + scoreDate + scoreText + bonusCategory + bonusCharge + bonusInstallment;

  // TRAVA ESTRUTURAL ABSOLUTA:
  // Se houver qualquer divergência de centavos (diffCents > 0), o score NUNCA pode ser exact_match (teto 79)
  if (diffCents > 0) {
    totalScore = Math.min(79, totalScore);
  }

  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/**
 * Encontra a melhor categoria preditiva a partir do histórico de lançamentos.
 */
export function predictCategoryForDescription(
  cleanDescription: string,
  history: CategoryPredictionSource[] | undefined,
  defaultCategoryId: string,
): string {
  if (!history || history.length === 0) return defaultCategoryId;

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
 * Retorna os itens reconciliados e as despesas do app que não constam no extrato.
 */
export function reconcileStatementTransactions(params: {
  statementTransactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
  cardScope?: "personal" | "business";
}): ReconciliationResult {
  const { statementTransactions, existingExpenses, history, defaultCategoryId, cardScope } =
    params;

  // Mapa de despesas existentes que já receberam match para evitar duplo match
  const matchedExistingIds = new Set<string>();

  // Mapa de ocorrências de assinaturas no próprio lote para detectar duplicidades internas
  const seenSignatures = new Map<string, number>();

  const items: ReconciliationItem[] = statementTransactions.map((tx) => {
    const signature = `${tx.date}|${tx.amountCents}|${tx.cleanDescription.toLowerCase()}`;
    const previousOccurrences = seenSignatures.get(signature) ?? 0;
    seenSignatures.set(signature, previousOccurrences + 1);
    const isInternalDuplicate = previousOccurrences > 0;

    // Resolução semântica local da categoria executada ANTES do scoring
    const predictedCatId = predictCategoryForDescription(
      tx.cleanDescription,
      history,
      defaultCategoryId,
    );

    // Pagamento de fatura: ignorado por padrão
    if (tx.isPayment) {
      return {
        transaction: tx,
        nature: tx.nature || "invoice_payment",
        status: "unmatched_new",
        score: 0,
        suggestedCategoryId: defaultCategoryId,
        selectedCategoryId: defaultCategoryId,
        selected: false,
        ignoredByDefault: true,
        isInternalDuplicate,
        duplicateReason: isInternalDuplicate
          ? "Lançamento duplicado no arquivo"
          : "Pagamento de fatura anterior",
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

      const score = calculateMatchScore(tx, existing, {
        predictedCategoryId: predictedCatId,
        cardScope,
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    // Classificação 1: Match Exato (exige exatidão de centavos AND score >= 75)
    if (bestMatch && bestScore >= 75 && bestMatch.valueCents === tx.amountCents) {
      matchedExistingIds.add(bestMatch.id);
      return {
        transaction: tx,
        nature: tx.nature || (tx.isRefund ? "refund" : "purchase"),
        status: "exact_match",
        score: bestScore,
        matchedExpenseId: bestMatch.id,
        matchedExpenseDescription: bestMatch.description,
        matchedExpenseDate: bestMatch.date,
        matchedExpenseValueCents: bestMatch.valueCents,
        suggestedCategoryId: bestMatch.categoryId,
        selectedCategoryId: bestMatch.categoryId,
        selected: false,
        suggestedAction: "link_existing",
        isInternalDuplicate,
        duplicateReason: isInternalDuplicate
          ? "Lançamento duplicado no arquivo e já cadastrado no app"
          : "Despesa já cadastrada no app",
      };
    }

    // Classificação 2: Match Provável (inclui microdiscrepância de centavos ou datas próximas)
    if (bestMatch && bestScore >= 40) {
      matchedExistingIds.add(bestMatch.id);
      const isCentDiff = bestMatch.valueCents !== tx.amountCents;
      return {
        transaction: tx,
        nature: tx.nature || (tx.isRefund ? "refund" : "purchase"),
        status: "probable_match",
        score: bestScore,
        matchedExpenseId: bestMatch.id,
        matchedExpenseDescription: bestMatch.description,
        matchedExpenseDate: bestMatch.date,
        matchedExpenseValueCents: bestMatch.valueCents,
        suggestedCategoryId: bestMatch.categoryId,
        selectedCategoryId: bestMatch.categoryId,
        selected: false,
        suggestedAction: isCentDiff ? "link_and_adjust_amount" : "link_existing",
        isInternalDuplicate,
        duplicateReason: isInternalDuplicate ? "Lançamento duplicado no arquivo" : undefined,
      };
    }

    // Classificação 3: Novo Lançamento (não encontrado no app)
    const suggestedAction =
      tx.installment && tx.installment.total > 1
        ? tx.installment.current === 1
          ? "import_and_project_series"
          : "import_single"
        : undefined;

    return {
      transaction: tx,
      nature: tx.nature || (tx.isRefund ? "refund" : "purchase"),
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: predictedCatId,
      selectedCategoryId: predictedCatId,
      selected: !tx.isRefund && !isInternalDuplicate,
      suggestedAction,
      isInternalDuplicate,
      duplicateReason: isInternalDuplicate ? "Lançamento duplicado no mesmo arquivo" : undefined,
    };
  });

  // Despesas cadastradas no app que NÃO tiveram nenhuma correspondência na fatura
  const unmatchedExistingExpenses = existingExpenses.filter((e) => !matchedExistingIds.has(e.id));

  return {
    items,
    unmatchedExistingExpenses,
  };
}
