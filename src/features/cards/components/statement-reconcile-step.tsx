import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button, ModalFooter, MoneyText, Progress } from "@/components/ui";
import type { ExistingExpenseForReconciliation, ReconciliationItem } from "@/domain/reconciliation";
import type { Category } from "@/types";
import type { StatementItemPatch } from "./statement-import-helpers";
import { StatementItemFormDialog } from "./statement-item-form-dialog";
import { StatementAppOnlyRow, StatementReconcileItemRow } from "./statement-reconcile-rows";
import {
  StatementReconcileToolbar,
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
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onEditItem?: (id: string, updated: StatementItemPatch) => void;
  onRemoveItem?: (id: string) => void;
  onAddManualItem?: (item: StatementItemPatch) => void;
  onUncheckDuplicates?: () => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
  importProgress?: StatementImportProgress | null;
  hideFooter?: boolean;
}

/**
 * Passo 3 do Diálogo de Importação de Fatura:
 * Staging area interativa com filtros, seleção em lote, edição, inclusão manual e conciliação.
 */
export function StatementReconcileStep({
  items,
  unmatchedAppExpenses = [],
  categories,
  onToggleItem,
  onToggleAll,
  onChangeCategory,
  onEditItem,
  onRemoveItem,
  onAddManualItem,
  onUncheckDuplicates,
  onBack,
  onConfirm,
  isPending,
  importProgress,
  hideFooter = false,
}: StatementReconcileStepProps) {
  const [filter, setFilter] = useState<ReconcileFilterTab>("all");
  const [formState, setFormState] = useState<{
    open: boolean;
    mode: "edit" | "add";
    item: ReconciliationItem | null;
  }>({ open: false, mode: "add", item: null });

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

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "new":
        return items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault);
      case "suggested":
        return items.filter((it) => it.status === "probable_match");
      case "matched":
        return items.filter((it) => it.status === "exact_match");
      case "duplicates":
        return duplicateItems;
      default:
        return items;
    }
  }, [items, filter, duplicateItems]);

  const selectedItems = items.filter((it) => it.selected);
  const selectedCount = selectedItems.length;
  const selectedTotalCents = selectedItems.reduce((acc, it) => acc + it.transaction.amountCents, 0);
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => it.selected);

  return (
    <div className="space-y-3">
      <StatementReconcileToolbar
        filter={filter}
        onFilterChange={setFilter}
        duplicateCount={duplicateItems.length}
        countAppOnly={unmatchedAppExpenses.length}
        allFilteredSelected={allFilteredSelected}
        isPending={isPending}
        canAddManual={Boolean(onAddManualItem)}
        onOpenAddManual={() => setFormState({ open: true, mode: "add", item: null })}
        onToggleAll={onToggleAll}
        onUncheckDuplicates={onUncheckDuplicates}
      />

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
              onToggleItem={onToggleItem}
              onChangeCategory={onChangeCategory}
              onEdit={
                onEditItem
                  ? (target) => setFormState({ open: true, mode: "edit", item: target })
                  : undefined
              }
              onRemove={onRemoveItem}
            />
          ))
        )}
      </div>

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
          <Button type="button" variant="outline" onClick={onBack} disabled={isPending} className="gap-1.5">
            <RotateCcw className="size-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button
            type="button"
            sensoryIntent={false}
            disabled={selectedCount === 0 || isPending}
            onClick={onConfirm}
            className="gap-1.5"
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

      <StatementItemFormDialog
        open={formState.open}
        onOpenChange={(nextOpen) => setFormState((prev) => ({ ...prev, open: nextOpen }))}
        mode={formState.mode}
        initialItem={formState.item}
        categoryOptions={categoryOptions}
        defaultCategoryId={defaultCategoryId}
        onSubmit={(values) => {
          if (formState.mode === "edit" && formState.item) {
            onEditItem?.(formState.item.transaction.id, values);
          } else {
            onAddManualItem?.(values);
          }
        }}
      />
    </div>
  );
}
