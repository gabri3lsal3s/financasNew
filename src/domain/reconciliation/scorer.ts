import { jaccardTokens, tokenize } from "@/domain/predictions/index";
import { addMonthsClamped, toISODate } from "@/domain/money/parcelar";
import { findAppDuplicateCandidates } from "./app-duplicates";
import type {
  CategoryPredictionSource,
  CrossCompetenceMatch,
  ExistingExpenseForReconciliation,
  ExistingRefundForReconciliation,
  ReconciliationItem,
  ReconciliationResult,
  StatementTransaction,
} from "./contracts";

export interface MatchScoreOptions {
  predictedCategoryId?: string;
  cardScope?: "personal" | "business" | "mixed";
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
  if (
    options?.cardScope &&
    options.cardScope !== "mixed" &&
    existing.scope &&
    options.cardScope !== existing.scope
  ) {
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

  // 5. Bônus Semântico de Encargo (+25% quando valor exato na competência, +15% caso contrário)
  // Garante exact_match (>= 75) para encargos pré-criados via BillRolloverDialog / pay_card_bill_with_charges
  // mesmo quando a data de lançamento do encargo no app diverge da data impressa no PDF.
  let bonusCharge = 0;
  if (
    statement.inferredChargeKind &&
    statement.inferredChargeKind !== "regular" &&
    existing.chargeKind &&
    existing.chargeKind !== "regular" &&
    statement.inferredChargeKind === existing.chargeKind
  ) {
    bonusCharge = diffCents === 0 ? 25 : 15;
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

  // GUARDA G7 — Piso Anti-Falso-Match:
  // Sem interseção textual (scoreText === 0) e sem encargo ou parcela coincidente,
  // o score tem teto estrito de 70 (probable_match), impedindo exact_match entre compras distintas de mesmo valor no mesmo dia.
  if (scoreText === 0 && bonusCharge === 0 && bonusInstallment <= 0) {
    totalScore = Math.min(70, totalScore);
  }

  // TRAVA ESTRUTURAL ABSOLUTA:
  // Se houver qualquer divergência de centavos (diffCents > 0), o score NUNCA pode ser exact_match (teto 79)
  if (diffCents > 0) {
    totalScore = Math.min(79, totalScore);
  }

  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/**
 * Indica se há sinal semântico positivo além da mera coincidência numérica de valor e data (G7).
 * Utilizado para distinguir microajustes fortes (<= R$ 0,05 opt-out) de matches fracos (opt-in).
 */
export function hasStrongMatchSemanticSignal(
  statement: StatementTransaction,
  existing: ExistingExpenseForReconciliation,
  options?: MatchScoreOptions,
): boolean {
  const tokensStmt = tokenize(statement.cleanDescription);
  const tokensExist = tokenize(existing.description);
  if (jaccardTokens(tokensStmt, tokensExist) > 0) {
    return true;
  }

  if (
    options?.predictedCategoryId &&
    existing.categoryId &&
    options.predictedCategoryId === existing.categoryId
  ) {
    return true;
  }

  if (
    statement.inferredChargeKind &&
    statement.inferredChargeKind !== "regular" &&
    existing.chargeKind &&
    existing.chargeKind !== "regular" &&
    statement.inferredChargeKind === existing.chargeKind
  ) {
    return true;
  }

  if (
    statement.installment &&
    statement.installment.total > 1 &&
    existing.installmentNumber === statement.installment.current &&
    existing.installmentsTotal === statement.installment.total
  ) {
    return true;
  }

  return false;
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

export interface ReconcileStatementParams {
  statementTransactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  adjacentExpenses?: ExistingExpenseForReconciliation[];
  existingRefunds?: ExistingRefundForReconciliation[];
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
  reservedChargesCategoryId?: string | null;
  cardScope?: "personal" | "business" | "mixed";
  /** True quando `qualityGate.effectiveTargetCents !== null && qualityGate.diffCents <= 5` (G8). */
  officialTotalValidated?: boolean;
  /** True em lotes de múltiplas imagens onde repetições podem ser overlap visual (G8). */
  isMultiImageOverlapRisk?: boolean;
}

interface IndexedExpenseCandidate {
  txIdx: number;
  existing: ExistingExpenseForReconciliation;
  score: number;
  isHashMatch: boolean;
  diffCents: number;
  isStrongSemantic: boolean;
}

interface IndexedRefundCandidate {
  txIdx: number;
  refund: ExistingRefundForReconciliation;
  score: number;
  isHashMatch: boolean;
  diffDays: number;
}

const AMOUNT_TOLERANCE_CENTS = 5;

function buildExpenseLookupIndexes(list: readonly ExistingExpenseForReconciliation[]): {
  byHash: Map<string, ExistingExpenseForReconciliation>;
  byAmountCents: Map<number, ExistingExpenseForReconciliation[]>;
} {
  const byHash = new Map<string, ExistingExpenseForReconciliation>();
  const byAmountCents = new Map<number, ExistingExpenseForReconciliation[]>();

  for (const exp of list) {
    if (exp.statementHash) {
      byHash.set(exp.statementHash, exp);
    }
    const bucket = byAmountCents.get(exp.valueCents);
    if (bucket) {
      bucket.push(exp);
    } else {
      byAmountCents.set(exp.valueCents, [exp]);
    }
  }

  return { byHash, byAmountCents };
}

function collectCandidateExpensesForTx(
  tx: StatementTransaction,
  indexes: ReturnType<typeof buildExpenseLookupIndexes>,
): ExistingExpenseForReconciliation[] {
  const result: ExistingExpenseForReconciliation[] = [];
  const seenIds = new Set<string>();

  if (tx.statementHash) {
    const hashHit = indexes.byHash.get(tx.statementHash);
    if (hashHit) {
      seenIds.add(hashHit.id);
      result.push(hashHit);
    }
  }

  for (let delta = -AMOUNT_TOLERANCE_CENTS; delta <= AMOUNT_TOLERANCE_CENTS; delta++) {
    const bucket = indexes.byAmountCents.get(tx.amountCents + delta);
    if (!bucket) continue;
    for (const candidate of bucket) {
      if (!seenIds.has(candidate.id)) {
        seenIds.add(candidate.id);
        result.push(candidate);
      }
    }
  }

  return result;
}

function isChargeKindNonRegular(kind: StatementTransaction["inferredChargeKind"]): boolean {
  return (
    kind === "tax" ||
    kind === "interest" ||
    kind === "fine" ||
    kind === "bank_fee"
  );
}

/**
 * Processa a reconciliação completa de uma lista de transações de extrato
 * contra despesas e estornos já existentes na competência (Matching Global Ótimo 1:1 — G7, G8, G10, D12).
 */
export function reconcileStatementTransactions(
  params: ReconcileStatementParams,
): ReconciliationResult {
  const {
    statementTransactions,
    existingExpenses,
    adjacentExpenses = [],
    existingRefunds = [],
    history,
    defaultCategoryId,
    reservedChargesCategoryId,
    cardScope,
    officialTotalValidated = false,
    isMultiImageOverlapRisk = false,
  } = params;

  const predictedCategoryIds: string[] = new Array(statementTransactions.length);
  const isInternalDuplicates: boolean[] = new Array(statementTransactions.length);
  const occurrencePositionInSignature: number[] = new Array(statementTransactions.length);
  const seenSignatures = new Map<string, number>();

  for (let i = 0; i < statementTransactions.length; i++) {
    const tx = statementTransactions[i]!;
    const signature = `${tx.date}|${tx.amountCents}|${tx.cleanDescription.toLowerCase()}`;
    const prevCount = seenSignatures.get(signature) ?? 0;
    seenSignatures.set(signature, prevCount + 1);
    occurrencePositionInSignature[i] = prevCount;
    isInternalDuplicates[i] = prevCount > 0;

    // D12: Encargos detectados vinculam-se diretamente à categoria reservada "Tarifas e Encargos"
    if (reservedChargesCategoryId && isChargeKindNonRegular(tx.inferredChargeKind)) {
      predictedCategoryIds[i] = reservedChargesCategoryId;
    } else {
      predictedCategoryIds[i] = predictCategoryForDescription(
        tx.cleanDescription,
        history,
        defaultCategoryId,
      );
    }
  }

  // 1. Matching Global Ótimo 1:1 contra existingExpenses (score DESC — G7)
  const matchedExpenseByTxIdx = new Map<number, IndexedExpenseCandidate>();
  const matchedExistingIds = new Set<string>();

  if (existingExpenses.length > 0 && statementTransactions.length > 0) {
    const expenseIndexes = buildExpenseLookupIndexes(existingExpenses);
    const allCandidates: IndexedExpenseCandidate[] = [];

    for (let txIdx = 0; txIdx < statementTransactions.length; txIdx++) {
      const tx = statementTransactions[txIdx]!;
      if (tx.isPayment || tx.isRefund) continue;

      const predictedCategoryId = predictedCategoryIds[txIdx]!;
      const nearby = collectCandidateExpensesForTx(tx, expenseIndexes);

      for (const existing of nearby) {
        const isHashMatch = Boolean(
          existing.statementHash && existing.statementHash === tx.statementHash,
        );
        const diffCents = Math.abs(tx.amountCents - existing.valueCents);
        const score = isHashMatch
          ? 100
          : calculateMatchScore(tx, existing, { predictedCategoryId, cardScope });

        if (score >= 40) {
          allCandidates.push({
            txIdx,
            existing,
            score,
            isHashMatch,
            diffCents,
            isStrongSemantic:
              isHashMatch ||
              hasStrongMatchSemanticSignal(tx, existing, { predictedCategoryId, cardScope }),
          });
        }
      }
    }

    allCandidates.sort((a, b) => {
      if (a.isHashMatch !== b.isHashMatch) return a.isHashMatch ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.diffCents !== b.diffCents) return a.diffCents - b.diffCents;
      return a.txIdx - b.txIdx;
    });

    for (const cand of allCandidates) {
      if (matchedExpenseByTxIdx.has(cand.txIdx) || matchedExistingIds.has(cand.existing.id)) {
        continue;
      }
      matchedExpenseByTxIdx.set(cand.txIdx, cand);
      matchedExistingIds.add(cand.existing.id);
    }
  }

  // 2. Conciliação Global Ótima 1:1 de Estornos contra card_payments existentes (G10)
  const matchedRefundByTxIdx = new Map<number, IndexedRefundCandidate>();
  const matchedRefundIds = new Set<string>();

  if (existingRefunds.length > 0 && statementTransactions.length > 0) {
    const refundCandidates: IndexedRefundCandidate[] = [];

    for (let txIdx = 0; txIdx < statementTransactions.length; txIdx++) {
      const tx = statementTransactions[txIdx]!;
      if (tx.isPayment || !tx.isRefund) continue;

      const txDateStr = tx.originalDate || tx.date;
      const txTime = new Date(`${txDateStr}T00:00:00`).getTime();

      for (const refund of existingRefunds) {
        const isHashMatch = Boolean(
          refund.statementHash && refund.statementHash === tx.statementHash,
        );

        if (isHashMatch) {
          refundCandidates.push({ txIdx, refund, score: 100, isHashMatch: true, diffDays: 0 });
          continue;
        }

        if (refund.amountCents !== tx.amountCents) continue;

        const refTime = new Date(`${refund.date}T00:00:00`).getTime();
        const diffDays =
          Number.isFinite(txTime) && Number.isFinite(refTime)
            ? Math.abs(txTime - refTime) / 86_400_000
            : Number.POSITIVE_INFINITY;

        if (diffDays <= 3) {
          refundCandidates.push({
            txIdx,
            refund,
            score: Math.round(90 - diffDays * 3),
            isHashMatch: false,
            diffDays,
          });
        }
      }
    }

    refundCandidates.sort((a, b) => {
      if (a.isHashMatch !== b.isHashMatch) return a.isHashMatch ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
      return a.txIdx - b.txIdx;
    });

    for (const cand of refundCandidates) {
      if (matchedRefundByTxIdx.has(cand.txIdx) || matchedRefundIds.has(cand.refund.id)) {
        continue;
      }
      matchedRefundByTxIdx.set(cand.txIdx, cand);
      matchedRefundIds.add(cand.refund.id);
    }
  }

  // 3. Matching Global Ótimo 1:1 contra competências vizinhas (M-1 / M+1) para itens sem match local
  const matchedAdjacentByTxIdx = new Map<number, IndexedExpenseCandidate>();
  const matchedAdjacentIds = new Set<string>();

  if (adjacentExpenses.length > 0 && statementTransactions.length > 0) {
    const adjacentWithComp = adjacentExpenses.filter((a) => Boolean(a.billCompetence));
    if (adjacentWithComp.length > 0) {
      const adjIndexes = buildExpenseLookupIndexes(adjacentWithComp);
      const adjCandidates: IndexedExpenseCandidate[] = [];

      for (let txIdx = 0; txIdx < statementTransactions.length; txIdx++) {
        const tx = statementTransactions[txIdx]!;
        if (
          tx.isPayment ||
          tx.isRefund ||
          matchedExpenseByTxIdx.has(txIdx) ||
          isInternalDuplicates[txIdx]
        ) {
          continue;
        }

        const predictedCategoryId = predictedCategoryIds[txIdx]!;
        const nearby = collectCandidateExpensesForTx(tx, adjIndexes);

        for (const adj of nearby) {
          if (adj.valueCents !== tx.amountCents) continue;
          const isHashMatch = Boolean(adj.statementHash && adj.statementHash === tx.statementHash);
          const score = isHashMatch
            ? 100
            : calculateMatchScore(tx, adj, { predictedCategoryId, cardScope });

          if (score >= 75) {
            adjCandidates.push({
              txIdx,
              existing: adj,
              score,
              isHashMatch,
              diffCents: 0,
              isStrongSemantic: true,
            });
          }
        }
      }

      adjCandidates.sort((a, b) => {
        if (a.isHashMatch !== b.isHashMatch) return a.isHashMatch ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.txIdx - b.txIdx;
      });

      for (const cand of adjCandidates) {
        if (
          matchedAdjacentByTxIdx.has(cand.txIdx) ||
          matchedAdjacentIds.has(cand.existing.id)
        ) {
          continue;
        }
        matchedAdjacentByTxIdx.set(cand.txIdx, cand);
        matchedAdjacentIds.add(cand.existing.id);
      }
    }
  }

  // 4. Montagem final dos ReconciliationItem[]
  const canConfirmRepeatedSameDay = officialTotalValidated && !isMultiImageOverlapRisk;

  const items: ReconciliationItem[] = statementTransactions.map((tx, txIdx) => {
    const isInternalDuplicate = isInternalDuplicates[txIdx] ?? false;
    const predictedCatId = predictedCategoryIds[txIdx] ?? defaultCategoryId;
    const signature = `${tx.date}|${tx.amountCents}|${tx.cleanDescription.toLowerCase()}`;
    const totalCountForSig = seenSignatures.get(signature) ?? 1;
    const confirmedRepeated = Boolean(
      canConfirmRepeatedSameDay && !tx.isPayment && totalCountForSig > 1,
    );

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

    // Estorno conciliado contra card_payments existente (G10)
    const refundMatch = matchedRefundByTxIdx.get(txIdx);
    if (tx.isRefund && refundMatch) {
      return {
        transaction: tx,
        nature: tx.nature || "refund",
        status: "exact_match",
        score: refundMatch.score,
        matchedRefundId: refundMatch.refund.id,
        matchedExpenseDescription: refundMatch.refund.note ?? "Estorno registrado",
        matchedExpenseDate: refundMatch.refund.date,
        matchedExpenseValueCents: refundMatch.refund.amountCents,
        suggestedCategoryId: predictedCatId,
        selectedCategoryId: predictedCatId,
        selected: false,
        suggestedAction: "link_existing",
        hasStrongSemanticSignal: true,
        isInternalDuplicate,
        duplicateReason: isInternalDuplicate
          ? "Estorno duplicado no arquivo e já registrado no app"
          : undefined,
      };
    }

    // Match contra despesa existente na competência ativa
    const expMatch = matchedExpenseByTxIdx.get(txIdx);
    if (expMatch) {
      const { existing: bestMatch, score: bestScore, diffCents, isStrongSemantic } = expMatch;
      if (bestScore >= 75 && bestMatch.valueCents === tx.amountCents) {
        return {
          transaction: tx,
          nature: tx.nature || "purchase",
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
          hasStrongSemanticSignal: isStrongSemantic,
          isInternalDuplicate,
          duplicateReason: isInternalDuplicate
            ? "Lançamento duplicado no arquivo e já cadastrado no app"
            : undefined,
        };
      }

      return {
        transaction: tx,
        nature: tx.nature || "purchase",
        status: "probable_match",
        score: bestScore,
        matchedExpenseId: bestMatch.id,
        matchedExpenseDescription: bestMatch.description,
        matchedExpenseDate: bestMatch.date,
        matchedExpenseValueCents: bestMatch.valueCents,
        suggestedCategoryId: bestMatch.categoryId,
        selectedCategoryId: bestMatch.categoryId,
        selected: false,
        suggestedAction: diffCents > 0 ? "link_and_adjust_amount" : "link_existing",
        hasStrongSemanticSignal: isStrongSemantic,
        isInternalDuplicate,
        duplicateReason: isInternalDuplicate ? "Lançamento duplicado no arquivo" : undefined,
      };
    }

    // Correspondência em competência vizinha (M-1 / M+1)
    let crossCompetenceMatch: CrossCompetenceMatch | undefined;
    const adjMatch = matchedAdjacentByTxIdx.get(txIdx);
    if (adjMatch && adjMatch.existing.billCompetence) {
      crossCompetenceMatch = {
        expenseId: adjMatch.existing.id,
        expenseDescription: adjMatch.existing.description,
        expenseDate: adjMatch.existing.date,
        expenseValueCents: adjMatch.existing.valueCents,
        currentBillCompetence: adjMatch.existing.billCompetence,
        score: adjMatch.score,
        statementHash: tx.statementHash,
      };
    }

    const suggestedAction =
      tx.installment && tx.installment.total > 1
        ? tx.installment.current === 1
          ? "import_and_project_series"
          : "import_single"
        : undefined;

    // G8: Se compra repetida confirmada pela soma oficial, fica selecionada (opt-out)
    // D2: Estorno inédito também entra pré-selecionado (`selected: true`)
    const blockedAsUnverifiedDuplicate = isInternalDuplicate && !confirmedRepeated;
    const shouldSelect = !blockedAsUnverifiedDuplicate && !crossCompetenceMatch;

    return {
      transaction: tx,
      nature: tx.nature || (tx.isRefund ? "refund" : "purchase"),
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: predictedCatId,
      selectedCategoryId: predictedCatId,
      selected: shouldSelect,
      suggestedAction,
      crossCompetenceMatch,
      isInternalDuplicate,
      repeatedSameDayConfirmed: confirmedRepeated || undefined,
      duplicateReason: confirmedRepeated
        ? `${totalCountForSig}x no dia (validado pelo total oficial)`
        : isInternalDuplicate
          ? "Lançamento duplicado no mesmo arquivo"
          : undefined,
    };
  });

  // Despesas cadastradas no app que NÃO tiveram nenhuma correspondência na fatura
  const unmatchedExistingExpenses = existingExpenses.filter((e) => !matchedExistingIds.has(e.id));
  const appDuplicates = findAppDuplicateCandidates({
    items,
    existingExpenses,
    unmatchedExistingExpenses,
  });

  return {
    items,
    unmatchedExistingExpenses,
    appDuplicates,
  };
}
