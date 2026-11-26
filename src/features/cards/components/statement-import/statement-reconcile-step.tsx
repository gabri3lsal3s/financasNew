import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import { Button, EmptyState, Input, Progress, Select, Tabs, type SelectOption, type TabItem } from "@/components/ui";
import type {
  AppDuplicateCandidate, DetectedStatementMetadata, ExistingExpenseForReconciliation,
  ReconciliationItem, ReconciliationPlan, StatementQualityGateResult,
} from "@/domain/reconciliation";
import { formatCentsAsCurrency } from "@/services/masks";
import type { Category, CreditCard } from "@/types";
import { StatementAppDuplicateRow, StatementAppOnlyRow } from "./statement-app-rows";
import {
  STATEMENT_INCREMENTAL_PAGE_SIZE, type BillProtectionState, type ReconcileCanonicalTab, type ReconcileSortMode,
  type StatementAiStatusNotice, type StatementImportProgress, type StatementItemPatch,
} from "./statement-import-types";
import { StatementItemForm } from "./statement-item-form";
import { StatementPriorityBanner, type CategoryPropagationPromptState } from "./statement-priority-banner";
import { isDateNearCardClosingDay, shiftCompetenceMonth } from "./statement-reconcile-mappers";
import { isItemInCanonicalTab } from "./statement-reconcile-utils";
import { StatementSummaryHeader } from "./statement-summary-header";
import { StatementTransactionRow } from "./statement-transaction-row";

