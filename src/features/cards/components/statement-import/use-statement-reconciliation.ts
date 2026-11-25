import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildReconciliationPlan,
  type AppDuplicateCandidate,
  type DetectedStatementMetadata,
  type ExistingExpenseForReconciliation,
  type PendingLinkAdjustment,
  type ReconciliationItem,
  type StatementQualityGateResult,
} from "@/domain/reconciliation";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { CardBillRollover, CardPayment, Category, CreditCard, Expense } from "@/types";
import type {
  BillProtectionState,
  ReconcileCanonicalTab,
  ReconcileSortMode,
  StatementAiStatusNotice,
  StatementExtractionOrigin,
  StatementItemPatch,
} from "./statement-import-types";
import {
  applyEditedItemToList,
  prependManualItemToList,
  resolveSanitizedLearningRawName,
  restoreIgnoredPaymentInList,
  setAllScopeInList,
  setTabItemsSelection,
  toggleItemRefundInList,
  toggleItemScopeInList,
  toggleSingleItemSelection,
} from "./statement-item-handlers";
import {
  computeBillProtectionState,
  computeCanonicalTabCounts,
  findMatchingCardForMismatch,
  recomputeReconciliationItemsIntegrity,
  resolveInitialCanonicalTab,
  resolveReservedChargesCategoryId,
} from "./statement-reconcile-utils";

export interface PendingAppMoveEntry {
  expenseId: string;
  targetCompetence: string;
  description: string;
  fromCompetenceMonth: string;
  statementHash?: string;
}

export interface UseStatementReconciliationParams {
  activeCard: CreditCard;
  availableCards: readonly CreditCard[];
  activeCompetenceMonth: string;
  allExpenses: readonly Expense[];
  allPayments: readonly CardPayment[];
  allRollovers: readonly CardBillRollover[];
  allCardExpensesForSeries: ExistingExpenseForReconciliation[];
  categories: readonly Category[];
  defaultCategoryId: string;
}

