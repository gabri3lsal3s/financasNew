import { useMemo, useState } from "react";
import { Check, Columns3, RotateCcw, Tag } from "lucide-react";
import { Button, ModalFooter, MoneyText, Progress } from "@/components/ui";
import type {
  ExistingExpenseForReconciliation,
  ReconciliationItem,
  DetectedStatementMetadata,
} from "@/domain/reconciliation";
import type { Category } from "@/types";
import type { StatementItemPatch } from "./statement-import-helpers";
import {
  StatementAppOnlyRow,
  StatementInlineAddRow,
  StatementReconcileItemRow,
} from "./statement-reconcile-rows";
import { StatementReconcileSummaryCard } from "./statement-reconcile-summary-card";
import {
  StatementReconcileToolbar,
  type ReconcileFilterCounts,
  type ReconcileFilterTab,
} from "./statement-reconcile-toolbar";

export interface StatementImportProgress {
  currentChunk: number;
  totalChunks: number;
  percent: number;
  processedItems: number;
  totalItems: number;
}

export interface StatementReconcileStepProps {
  items: ReconciliationItem[];
  unmatchedAppExpenses?: ExistingExpenseForReconciliation[];
  categories: Category[];
  usedAiStructurer?: boolean;
  printedTotalCents?: number | null;
  detectedMeta?: DetectedStatementMetadata | null;
  onOpenMapping?: () => void;
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onEditItem?: (id: string, updated: StatementItemPatch) => void;
  onRemoveItem?: (id: string) => void;
  onAddManualItem?: (item: StatementItemPatch) => void;
  onUncheckDuplicates?: () => void;
  isBusinessModeEnabled?: boolean;
  onToggleScope?: (id: string) => void;
  onSetScopeAll?: (scope: "personal" | "business") => void;
  onToggleProjectSeries?: (id: string) => void;
  onLinkAndAdjust?: (id: string) => void;
  onCreateRefund?: (item: ReconciliationItem) => void;
  onApplyCategoryBatch?: (ids: string[], categoryId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
  importProgress?: StatementImportProgress | null;
  hideFooter?: boolean;
}

export function StatementReconcileStep({
  items,
  unmatchedAppExpenses = [],
  categories,
  usedAiStructurer = false,
  printedTotalCents = null,
  detectedMeta = null,
  onOpenMapping,
  onToggleItem,
  onToggleAll,
  onChangeCategory,
  onEditItem,
  onRemoveItem,
  onAddManualItem,
  onUncheckDuplicates,
  isBusinessModeEnabled = false,
  onToggleScope,
  onSetScopeAll,
  onToggleProjectSeries,
  onLinkAndAdjust,
  onCreateRefund,
  onApplyCategoryBatch,
  onBack,
  onConfirm,
  isPending,
  importProgress,
  hideFooter = false,
}: StatementReconcileStepProps) {
  const [filter, setFilter] = useState<ReconcileFilterTab>("all");
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [categoryPropagationPrompt, setCategoryPropagationPrompt] = useState<{
    merchantName: string;
    categoryId: string;
    categoryName: string;
    affectedItemIds: string[];
  } | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const defaultCategoryId = categories[0]?.id ?? "";

  const duplicateItems = useMemo(
    () => items.filter((it) => it.isInternalDuplicate || it.status === "exact_match"),
    [items],
  );

  const effectivePrintedTotalCents = detectedMeta?.detectedTotalCents ?? printedTotalCents;

  const totalReadCents = useMemo(
    () =>
      items.reduce((acc, it) => {
        if (it.transaction.isPayment || it.isInternalDuplicate) return acc;
        return it.transaction.isRefund
          ? acc - it.transaction.amountCents
          : acc + it.transaction.amountCents;
      }, 0),
    [items],
  );

  const totalAppCents = useMemo(
    () =>
      items.reduce((acc, it) => {
        if (it.status === "exact_match" || it.isLinkedAndAdjusted) {
          return acc + (it.matchedExpenseValueCents ?? it.transaction.amountCents);
        }
        return acc;
      }, 0),
    [items],
  );

  const selectedItems = useMemo(() => items.filter((it) => it.selected), [items]);
  const selectedNewItems = useMemo(
    () =>
      items.filter(
        (it) => it.selected && it.status === "unmatched_new" && !it.ignoredByDefault && !it.transaction.isRefund,
      ),
    [items],
  );
  const selectedNewCount = selectedNewItems.length;
  const selectedNewCents = useMemo(
    () => selectedNewItems.reduce((acc, it) => acc + it.transaction.amountCents, 0),
    [selectedNewItems],
  );

  const filterCounts: ReconcileFilterCounts = useMemo(() => {
    let newCount = 0;
    let suggestedCount = 0;
    let matchedCount = 0;
    let ignoredCount = 0;

    for (const it of items) {
      if (it.ignoredByDefault || it.transaction.isRefund || it.transaction.isPayment) {
        ignoredCount++;
      } else if (it.status === "exact_match" || it.isLinkedAndAdjusted) {
        matchedCount++;
      } else if (it.status === "probable_match") {
        suggestedCount++;
      } else if (it.status === "unmatched_new") {
        newCount++;
      }
    }

    return {
      all: items.length,
      new: newCount,
      suggested: suggestedCount,
      matched: matchedCount,
      ignored: ignoredCount,
      duplicates: duplicateItems.length,
      appOnly: unmatchedAppExpenses.length,
    };
  }, [items, duplicateItems.length, unmatchedAppExpenses.length]);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "new":
        return items.filter(
          (it) => it.status === "unmatched_new" && !it.ignoredByDefault && !it.transaction.isRefund,
        );
      case "suggested":
        return items.filter((it) => it.status === "probable_match" && !it.transaction.isRefund);
      case "matched":
        return items.filter((it) => it.status === "exact_match" || it.isLinkedAndAdjusted);
      case "ignored":
        return items.filter(
          (it) => it.ignoredByDefault || it.transaction.isRefund || it.transaction.isPayment,
        );
      case "duplicates":
        return duplicateItems;
      default:
        return items;
    }
  }, [items, filter, duplicateItems]);

  const selectedCount = selectedItems.length;
  const selectedTotalCents = selectedItems.reduce((acc, it) => acc + it.transaction.amountCents, 0);
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => it.selected);

  const handleCategoryChangeWithPropagation = (id: string, newCategoryId: string) => {
    onChangeCategory(id, newCategoryId);

    const changedItem = items.find((it) => it.transaction.id === id);
    if (!changedItem) return;

    const merchantNormalized = changedItem.transaction.cleanDescription.trim().toLowerCase();
    if (!merchantNormalized || merchantNormalized.length < 3) return;

    const affectedIds = items
      .filter(
        (it) =>
          it.transaction.id !== id &&
          it.transaction.cleanDescription.trim().toLowerCase() === merchantNormalized &&
          it.selectedCategoryId !== newCategoryId,
      )
      .map((it) => it.transaction.id);

    if (affectedIds.length > 0) {
      setCategoryPropagationPrompt({
        merchantName: changedItem.transaction.cleanDescription,
        categoryId: newCategoryId,
        categoryName: categoryMap.get(newCategoryId) ?? "Nova categoria",
        affectedItemIds: affectedIds,
      });
    } else {
      setCategoryPropagationPrompt(null);
    }
  };

  const handleApplyPropagation = () => {
    if (!categoryPropagationPrompt) return;
    if (onApplyCategoryBatch) {
      onApplyCategoryBatch(
        categoryPropagationPrompt.affectedItemIds,
        categoryPropagationPrompt.categoryId,
      );
    } else {
      for (const affectedId of categoryPropagationPrompt.affectedItemIds) {
        onChangeCategory(affectedId, categoryPropagationPrompt.categoryId);
      }
    }
    setCategoryPropagationPrompt(null);
  };

  return (
    <div className="space-y-3">
      {/* Sumário Financeiro Adaptativo */}
      <StatementReconcileSummaryCard
        totalReadCents={totalReadCents}
        totalAppCents={totalAppCents}
        selectedNewCount={selectedNewCount}
        selectedNewCents={selectedNewCents}
        officialInvoiceTotalCents={effectivePrintedTotalCents}
        usedAiStructurer={usedAiStructurer}
      />

      {/* Barra de Ajuste de Colunas e Metadados do Cartão */}
      {onOpenMapping || detectedMeta?.detectedCardLast4 ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            {detectedMeta?.detectedCardLast4 ? (
              <span className="text-muted-foreground text-[11px]">
                Cartão detectado na fatura: •••• {detectedMeta.detectedCardLast4}
              </span>
            ) : null}
          </div>

          {onOpenMapping ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={onOpenMapping}
              className="h-7 self-start sm:self-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Columns3 className="size-3.5" aria-hidden="true" />
              Ajustar colunas
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Prompt de Propagação de Categoria em Lote */}
      {categoryPropagationPrompt ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <Tag className="size-4 shrink-0 text-primary-strong mt-0.5 sm:mt-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <span className="text-foreground font-medium">
                Aplicar categoria <strong className="text-primary-strong">{categoryPropagationPrompt.categoryName}</strong> às outras {categoryPropagationPrompt.affectedItemIds.length} compras de <strong className="text-foreground">{categoryPropagationPrompt.merchantName}</strong>?
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setCategoryPropagationPrompt(null)}
              className="h-7 text-xs cursor-pointer"
            >
              Apenas esta
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleApplyPropagation}
              className="h-7 text-xs gap-1 cursor-pointer"
            >
              <Check className="size-3" aria-hidden="true" />
              Aplicar a todas ({categoryPropagationPrompt.affectedItemIds.length})
            </Button>
          </div>
        </div>
      ) : null}

      {/* Toolbar de Filtros com Contadores Vivos */}
      <StatementReconcileToolbar
        filter={filter}
        onFilterChange={setFilter}
        duplicateCount={duplicateItems.length}
        countAppOnly={unmatchedAppExpenses.length}
        allFilteredSelected={allFilteredSelected}
        isPending={isPending}
        canAddManual={Boolean(onAddManualItem)}
        onOpenAddManual={() => setIsAddingManual((prev) => !prev)}
        onToggleAll={onToggleAll}
        onUncheckDuplicates={onUncheckDuplicates}
        isBusinessModeEnabled={isBusinessModeEnabled}
        onSetScopeAll={onSetScopeAll}
        counts={filterCounts}
        isAddingManual={isAddingManual}
      />

      {/* Formulário de Inclusão Manual Inline (ao topo da lista) */}
      {isAddingManual && onAddManualItem ? (
        <StatementInlineAddRow
          categoryOptions={categoryOptions}
          defaultCategoryId={defaultCategoryId}
          onAdd={(patch) => {
            onAddManualItem(patch);
            setIsAddingManual(false);
          }}
          onCancel={() => setIsAddingManual(false)}
        />
      ) : null}

      {/* Lista de Lançamentos da Fatura / Staging Area */}
      <div className="rounded-xl border border-border/80 bg-surface divide-y divide-border/60">
        {filter === "app_only" ? (
          unmatchedAppExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Todas as despesas cadastradas no app foram encontradas no extrato.
            </div>
          ) : (
            unmatchedAppExpenses.map((exp) => (
              <StatementAppOnlyRow
                key={exp.id}
                expense={exp}
                categoryName={categoryMap.get(exp.categoryId) ?? "Sem categoria"}
              />
            ))
          )
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum lançamento nesta categoria de filtro.
          </div>
        ) : (
          filteredItems.map((item) => (
            <StatementReconcileItemRow
              key={item.transaction.id}
              item={item}
              categoryOptions={categoryOptions}
              isEditing={editingRowId === item.transaction.id}
              onToggleItem={onToggleItem}
              onChangeCategory={handleCategoryChangeWithPropagation}
              onStartEdit={(id) => setEditingRowId(id)}
              onSaveEdit={(id, updated) => {
                onEditItem?.(id, updated);
                setEditingRowId(null);
              }}
              onCancelEdit={() => setEditingRowId(null)}
              onRemove={onRemoveItem}
              isBusinessModeEnabled={isBusinessModeEnabled}
              onToggleScope={onToggleScope}
              onToggleProjectSeries={onToggleProjectSeries}
              onLinkAndAdjust={onLinkAndAdjust}
              onCreateRefund={onCreateRefund}
            />
          ))
        )}
      </div>

      {/* Barra de Progresso de Importação em Lotes */}
      {importProgress && importProgress.totalChunks > 1 ? (
        <div
          role="region"
          aria-label="Progresso da importação em lotes"
          className="space-y-1.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              Importando lote {importProgress.currentChunk} de {importProgress.totalChunks}...
            </span>
            <span className="font-semibold text-muted-foreground tabular-nums">
              {importProgress.processedItems}/{importProgress.totalItems} ({importProgress.percent}%)
            </span>
          </div>
          <Progress value={importProgress.percent} tone="portfolio" size="md" />
        </div>
      ) : null}

      {/* Rodapé de Contagem de Seleção */}
      <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-raised px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{selectedCount}</strong> de {items.length} selecionados
        </span>
        {selectedCount > 0 ? (
          <MoneyText cents={selectedTotalCents} tone="default" className="font-semibold text-xs" />
        ) : null}
      </div>

      {!hideFooter ? (
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isPending}
            className="gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button
            type="button"
            sensoryIntent={false}
            disabled={selectedCount === 0 || isPending}
            onClick={onConfirm}
            className="gap-1.5 cursor-pointer"
          >
            {isPending ? (
              importProgress && importProgress.totalChunks > 1
                ? `Importando (${importProgress.percent}%)...`
                : "Importando..."
            ) : (
              <>
                <Check className="size-4" aria-hidden="true" />
                <span>
                  Importar {selectedCount > 0 ? selectedCount : ""}{" "}
                  {selectedCount === 1 ? "Lançamento" : "Lançamentos"}
                </span>
              </>
            )}
          </Button>
        </ModalFooter>
      ) : null}
    </div>
  );
}