export interface StatementReconcileStepProps {
  items: ReconciliationItem[];
  unmatchedAppExpenses: ExistingExpenseForReconciliation[];
  appDuplicates: AppDuplicateCandidate[];
  competenceMonth: string;
  closingDay?: number | null;
  categories: Category[];
  qualityGate: StatementQualityGateResult | null;
  printedTotalCents: number | null;
  detectedMeta: DetectedStatementMetadata | null;
  aiStatusNotice: StatementAiStatusNotice | null;
  error: string | null;
  billProtection: BillProtectionState;
  plan: ReconciliationPlan;
  activeTab: ReconcileCanonicalTab;
  onTabChange: (tab: ReconcileCanonicalTab) => void;
  canonicalCounts: { importCount: number; attentionCount: number; matchedCount: number; appOnlyCount: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortMode: ReconcileSortMode;
  onSortModeChange: (mode: ReconcileSortMode) => void;
  matchedCardForMismatch: CreditCard | null;
  hasUnconfirmedCardMismatch: boolean;
  onSwitchCard: (cardId: string) => void;
  onConfirmCardMismatch: () => void;
  queuedDeleteExpenseIds: ReadonlySet<string>;
  approvedCompetenceMoveTxIds: ReadonlySet<string>;
  suppressedMicroAdjustmentExpenseIds: ReadonlySet<string>;
  showScopeControls: boolean;
  canAdjustColumns: boolean;
  onOpenMapping?: () => void;
  onChangeFile: () => void;
  onToggleItem: (id: string) => void;
  onToggleTabItems: (itemIds: readonly string[], selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onEditItem: (id: string, updated: StatementItemPatch) => void;
  onRemoveItem: (id: string) => void;
  onAddManualItem: (item: StatementItemPatch) => void;
  onToggleScope: (id: string) => void;
  onSetScopeAll: (scope: "personal" | "business") => void;
  onToggleProjectSeries: (id: string) => void;
  onLinkAndAdjust: (id: string) => void;
  onUndoLinkAndAdjust: (id: string) => void;
  onQueueDeleteAppExpense: (expenseId: string) => void;
  onUndoDeleteAppExpense: (expenseId: string) => void;
  onApproveCompetenceMove: (txId: string) => void;
  onApproveAllCrossCompetenceMoves: () => void;
  onMoveExpenseToCompetence: (move: { expenseId: string; targetCompetence: string; statementHash?: string }) => void;
  onToggleSuppressMicroAdjustment: (expenseId: string) => void;
  onRestoreIgnoredPayment: (id: string, targetMode: "purchase" | "refund") => void;
  onApplyCategoryBatch: (ids: readonly string[], categoryId: string) => void;
  isPending: boolean;
  importProgress: StatementImportProgress | null;
}

const SORT_OPTIONS: SelectOption[] = [
  { value: "statement", label: "Ordem da fatura" },
  { value: "recent", label: "Mais recentes" },
  { value: "amount_desc", label: "Maior valor" },
];

/** Passo 2: Resumo + Slot Único Prioritário + Busca >= 15 + 4 Abas + Lista (windowing > 80). */
export function StatementReconcileStep(props: StatementReconcileStepProps) {
  const {
    items, unmatchedAppExpenses, appDuplicates, competenceMonth, closingDay, categories,
    qualityGate, printedTotalCents, detectedMeta, aiStatusNotice, error, billProtection,
    plan, activeTab, onTabChange, canonicalCounts, searchQuery, onSearchChange, sortMode,
    onSortModeChange, matchedCardForMismatch, hasUnconfirmedCardMismatch, onSwitchCard,
    onConfirmCardMismatch, queuedDeleteExpenseIds, approvedCompetenceMoveTxIds,
    suppressedMicroAdjustmentExpenseIds, showScopeControls, canAdjustColumns, onOpenMapping,
    onChangeFile, onToggleItem, onToggleTabItems, onChangeCategory, onEditItem, onRemoveItem,
    onAddManualItem, onToggleScope, onSetScopeAll, onToggleProjectSeries, onLinkAndAdjust,
    onUndoLinkAndAdjust, onQueueDeleteAppExpense, onUndoDeleteAppExpense,
    onApproveCompetenceMove, onApproveAllCrossCompetenceMoves, onMoveExpenseToCompetence,
    onToggleSuppressMicroAdjustment, onRestoreIgnoredPayment, onApplyCategoryBatch,
    isPending, importProgress,
  } = props;

  const [isAddingManual, setIsAddingManual] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(STATEMENT_INCREMENTAL_PAGE_SIZE);
  const [propagationPrompt, setPropagationPrompt] = useState<CategoryPropagationPromptState | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const itemsRef = useRef(items);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryMapRef = useRef(categoryMap);
  useEffect(() => {
    itemsRef.current = items;
    categoryMapRef.current = categoryMap;
  }, [items, categoryMap]);

  const categoryOptions: SelectOption[] = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories]);
  const isLockedByBillProtection = billProtection.isRolledOver || billProtection.isPaidBill;
  const totalReadCents = useMemo(
    () => items.filter((it) => !it.ignoredByDefault && !it.transaction.isRefund).reduce((sum, it) => sum + it.transaction.amountCents, 0),
    [items],
  );
  const totalAppCents = useMemo(
    () => items.filter((it) => it.status === "exact_match").reduce((sum, it) => sum + it.transaction.amountCents, 0),
    [items],
  );
  const prevCompetence = useMemo(() => shiftCompetenceMonth(competenceMonth, -1), [competenceMonth]);
  const nextCompetence = useMemo(() => shiftCompetenceMonth(competenceMonth, 1), [competenceMonth]);