export function useStatementReconciliation(params: UseStatementReconciliationParams) {
  const { activeCard, availableCards, activeCompetenceMonth, allExpenses, allPayments, allRollovers, allCardExpensesForSeries, categories, defaultCategoryId } = params;

  const [error, setError] = useState<string | null>(null);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [unmatchedAppExpenses, setUnmatchedAppExpenses] = useState<ExistingExpenseForReconciliation[]>([]);
  const [appDuplicates, setAppDuplicates] = useState<AppDuplicateCandidate[]>([]);
  const [usedAiStructurer, setUsedAiStructurer] = useState(false);
  const [extractionOrigin, setExtractionOrigin] = useState<StatementExtractionOrigin | null>(null);
  const [qualityGate, setQualityGate] = useState<StatementQualityGateResult | null>(null);
  const [aiStatusNotice, setAiStatusNotice] = useState<StatementAiStatusNotice | null>(null);
  const [printedTotalCents, setPrintedTotalCents] = useState<number | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<DetectedStatementMetadata | null>(null);

  const [pendingLinkAdjustments, setPendingLinkAdjustments] = useState<Map<string, PendingLinkAdjustment>>(new Map());
  const [pendingAppMoves, setPendingAppMoves] = useState<Map<string, PendingAppMoveEntry>>(new Map());
  const [suppressedMicroAdjustmentExpenseIds, setSuppressedMicroAdjustmentExpenseIds] = useState<Set<string>>(new Set());
  const [approvedCompetenceMoveTxIds, setApprovedCompetenceMoveTxIds] = useState<Set<string>>(new Set());
  const [queuedDeleteExpenseIds, setQueuedDeleteExpenseIds] = useState<Set<string>>(new Set());
  const [cardMismatchConfirmed, setCardMismatchConfirmed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<ReconcileSortMode>("statement");
  const [activeCanonicalTab, setActiveCanonicalTab] = useState<ReconcileCanonicalTab>("import");
  const [hasManualModifications, setHasManualModifications] = useState(false);

  const reconciledItemsRef = useRef(reconciledItems);
  const printedTotalCentsRef = useRef(printedTotalCents);
  const allCardExpensesRef = useRef(allCardExpensesForSeries);

  const billProtection = useMemo<BillProtectionState>(
    () => computeBillProtectionState({ competenceMonth: activeCompetenceMonth, expenses: allExpenses, payments: allPayments, rollovers: allRollovers }),
    [activeCompetenceMonth, allExpenses, allPayments, allRollovers],
  );
  const billProtectionRef = useRef(billProtection);

  useEffect(() => {
    reconciledItemsRef.current = reconciledItems;
    printedTotalCentsRef.current = printedTotalCents;
    allCardExpensesRef.current = allCardExpensesForSeries;
    billProtectionRef.current = billProtection;
  }, [reconciledItems, printedTotalCents, allCardExpensesForSeries, billProtection]);
  const resetStagingState = useCallback(() => {
    setPendingLinkAdjustments(new Map());
    setPendingAppMoves(new Map());
    setSuppressedMicroAdjustmentExpenseIds(new Set());
    setApprovedCompetenceMoveTxIds(new Set());
    setQueuedDeleteExpenseIds(new Set());
    setCardMismatchConfirmed(false);
    setHasManualModifications(false);
  }, []);
  const applyIntegrityUpdate = useCallback((nextItems: ReconciliationItem[]) => {
    const rebuilt = recomputeReconciliationItemsIntegrity({ items: nextItems, cardId: activeCard.id, competenceMonth: activeCompetenceMonth, cardScope: activeCard.scope, allCardExpenses: allCardExpensesRef.current, officialTotalCents: printedTotalCentsRef.current });
    reconciledItemsRef.current = rebuilt.items;
    setReconciledItems(rebuilt.items);
    setQualityGate(rebuilt.qualityGate);
  }, [activeCard.id, activeCard.scope, activeCompetenceMonth]);
  const loadReconciliationSnapshot = useCallback((snapshot: { items: ReconciliationItem[]; unmatchedExistingExpenses: ExistingExpenseForReconciliation[]; appDuplicates: AppDuplicateCandidate[] }) => {
    resetStagingState();
    reconciledItemsRef.current = snapshot.items;
    setReconciledItems(snapshot.items);
    setUnmatchedAppExpenses(snapshot.unmatchedExistingExpenses);
    setAppDuplicates(snapshot.appDuplicates);
    setActiveCanonicalTab(resolveInitialCanonicalTab(computeCanonicalTabCounts(snapshot.items, snapshot.appDuplicates.length, snapshot.unmatchedExistingExpenses.length)));
  }, [resetStagingState]);
  const handleToggleItem = useCallback((id: string) => { setHasManualModifications(true); setReconciledItems((prev) => toggleSingleItemSelection(prev, id)); }, []);
  const handleToggleAll = useCallback((selected: boolean) => { setHasManualModifications(true); setReconciledItems((prev) => prev.map((it) => ({ ...it, selected }))); }, []);
  const handleToggleTabItems = useCallback((itemIds: readonly string[], selected: boolean) => { setHasManualModifications(true); setReconciledItems((prev) => setTabItemsSelection(prev, itemIds, selected)); }, []);
  const handleChangeCategory = useCallback((id: string, categoryId: string) => {
    setHasManualModifications(true);
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, selectedCategoryId: categoryId } : it)));
    const targetItem = reconciledItemsRef.current.find((it) => it.transaction.id === id);
    if (targetItem && categoryId) autoLearnExpenseCategory(targetItem.transaction.cleanDescription, categoryId, undefined, resolveSanitizedLearningRawName(targetItem.transaction, targetItem.transaction.cleanDescription));
  }, []);
  const handleApplyCategoryBatch = useCallback((ids: readonly string[], categoryId: string) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    setHasManualModifications(true);
    setReconciledItems((prev) => prev.map((it) => (idSet.has(it.transaction.id) ? { ...it, selectedCategoryId: categoryId } : it)));
    const first = reconciledItemsRef.current.find((it) => idSet.has(it.transaction.id));
    if (first && categoryId) autoLearnExpenseCategory(first.transaction.cleanDescription, categoryId, undefined, resolveSanitizedLearningRawName(first.transaction, first.transaction.cleanDescription));
    triggerSensory("selection");
    pushToast({ title: "Categoria propagada", description: `Categoria aplicada a ${ids.length} ${ids.length === 1 ? "compra" : "compras"}.`, variant: "default" });
  }, []);
  const handleEditItem = useCallback((id: string, updated: StatementItemPatch) => {
    setHasManualModifications(true);
    const existing = reconciledItemsRef.current.find((it) => it.transaction.id === id);
    if (updated.selectedCategoryId) autoLearnExpenseCategory(updated.cleanDescription, updated.selectedCategoryId, undefined, resolveSanitizedLearningRawName(existing?.transaction, updated.cleanDescription));
    applyIntegrityUpdate(applyEditedItemToList({ items: reconciledItemsRef.current, cardId: activeCard.id, competenceMonth: activeCompetenceMonth, id, updated }));
  }, [activeCard.id, activeCompetenceMonth, applyIntegrityUpdate]);
  const handleRemoveItem = useCallback((id: string) => { setHasManualModifications(true); applyIntegrityUpdate(reconciledItemsRef.current.filter((it) => it.transaction.id !== id)); }, [applyIntegrityUpdate]);
  const handleAddManualItem = useCallback((item: StatementItemPatch) => { setHasManualModifications(true); applyIntegrityUpdate(prependManualItemToList({ items: reconciledItemsRef.current, cardId: activeCard.id, competenceMonth: activeCompetenceMonth, item })); }, [activeCard.id, activeCompetenceMonth, applyIntegrityUpdate]);
  const handleToggleItemRefund = useCallback((id: string) => { setHasManualModifications(true); applyIntegrityUpdate(toggleItemRefundInList(reconciledItemsRef.current, id)); }, [applyIntegrityUpdate]);
  const handleRestoreIgnoredPayment = useCallback((id: string, targetMode: "purchase" | "refund" = "purchase") => { setHasManualModifications(true); applyIntegrityUpdate(restoreIgnoredPaymentInList(reconciledItemsRef.current, id, targetMode)); }, [applyIntegrityUpdate]);
  const handleToggleScope = useCallback((id: string) => { setHasManualModifications(true); setReconciledItems((prev) => toggleItemScopeInList(prev, id, activeCard.scope)); }, [activeCard.scope]);
  const handleSetScopeAll = useCallback((scope: "personal" | "business") => { setHasManualModifications(true); setReconciledItems((prev) => setAllScopeInList(prev, scope)); }, []);
  const handleToggleProjectSeries = useCallback((id: string) => { setHasManualModifications(true); setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, projectSeries: !(it.projectSeries ?? true) } : it))); }, []);

  const handleLinkAndAdjust = useCallback((id: string) => {
    if (billProtectionRef.current.isPaidBill || billProtectionRef.current.isRolledOver) return;
    const target = reconciledItemsRef.current.find((it) => it.transaction.id === id);
    if (!target || !target.matchedExpenseId) return;
    const matchedCents = target.matchedExpenseValueCents ?? target.transaction.amountCents;
    const diffCents = target.transaction.amountCents - matchedCents;
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, selected: false, isLinkedAndAdjusted: true, pendingAdjustmentDifferenceCents: diffCents } : it)));
    setPendingLinkAdjustments((prev) => {
      const next = new Map(prev);
      next.set(id, { expenseId: target.matchedExpenseId!, newValueCents: target.transaction.amountCents, originalValueCents: matchedCents, differenceCents: diffCents, statementHash: target.transaction.statementHash, description: target.transaction.cleanDescription });
      return next;
    });
    triggerSensory("selection");
  }, []);

  const handleUndoLinkAndAdjust = useCallback((id: string) => {
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, isLinkedAndAdjusted: false, pendingAdjustmentDifferenceCents: undefined } : it)));
    setPendingLinkAdjustments((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, []);

  const handleCreateRefund = useCallback((item: ReconciliationItem) => {
    setHasManualModifications(true);
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === item.transaction.id ? { ...it, selected: true, ignoredByDefault: false } : it)));
    triggerSensory("selection");
  }, []);

  const handleQueueDeleteAppExpense = useCallback((expenseId: string) => {
    if (billProtectionRef.current.isPaidBill || billProtectionRef.current.isRolledOver) {
      pushToast({ title: "Alteração bloqueada", description: "Fatura já quitada ou rolada não permite excluir lançamentos existentes.", variant: "destructive" });
      return;
    }
    setQueuedDeleteExpenseIds((prev) => new Set(prev).add(expenseId));
    triggerSensory("selection");
  }, []);

  const handleUndoDeleteAppExpense = useCallback((expenseId: string) => {
    setQueuedDeleteExpenseIds((prev) => { const next = new Set(prev); next.delete(expenseId); return next; });
  }, []);

  const handleApproveCompetenceMove = useCallback((txId: string) => {
    if (billProtectionRef.current.isPaidBill || billProtectionRef.current.isRolledOver) return;
    setApprovedCompetenceMoveTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId); else next.add(txId);
      return next;
    });
    triggerSensory("selection");
  }, []);

  const handleApproveAllCrossCompetenceMoves = useCallback((sourceCompetence?: string) => {
    if (billProtectionRef.current.isPaidBill || billProtectionRef.current.isRolledOver) return;
    const ids = reconciledItemsRef.current.filter((it) => it.crossCompetenceMatch && (!sourceCompetence || it.crossCompetenceMatch.currentBillCompetence === sourceCompetence)).map((it) => it.transaction.id);
    if (ids.length === 0) return;
    setApprovedCompetenceMoveTxIds((prev) => { const next = new Set(prev); for (const id of ids) next.add(id); return next; });
    triggerSensory("selection");
  }, []);

  const handleMoveExpenseToCompetence = useCallback((move: { expenseId: string; targetCompetence: string; statementHash?: string; transactionId?: string }) => {
    if (billProtectionRef.current.isPaidBill || billProtectionRef.current.isRolledOver) return;
    if (move.transactionId) { handleApproveCompetenceMove(move.transactionId); return; }
    setPendingAppMoves((prev) => new Map(prev).set(move.expenseId, { expenseId: move.expenseId, targetCompetence: move.targetCompetence, description: "Despesa do aplicativo", fromCompetenceMonth: activeCompetenceMonth, statementHash: move.statementHash }));
    triggerSensory("selection");
  }, [activeCompetenceMonth, handleApproveCompetenceMove]);

  const handleToggleSuppressMicroAdjustment = useCallback((expenseId: string) => {
    setSuppressedMicroAdjustmentExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(expenseId)) next.delete(expenseId); else next.add(expenseId);
      return next;
    });
  }, []);

  const handleUncheckDuplicates = useCallback(() => {
    setHasManualModifications(true);
    setReconciledItems((prev) => prev.map((it) => (it.isInternalDuplicate || it.status === "exact_match" ? { ...it, selected: false } : it)));
  }, []);

  const matchedCardForMismatch = useMemo(() => findMatchingCardForMismatch({ detectedMeta, cards: availableCards, currentCardId: activeCard.id }), [activeCard.id, availableCards, detectedMeta]);
  const reservedChargesCategoryId = useMemo(() => resolveReservedChargesCategoryId(categories), [categories]);

  const reconciliationPlan = useMemo(() => {
    const basePlan = buildReconciliationPlan({
      cardId: activeCard.id, competenceMonth: activeCompetenceMonth, cardScope: activeCard.scope, items: reconciledItems, fallbackCategoryId: defaultCategoryId,
      reservedChargesCategoryId, pendingLinkAdjustments, suppressedMicroAdjustmentExpenseIds, approvedCompetenceMoveTxIds,
      queuedDeleteExpenseIds: Array.from(queuedDeleteExpenseIds), isRolledOver: billProtection.isRolledOver, isPaidBill: billProtection.isPaidBill, lockedCompetences: billProtection.lockedCompetences,
    });
    if (basePlan.blockedByRollover || basePlan.paidBillLocksRestricted || pendingAppMoves.size === 0) return basePlan;
    const extraMoves = Array.from(pendingAppMoves.values()).filter((m) => !billProtection.lockedCompetences.has(m.targetCompetence)).map((m) => ({ expenseId: m.expenseId, description: m.description, fromCompetenceMonth: m.fromCompetenceMonth, toCompetenceMonth: m.targetCompetence, statementHash: m.statementHash ?? "" }));
    return extraMoves.length === 0 ? basePlan : { ...basePlan, competenceMovesToApply: [...basePlan.competenceMovesToApply, ...extraMoves], totalActionCount: basePlan.totalActionCount + extraMoves.length };
  }, [activeCard.id, activeCard.scope, activeCompetenceMonth, approvedCompetenceMoveTxIds, billProtection, defaultCategoryId, pendingAppMoves, pendingLinkAdjustments, queuedDeleteExpenseIds, reconciledItems, reservedChargesCategoryId, suppressedMicroAdjustmentExpenseIds]);

  const canonicalTabCounts = useMemo(() => computeCanonicalTabCounts(reconciledItems, appDuplicates.length, unmatchedAppExpenses.length), [appDuplicates.length, reconciledItems, unmatchedAppExpenses.length]);
  const initialCanonicalTab = useMemo(() => resolveInitialCanonicalTab(canonicalTabCounts), [canonicalTabCounts]);
  const isDirty = hasManualModifications || queuedDeleteExpenseIds.size > 0 || pendingLinkAdjustments.size > 0 || pendingAppMoves.size > 0 || approvedCompetenceMoveTxIds.size > 0 || suppressedMicroAdjustmentExpenseIds.size > 0;

  return {
    error, setError, reconciledItems, setReconciledItems, reconciledItemsRef, unmatchedAppExpenses, setUnmatchedAppExpenses, appDuplicates, setAppDuplicates,
    usedAiStructurer, setUsedAiStructurer, extractionOrigin, setExtractionOrigin, qualityGate, setQualityGate, aiStatusNotice, setAiStatusNotice,
    printedTotalCents, setPrintedTotalCents, detectedMeta, setDetectedMeta, pendingLinkAdjustments, pendingLinkAdjustmentsCount: pendingLinkAdjustments.size,
    queuedDeleteExpenseIds, approvedCompetenceMoveTxIds, suppressedMicroAdjustmentExpenseIds, cardMismatchConfirmed,
    confirmCardMismatch: useCallback(() => setCardMismatchConfirmed(true), []),
    hasUnconfirmedCardMismatch: Boolean(detectedMeta?.hasCardMismatch) && !cardMismatchConfirmed,
    searchQuery, setSearchQuery, sortMode, setSortMode, activeCanonicalTab, setActiveCanonicalTab, canonicalTabCounts, initialCanonicalTab,
    billProtection, matchedCardForMismatch, reconciliationPlan,
    selectedCount: useMemo(() => reconciledItems.filter((it) => it.selected && !it.transaction.isRefund).length, [reconciledItems]),
    isDirty, hasUnsavedChanges: isDirty, loadReconciliationSnapshot, resetStagingState,
    handleToggleItem, handleToggleAll, handleToggleTabItems, handleChangeCategory, handleApplyCategoryBatch, handleEditItem, handleRemoveItem, handleAddManualItem,
    handleToggleItemRefund, handleRestoreIgnoredPayment, handleToggleScope, handleSetScopeAll, handleToggleProjectSeries, handleLinkAndAdjust, handleUndoLinkAndAdjust, handleCreateRefund,
    handleQueueDeleteAppExpense, handleUndoDeleteAppExpense,
    handleDeleteAppExpense: useCallback((expenseId: string) => handleQueueDeleteAppExpense(expenseId), [handleQueueDeleteAppExpense]),
    handleApproveCompetenceMove, handleApproveAllCrossCompetenceMoves, handleMoveExpenseToCompetence, handleMoveAllCrossCompetenceMatches: handleApproveAllCrossCompetenceMoves,
    handleToggleSuppressMicroAdjustment, handleUncheckDuplicates,
    handleDismissCompetenceMismatch: useCallback(() => setDetectedMeta((prev) => (prev ? { ...prev, hasCompetenceMismatch: false } : null)), []),
  };
}
