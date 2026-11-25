import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  detectInstallmentSeriesState,
  evaluateStatementExtractionQuality,
  generateStatementHash,
  type ExistingExpenseForReconciliation,
  type ReconciliationItem,
  type StatementQualityGateResult,
  type StatementTransaction,
} from "@/domain/reconciliation";
import type { ReconcileCanonicalTab, StatementItemPatch } from "./statement-import-types";

export {
  computeBillProtectionState,
  computeBusinessDeductibilityForPatch,
  findMatchingCardForMismatch,
  isDateNearCardClosingDay,
  mapAdjacentExpensesForReconciliation,
  mapAllCardExpensesForReconciliation,
  mapCardRefundsForReconciliation,
  mapExpensesForReconciliation,
  resolveReservedChargesCategoryId,
  runStatementReconciliation,
  shiftCompetenceMonth,
} from "./statement-reconcile-mappers";

export function createManualReconciliationItem(params: {
  cardId: string;
  competenceMonth: string;
  item: StatementItemPatch;
  index: number;
}): ReconciliationItem {
  const { cardId, competenceMonth, item, index } = params;
  const isRefund = Boolean(item.isRefund);
  const chargeKind = isRefund ? "regular" : inferChargeKindFromDescription(item.cleanDescription);
  const newHash = generateStatementHash({
    cardId,
    competenceMonth,
    date: item.date,
    amountCents: item.amountCents,
    cleanDescription: item.cleanDescription,
    occurrenceIndex: 0,
  });

  return {
    transaction: {
      id: `stmt-manual-${Date.now()}-${index}`,
      index,
      occurrenceIndex: 0,
      date: item.date,
      rawDescription: item.cleanDescription,
      cleanDescription: item.cleanDescription,
      merchantCleanRaw: item.cleanDescription,
      amountCents: item.amountCents,
      isRefund,
      isPayment: false,
      installment: item.installment,
      statementHash: newHash,
      inferredChargeKind: chargeKind,
      nature: isRefund ? "refund" : chargeKind !== "regular" ? "fee_or_tax" : "purchase",
    },
    nature: isRefund ? "refund" : chargeKind !== "regular" ? "fee_or_tax" : "purchase",
    status: "unmatched_new",
    score: 0,
    suggestedCategoryId: item.selectedCategoryId,
    selectedCategoryId: item.selectedCategoryId,
    isTaxDeductible: item.isTaxDeductible,
    selected: true,
    ignoredByDefault: false,
  };
}

export function applyEditedReconciliationItem(params: {
  cardId: string;
  competenceMonth: string;
  current: ReconciliationItem;
  updated: StatementItemPatch;
}): ReconciliationItem {
  const { cardId, competenceMonth, current, updated } = params;
  const nextIsRefund = updated.isRefund ?? current.transaction.isRefund;
  const chargeKind = nextIsRefund
    ? "regular"
    : inferChargeKindFromDescription(updated.cleanDescription);
  const newHash = generateStatementHash({
    cardId,
    competenceMonth,
    date: updated.date,
    amountCents: updated.amountCents,
    cleanDescription: updated.cleanDescription,
    occurrenceIndex: current.transaction.occurrenceIndex,
  });

  return {
    ...current,
    selected: true,
    ignoredByDefault: false,
    nature: nextIsRefund ? "refund" : chargeKind !== "regular" ? "fee_or_tax" : "purchase",
    isTaxDeductible: updated.isTaxDeductible ?? current.isTaxDeductible,
    selectedCategoryId: updated.selectedCategoryId,
    transaction: {
      ...current.transaction,
      date: updated.date,
      cleanDescription: updated.cleanDescription,
      rawDescription: updated.cleanDescription,
      merchantCleanRaw: updated.cleanDescription,
      amountCents: updated.amountCents,
      isRefund: nextIsRefund,
      isPayment: false,
      installment: updated.installment,
      statementHash: newHash,
      inferredChargeKind: chargeKind,
      nature: nextIsRefund ? "refund" : chargeKind !== "regular" ? "fee_or_tax" : "purchase",
    },
  };
}

export function restoreIgnoredPaymentItem(
  item: ReconciliationItem,
  targetMode: "purchase" | "refund",
): ReconciliationItem {
  const isRefund = targetMode === "refund";
  return {
    ...item,
    ignoredByDefault: false,
    selected: true,
    nature: isRefund ? "refund" : "purchase",
    duplicateReason: undefined,
    transaction: {
      ...item.transaction,
      isPayment: false,
      isRefund,
      nature: isRefund ? "refund" : "purchase",
    },
  };
}