  const tabItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((it) => {
      if (!isItemInCanonicalTab(it, activeTab)) return false;
      if (!q) return true;
      const desc = it.transaction.cleanDescription.toLowerCase();
      const raw = (it.transaction.rawDescription ?? "").toLowerCase();
      const brl = formatCentsAsCurrency(it.transaction.amountCents).toLowerCase();
      return desc.includes(q) || raw.includes(q) || brl.includes(q);
    });
    if (sortMode === "recent") return [...list].sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
    if (sortMode === "amount_desc") return [...list].sort((a, b) => b.transaction.amountCents - a.transaction.amountCents);
    return list;
  }, [activeTab, items, searchQuery, sortMode]);

  const toggleableTabIds = useMemo(
    () => tabItems.filter((it) => !it.ignoredByDefault && it.status !== "exact_match").map((it) => it.transaction.id),
    [tabItems],
  );
  const allTabSelected = toggleableTabIds.length > 0 && tabItems.filter((it) => !it.ignoredByDefault && it.status !== "exact_match").every((it) => it.selected);
  const crossCompetenceCount = useMemo(
    () => items.filter((it) => it.crossCompetenceMatch && !billProtection.lockedCompetences.has(it.crossCompetenceMatch.currentBillCompetence)).length,
    [billProtection.lockedCompetences, items],
  );
  const visibleItems = useMemo(
    () => (tabItems.length > STATEMENT_INCREMENTAL_PAGE_SIZE ? tabItems.slice(0, visibleCount) : tabItems),
    [tabItems, visibleCount],
  );
  const remainingHiddenCount = Math.max(0, tabItems.length - visibleItems.length);

  useEffect(() => {
    if (remainingHiddenCount === 0 || typeof IntersectionObserver === "undefined") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleCount((prev) => Math.min(tabItems.length, prev + STATEMENT_INCREMENTAL_PAGE_SIZE));
      }
    }, { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [remainingHiddenCount, tabItems.length]);

  const handleTabChange = useCallback((nextTab: string) => {
    setVisibleCount(STATEMENT_INCREMENTAL_PAGE_SIZE);
    onTabChange(nextTab as ReconcileCanonicalTab);
  }, [onTabChange]);

  const handleCategoryChangeWithPropagation = useCallback((id: string, newCatId: string) => {
    onChangeCategory(id, newCatId);
    const current = itemsRef.current;
    const target = current.find((it) => it.transaction.id === id);
    if (!target) return;
    const key = target.transaction.cleanDescription.trim().toLowerCase();
    if (key.length < 3) return;
    const affectedIds = current.filter((it) => it.transaction.id !== id && it.transaction.cleanDescription.trim().toLowerCase() === key && it.selectedCategoryId !== newCatId).map((it) => it.transaction.id);
    if (affectedIds.length > 0) {
      setPropagationPrompt({ merchantName: target.transaction.cleanDescription, categoryId: newCatId, categoryName: categoryMapRef.current.get(newCatId) ?? "Nova categoria", affectedIds });
    } else setPropagationPrompt(null);
  }, [onChangeCategory]);

  const handleStartEdit = useCallback((id: string) => setEditingRowId(id), []);
  const handleCancelEdit = useCallback(() => setEditingRowId(null), []);
  const handleSaveEdit = useCallback((id: string, updated: StatementItemPatch) => {
    onEditItem(id, updated);
    setEditingRowId(null);
  }, [onEditItem]);

  const canonicalTabs: TabItem[] = useMemo(() => [
    { value: "import", label: `A importar (${canonicalCounts.importCount})` },
    { value: "attention", label: `Atenção (${canonicalCounts.attentionCount})` },
    { value: "matched", label: `Conciliados (${canonicalCounts.matchedCount})` },
    ...(canonicalCounts.appOnlyCount > 0 ? [{ value: "app_only", label: `Só no app (${canonicalCounts.appOnlyCount})` }] : []),
  ], [canonicalCounts]);

  return (
    <div className="space-y-3.5">
      <StatementSummaryHeader
        totalReadCents={totalReadCents} totalAppCents={totalAppCents} printedTotalCents={printedTotalCents}
        qualityGate={qualityGate} plan={plan} activeTab={activeTab} canAdjustColumns={canAdjustColumns}
        onOpenMapping={onOpenMapping} onChangeFile={onChangeFile} onReviewAttention={() => handleTabChange("attention")}
      />

      <StatementPriorityBanner
        billProtection={billProtection} error={error} hasUnconfirmedCardMismatch={hasUnconfirmedCardMismatch}
        detectedMeta={detectedMeta} matchedCardForMismatch={matchedCardForMismatch} onSwitchCard={onSwitchCard}
        onConfirmCardMismatch={onConfirmCardMismatch} aiStatusNotice={aiStatusNotice} propagationPrompt={propagationPrompt}
        onApplyPropagation={(p) => { onApplyCategoryBatch(p.affectedIds, p.categoryId); setPropagationPrompt(null); }}
        onDismissPropagation={() => setPropagationPrompt(null)}
      />

      {items.length >= 15 ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px] gap-2.5">
          <Input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar por estabelecimento ou valor..." aria-label="Buscar lançamentos" className="h-10 text-base sm:text-sm" />
          <Select value={sortMode} onValueChange={(v) => onSortModeChange(v as ReconcileSortMode)} options={SORT_OPTIONS} ariaLabel="Ordenar lançamentos" />
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="w-full min-w-0 flex-1">
          <Tabs value={activeTab} onValueChange={handleTabChange} items={canonicalTabs} fullWidth={false} />
        </div>
        {activeTab !== "app_only" ? (
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 shrink-0">
            <Button type="button" variant={isAddingManual ? "secondary" : "outline"} size="sm" disabled={isPending} onClick={() => setIsAddingManual((prev) => !prev)} className="gap-1">
              <Plus className="size-3.5" aria-hidden="true" />
              <span>{isAddingManual ? "Fechar" : "Adicionar"}</span>
            </Button>
            {showScopeControls ? (
              <div className="flex items-center gap-1 border-l border-border/80 pl-1.5">
                <Button type="button" variant="ghost" size="xs" disabled={isPending} onClick={() => onSetScopeAll("business")} className="text-portfolio gap-1">
                  <Briefcase className="size-3" aria-hidden="true" />Tudo Profissional
                </Button>
                <Button type="button" variant="ghost" size="xs" disabled={isPending} onClick={() => onSetScopeAll("personal")}>Tudo Pessoal</Button>
              </div>
            ) : null}
            {toggleableTabIds.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => onToggleTabItems(toggleableTabIds, !allTabSelected)}>
                {allTabSelected ? "Desmarcar aba" : "Marcar aba"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isAddingManual ? (
        <StatementItemForm mode="add" categoryOptions={categoryOptions} defaultDate={`${competenceMonth}-01`} showDeductibility={showScopeControls} onSubmit={(patch) => { onAddManualItem(patch); setIsAddingManual(false); }} onCancel={() => setIsAddingManual(false)} />
      ) : null}

      <div className="rounded-xl border border-border/80 bg-surface divide-y divide-border/80 shadow-xs overflow-hidden">
        {activeTab === "attention" && crossCompetenceCount >= 2 && !isLockedByBillProtection ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-surface-raised text-xs">
            <span className="text-foreground">Detectamos <strong>{crossCompetenceCount}</strong> compras desta fatura cadastradas em mês vizinho.</span>
            <Button type="button" variant="outline" size="xs" sensoryIntent={false} disabled={isPending} onClick={onApproveAllCrossCompetenceMoves} className="shrink-0">Mover todas para esta fatura</Button>
          </div>
        ) : null}

        {activeTab === "app_only" ? (
          unmatchedAppExpenses.length === 0 ? (
            <EmptyState tone="default" title="Nenhum item ausente no extrato" description="Todas as despesas desta competência no aplicativo foram localizadas nesta fatura." />
          ) : (
            unmatchedAppExpenses.map((exp) => (
              <StatementAppOnlyRow
                key={exp.id} expense={exp} categoryName={categoryMap.get(exp.categoryId) ?? "Sem categoria"}
                isNearClosing={isDateNearCardClosingDay(exp.date, closingDay)} prevCompetence={prevCompetence} nextCompetence={nextCompetence}
                isQueuedForDelete={queuedDeleteExpenseIds.has(exp.id)} isLockedByBillProtection={isLockedByBillProtection} isPending={isPending}
                onMoveCompetence={(expenseId, targetCompetence) => onMoveExpenseToCompetence({ expenseId, targetCompetence })}
                onQueueDelete={onQueueDeleteAppExpense} onUndoDelete={onUndoDeleteAppExpense}
              />
            ))
          )
        ) : visibleItems.length === 0 && (activeTab !== "attention" || appDuplicates.length === 0) ? (
          <EmptyState
            tone="default"
            title={searchQuery.trim() ? "Nenhum lançamento encontrado" : "Nada pendente nesta aba"}
            description={searchQuery.trim() ? "Tente buscar por outro nome ou valor." : "Alterne entre as abas acima para revisar os demais itens da fatura."}
            action={
              searchQuery.trim() ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onSearchChange("")}>
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {activeTab === "attention"
              ? appDuplicates.map((cand) => (
                  <StatementAppDuplicateRow
                    key={cand.id} candidate={cand} categoryName={categoryMap.get(cand.duplicateExpense.categoryId) ?? "Sem categoria"}
                    isQueuedForDelete={queuedDeleteExpenseIds.has(cand.duplicateExpense.id)} isLockedByBillProtection={isLockedByBillProtection}
                    isPending={isPending} onQueueDelete={onQueueDeleteAppExpense} onUndoDelete={onUndoDeleteAppExpense}
                  />
                ))
              : null}
            {visibleItems.map((it) => (
              <StatementTransactionRow
                key={it.transaction.id} item={it} categoryOptions={categoryOptions} isEditing={editingRowId === it.transaction.id}
                showScopeControls={showScopeControls} isLockedByBillProtection={isLockedByBillProtection}
                isCompetenceMoveApproved={approvedCompetenceMoveTxIds.has(it.transaction.id)}
                isOriginOrTargetLocked={isLockedByBillProtection || (it.crossCompetenceMatch ? billProtection.lockedCompetences.has(it.crossCompetenceMatch.currentBillCompetence) : false)}
                isMicroAdjustmentSuppressed={it.matchedExpenseId ? suppressedMicroAdjustmentExpenseIds.has(it.matchedExpenseId) : false}
                isPending={isPending} onToggleItem={onToggleItem} onChangeCategory={handleCategoryChangeWithPropagation}
                onStartEdit={handleStartEdit} onSaveEdit={handleSaveEdit} onCancelEdit={handleCancelEdit} onRemove={onRemoveItem}
                onToggleScope={onToggleScope} onToggleProjectSeries={onToggleProjectSeries} onLinkAndAdjust={onLinkAndAdjust}
                onUndoLinkAndAdjust={onUndoLinkAndAdjust} onApproveCompetenceMove={onApproveCompetenceMove}
                onToggleSuppressMicroAdjustment={onToggleSuppressMicroAdjustment} onRestoreIgnoredPayment={onRestoreIgnoredPayment}
              />
            ))}
            {remainingHiddenCount > 0 ? (
              <div ref={sentinelRef} className="flex items-center justify-center p-3 bg-surface-raised">
                <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleCount((prev) => prev + STATEMENT_INCREMENTAL_PAGE_SIZE)} className="text-xs text-primary-strong">
                  Mostrar mais lançamentos ({remainingHiddenCount} restantes)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {importProgress && importProgress.totalChunks > 1 ? (
        <div role="region" aria-label="Progresso da importação em lotes" className="space-y-1.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Importando lote {importProgress.currentChunk} de {importProgress.totalChunks}...</span>
            <span className="font-semibold text-muted-foreground tabular-nums">{importProgress.processedItems}/{importProgress.totalItems} ({importProgress.percent}%)</span>
          </div>
          <Progress value={importProgress.percent} tone="portfolio" size="md" />
        </div>
      ) : null}
    </div>
  );
}
