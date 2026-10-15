import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Copy, Edit3, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  Select,
  Tabs,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { todayISO } from "@/domain/debts";
import type { Category } from "@/types";
import type { ExistingExpenseForReconciliation, ReconciliationItem } from "@/domain/reconciliation";

interface StatementReconcileStepProps {
  items: ReconciliationItem[];
  unmatchedAppExpenses?: ExistingExpenseForReconciliation[];
  categories: Category[];
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onEditItem?: (
    id: string,
    updated: {
      date: string;
      cleanDescription: string;
      amountCents: number;
      selectedCategoryId: string;
      installment?: { current: number; total: number };
    },
  ) => void;
  onRemoveItem?: (id: string) => void;
  onAddManualItem?: (item: {
    date: string;
    cleanDescription: string;
    amountCents: number;
    selectedCategoryId: string;
    installment?: { current: number; total: number };
  }) => void;
  onUncheckDuplicates?: () => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

type FilterTab = "all" | "new" | "suggested" | "matched" | "duplicates" | "app_only";

/**
 * Passo 3 do Diálogo de Importação de Fatura:
 * Staging area interativa com conferência e classificação bidirecional,
 * filtros rápidos, seleção em lote, edição inline, remoção de linhas,
 * inclusão de linhas manuais e detecção visual de duplicidades.
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
}: StatementReconcileStepProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  // Estado de Edição de Linha da Staging Area
  const [editingItem, setEditingItem] = useState<ReconciliationItem | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmountCents, setEditAmountCents] = useState(0);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editInstallmentCurrent, setEditInstallmentCurrent] = useState("");
  const [editInstallmentTotal, setEditInstallmentTotal] = useState("");

  // Estado de Inclusão de Linha Manual
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [newDate, setNewDate] = useState(() => todayISO());
  const [newDescription, setNewDescription] = useState("");
  const [newAmountCents, setNewAmountCents] = useState(0);
  const [newCategoryId, setNewCategoryId] = useState(() => categories[0]?.id ?? "");
  const [newInstallmentCurrent, setNewInstallmentCurrent] = useState("");
  const [newInstallmentTotal, setNewInstallmentTotal] = useState("");

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories],
  );

  // Contadores
  const countAppOnly = unmatchedAppExpenses.length;

  const duplicateItems = useMemo(
    () => items.filter((it) => it.isInternalDuplicate || it.status === "exact_match"),
    [items],
  );
  const duplicateCount = duplicateItems.length;

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

  const tabsList = [
    { value: "all", label: "Todos", content: null },
    { value: "new", label: "Novos", content: null },
    { value: "suggested", label: "Sugestões", content: null },
    { value: "matched", label: "Conciliados", content: null },
    ...(duplicateCount > 0
      ? [{ value: "duplicates", label: `Duplicatas (${duplicateCount})`, content: null }]
      : []),
    ...(countAppOnly > 0
      ? [{ value: "app_only", label: `No App apenas (${countAppOnly})`, content: null }]
      : []),
  ];

  const handleStartEdit = (item: ReconciliationItem) => {
    setEditingItem(item);
    setEditDate(item.transaction.date);
    setEditDescription(item.transaction.cleanDescription);
    setEditAmountCents(item.transaction.amountCents);
    setEditCategoryId(item.selectedCategoryId || (categories[0]?.id ?? ""));
    setEditInstallmentCurrent(item.transaction.installment?.current?.toString() ?? "");
    setEditInstallmentTotal(item.transaction.installment?.total?.toString() ?? "");
  };

  const handleOpenAddManual = () => {
    setNewDate(todayISO());
    setNewDescription("");
    setNewAmountCents(0);
    setNewCategoryId(categories[0]?.id ?? "");
    setNewInstallmentCurrent("");
    setNewInstallmentTotal("");
    setIsAddingManual(true);
  };

  return (
    <div className="space-y-3">
      {/* Alerta de Duplicidades Potenciais */}
      {duplicateCount > 0 && filter !== "duplicates" && (
        <Alert variant="warning" className="py-2 px-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Copy className="size-4 shrink-0 text-warning-strong" aria-hidden />
              <span className="text-xs text-foreground">
                {duplicateCount === 1
                  ? "1 potencial duplicidade detectada nesta fatura."
                  : `${duplicateCount} potenciais duplicidades detectadas nesta fatura.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  setFilter("duplicates");
                }}
                className="text-[11px] font-medium underline text-warning-strong hover:opacity-80 shrink-0 cursor-pointer"
              >
                Ver detalhes
              </button>
              {onUncheckDuplicates && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-warning-strong hover:bg-warning-subtle/20 cursor-pointer"
                  onClick={() => {
                    triggerSensory("action");
                    onUncheckDuplicates();
                  }}
                >
                  Desmarcar duplicatas
                </Button>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* Alerta de Despesas do App Não Encontradas na Fatura */}
      {countAppOnly > 0 && filter !== "app_only" ? (
        <Alert variant="warning" className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-snug">
              {countAppOnly === 1
                ? "1 despesa do app não consta neste extrato."
                : `${countAppOnly} despesas do app não constam neste extrato.`}
            </span>
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setFilter("app_only");
              }}
              className="text-[11px] font-medium underline hover:opacity-80 shrink-0 cursor-pointer"
            >
              Ver detalhes
            </button>
          </div>
        </Alert>
      ) : null}

      {/* Barra de Filtros + Ações da Staging Area */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Tabs
            value={filter}
            onValueChange={(val) => {
              triggerSensory("selection");
              setFilter(val as FilterTab);
            }}
            items={tabsList}
          />
        </div>
        {filter !== "app_only" ? (
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {onAddManualItem && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 cursor-pointer gap-1"
                onClick={handleOpenAddManual}
              >
                <Plus className="size-3.5" aria-hidden />
                Adicionar linha
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs cursor-pointer"
              onClick={() => {
                triggerSensory("action");
                onToggleAll(!allFilteredSelected);
              }}
            >
              {allFilteredSelected ? "Desmarcar" : "Marcar todos"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Tabela Interativa de Itens */}
      <div className="max-h-[min(380px,45dvh)] overflow-y-auto rounded-lg border border-border/70 bg-surface/40 divide-y divide-border/40">
        {filter === "app_only" ? (
          unmatchedAppExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Todas as despesas cadastradas no app foram encontradas no extrato.
            </div>
          ) : (
            unmatchedAppExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 bg-warning-subtle/10"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5 text-warning">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs text-foreground truncate">
                        {exp.description || "Despesa sem descrição"}
                      </span>

                      {exp.installmentNumber && exp.installmentsTotal ? (
                        <Badge variant="muted" size="xs" className="font-mono">
                          {exp.installmentNumber}/{exp.installmentsTotal}
                        </Badge>
                      ) : null}

                      <Badge variant="warning" size="xs">
                        Ausente no Extrato
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{exp.date}</span>
                      <span>· Lançamento manual cadastrado no app</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
                  <span className="text-xs text-muted-foreground">
                    {categoryMap.get(exp.categoryId) ?? "Sem categoria"}
                  </span>

                  <div className="text-right min-w-[80px]">
                    <MoneyText
                      cents={exp.valueCents}
                      tone="negative"
                      className="font-medium text-xs"
                    />
                  </div>
                </div>
              </div>
            ))
          )
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum lançamento nesta categoria de filtro.
          </div>
        ) : (
          filteredItems.map((item) => {
            const tx = item.transaction;

            return (
              <div
                key={tx.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 transition-colors ${
                  item.selected ? "bg-primary-subtle/20" : "opacity-75 hover:opacity-100"
                }`}
              >
                {/* Checkbox + Descrição + Data */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => {
                        triggerSensory("selection");
                        onToggleItem(tx.id);
                      }}
                      aria-label={`Selecionar ${tx.cleanDescription}`}
                    />
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs text-foreground truncate">
                        {tx.cleanDescription}
                      </span>

                      {tx.installment ? (
                        <Badge variant="muted" size="xs" className="font-mono">
                          {tx.installment.current}/{tx.installment.total}
                        </Badge>
                      ) : null}

                      {/* Badge de Duplicata Interna */}
                      {item.isInternalDuplicate ? (
                        <Badge variant="warning" size="xs">
                          <Copy className="size-3" aria-hidden="true" />
                          Duplicata no Arquivo
                        </Badge>
                      ) : null}

                      {item.status === "exact_match" ? (
                        <Badge variant="positive" size="xs">
                          <CheckCheck className="size-3" aria-hidden="true" />
                          Conciliado ({item.score}%)
                        </Badge>
                      ) : item.status === "probable_match" ? (
                        <Badge variant="warning" size="xs">
                          <Sparkles className="size-3" aria-hidden="true" />
                          Sugestão ({item.score}%)
                        </Badge>
                      ) : item.ignoredByDefault ? (
                        <Badge variant="muted" size="xs">
                          Pagamento / Ignorado
                        </Badge>
                      ) : (
                        <Badge variant="default" size="xs">
                          Novo
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono tabular-nums">{tx.date}</span>
                    </div>

                    {item.matchedExpenseDescription ? (
                      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
                        <span>Casa com:</span>
                        <span className="font-medium text-foreground">{item.matchedExpenseDescription}</span>
                        <span className="font-mono">({item.matchedExpenseDate})</span>
                      </div>
                    ) : null}

                    {item.duplicateReason && (
                      <div className="text-[10px] text-warning-strong italic pt-0.5">
                        {item.duplicateReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Seletor de Categoria + Valor + Ações de Linha */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
                  <div className="w-40 sm:w-44">
                    <Select
                      value={item.selectedCategoryId}
                      onValueChange={(val) => onChangeCategory(tx.id, val)}
                      options={categoryOptions}
                    />
                  </div>

                  <div className="text-right min-w-[80px]">
                    <MoneyText
                      cents={tx.amountCents}
                      tone={tx.isRefund ? "positive" : "negative"}
                      className="font-medium text-xs tabular-nums whitespace-nowrap"
                    />
                  </div>

                  {/* Ações de Linha: Editar e Remover */}
                  <div className="flex items-center gap-0.5">
                    {onEditItem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(item)}
                        aria-label={`Editar ${tx.cleanDescription}`}
                      >
                        <Edit3 className="size-3.5" aria-hidden />
                      </Button>
                    )}
                    {onRemoveItem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-critical-strong"
                        onClick={() => {
                          triggerSensory("action");
                          onRemoveItem(tx.id);
                        }}
                        aria-label={`Remover ${tx.cleanDescription} da importação`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sumário e Rodapé de Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground min-w-0">
          <span className="font-semibold text-foreground">{selectedCount}</span> de {items.length} selecionados
          {selectedCount > 0 ? (
            <> · <MoneyText cents={selectedTotalCents} className="font-semibold text-foreground tabular-nums whitespace-nowrap" /></>
          ) : null}
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={isPending}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Voltar
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={selectedCount === 0 || isPending}
            loading={isPending}
            onClick={onConfirm}
            className="gap-1.5"
          >
            <Check className="size-3.5" aria-hidden />
            Importar {selectedCount > 0 ? selectedCount : ""} {selectedCount === 1 ? "Lançamento" : "Lançamentos"}
          </Button>
        </div>
      </div>

      {/* Modal de Edição de Linha da Fatura */}
      <Modal
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        title="Editar Lançamento"
        description="Ajuste os campos do lançamento da fatura antes da confirmação."
        size="md"
      >
        {editingItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editDescription.trim() || editAmountCents <= 0) return;
              triggerSensory("action");

              const cur = Number.parseInt(editInstallmentCurrent, 10);
              const tot = Number.parseInt(editInstallmentTotal, 10);
              const installment =
                !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
                  ? { current: cur, total: tot }
                  : undefined;

              onEditItem?.(editingItem.transaction.id, {
                date: editDate,
                cleanDescription: editDescription.trim(),
                amountCents: editAmountCents,
                selectedCategoryId: editCategoryId || (categories[0]?.id ?? ""),
                installment,
              });
              setEditingItem(null);
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Data</label>
                <DatePicker value={editDate} onValueChange={setEditDate} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Valor</label>
                <MoneyInput cents={editAmountCents} onCentsChange={setEditAmountCents} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Descrição</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descrição da despesa"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Categoria</label>
              <Select
                value={editCategoryId}
                onValueChange={setEditCategoryId}
                options={categoryOptions}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Parcela Atual (opcional)</label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={editInstallmentCurrent}
                  onChange={(e) => setEditInstallmentCurrent(e.target.value)}
                  placeholder="Ex.: 1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Total Parcelas (opcional)</label>
                <Input
                  type="number"
                  min="2"
                  max="60"
                  value={editInstallmentTotal}
                  onChange={(e) => setEditInstallmentTotal(e.target.value)}
                  placeholder="Ex.: 10"
                />
              </div>
            </div>

            <ModalFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingItem(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!editDescription.trim() || editAmountCents <= 0}
              >
                Salvar Alterações
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Modal de Inclusão de Linha Manual */}
      <Modal
        open={isAddingManual}
        onOpenChange={setIsAddingManual}
        title="Adicionar Linha Manual"
        description="Inclua uma despesa adicional nesta fatura antes da confirmação."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newDescription.trim() || newAmountCents <= 0) return;
            triggerSensory("action");

            const cur = Number.parseInt(newInstallmentCurrent, 10);
            const tot = Number.parseInt(newInstallmentTotal, 10);
            const installment =
              !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
                ? { current: cur, total: tot }
                : undefined;

            onAddManualItem?.({
              date: newDate,
              cleanDescription: newDescription.trim(),
              amountCents: newAmountCents,
              selectedCategoryId: newCategoryId || (categories[0]?.id ?? ""),
              installment,
            });
            setIsAddingManual(false);
          }}
          className="space-y-4 pt-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Data</label>
              <DatePicker value={newDate} onValueChange={setNewDate} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Valor</label>
              <MoneyInput cents={newAmountCents} onCentsChange={setNewAmountCents} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Descrição</label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ex.: Compra Farmácia, Restaurante"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Categoria</label>
            <Select
              value={newCategoryId}
              onValueChange={setNewCategoryId}
              options={categoryOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Parcela Atual (opcional)</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={newInstallmentCurrent}
                onChange={(e) => setNewInstallmentCurrent(e.target.value)}
                placeholder="Ex.: 1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Total Parcelas (opcional)</label>
              <Input
                type="number"
                min="2"
                max="60"
                value={newInstallmentTotal}
                onChange={(e) => setNewInstallmentTotal(e.target.value)}
                placeholder="Ex.: 6"
              />
            </div>
          </div>

          <ModalFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingManual(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newDescription.trim() || newAmountCents <= 0}
            >
              Adicionar Linha
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