/** Recalcula `occurrenceIndex`, `statementHash`, `seriesAnalysis` e `qualityGate` após edição/D18. */
export function recomputeReconciliationItemsIntegrity(params: {
  items: readonly ReconciliationItem[];
  cardId: string;
  competenceMonth: string;
  cardScope?: "personal" | "business" | "mixed";
  allCardExpenses: ExistingExpenseForReconciliation[];
  officialTotalCents: number | null;
}): { items: ReconciliationItem[]; qualityGate: StatementQualityGateResult } {
  const { items, cardId, competenceMonth, cardScope, allCardExpenses, officialTotalCents } =
    params;
  const occurrenceCounts = new Map<string, number>();

  const rebuilt = items.map((item, idx) => {
    const tx = item.transaction;
    const sigKey = `${tx.date}|${tx.amountCents}|${tx.cleanDescription.trim().toLowerCase()}`;
    const occurrenceIndex = occurrenceCounts.get(sigKey) ?? 0;
    occurrenceCounts.set(sigKey, occurrenceIndex + 1);

    const statementHash = generateStatementHash({
      cardId,
      competenceMonth,
      date: tx.originalDate || tx.date,
      amountCents: tx.amountCents,
      cleanDescription: tx.cleanDescription,
      occurrenceIndex,
    });

    const nextTx: StatementTransaction = { ...tx, index: idx, occurrenceIndex, statementHash };
    const inst = nextTx.installment;
    const seriesAnalysis =
      inst && inst.total > 1
        ? detectInstallmentSeriesState({
            transaction: nextTx,
            competenceMonth,
            existingExpenses: allCardExpenses,
            cardScope,
          })
        : null;

    return {
      ...item,
      transaction: nextTx,
      seriesAnalysis,
      projectSeries:
        seriesAnalysis !== null
          ? (item.projectSeries ??
            (seriesAnalysis.state !== "state_4_already_projected" &&
              seriesAnalysis.missingFutureInstallments.length > 0))
          : false,
    };
  });

  const qualityGate = evaluateStatementExtractionQuality({
    transactions: rebuilt.map((it) => it.transaction),
    officialTotalCents,
  });

  return { items: rebuilt, qualityGate };
}

export function computeCanonicalTabCounts(
  items: readonly ReconciliationItem[],
  appDuplicateCount: number,
  unmatchedAppCount: number,
): { importCount: number; attentionCount: number; matchedCount: number; appOnlyCount: number } {
  let importCount = 0;
  let attentionCount = appDuplicateCount;
  let matchedCount = 0;

  for (const it of items) {
    if (it.ignoredByDefault || it.status === "exact_match") matchedCount += 1;
    else if (
      it.transaction.isRefund ||
      it.status === "probable_match" ||
      Boolean(it.crossCompetenceMatch) ||
      Boolean(it.isInternalDuplicate)
    ) {
      attentionCount += 1;
    } else {
      importCount += 1;
    }
  }

  return { importCount, attentionCount, matchedCount, appOnlyCount: unmatchedAppCount };
}

export function resolveInitialCanonicalTab(counts: {
  importCount: number;
  attentionCount: number;
}): ReconcileCanonicalTab {
  return counts.importCount === 0 && counts.attentionCount > 0 ? "attention" : "import";
}

export function isItemInCanonicalTab(
  item: ReconciliationItem,
  tab: ReconcileCanonicalTab,
): boolean {
  if (tab === "matched") return Boolean(item.ignoredByDefault) || item.status === "exact_match";
  if (tab === "attention") {
    return (
      !item.ignoredByDefault &&
      item.status !== "exact_match" &&
      (item.transaction.isRefund ||
        item.status === "probable_match" ||
        Boolean(item.crossCompetenceMatch) ||
        Boolean(item.isInternalDuplicate))
    );
  }
  if (tab === "import") {
    return (
      !item.ignoredByDefault &&
      item.status !== "exact_match" &&
      !item.transaction.isRefund &&
      item.status !== "probable_match" &&
      !item.crossCompetenceMatch &&
      !item.isInternalDuplicate
    );
  }
  return false;
}
