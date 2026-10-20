import { useMemo, useState } from "react";
import { Check, CheckCheck, Copy, Edit3, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
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
  Progress,
  Select,
  Tabs,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { todayISO } from "@/domain/debts";
import type { Category } from "@/types";
import type { BankTransactionItem, BankTransactionKind } from "@/domain/reconciliation";

export interface StatementImportProgress {
  currentChunk: number;
  totalChunks: number;
  percent: number;
  processedItems: number;
  totalItems: number;
}

interface BankStatementReconcileStepProps {
  items: BankTransactionItem[];
  categories: Category[];
  onToggleItem: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onChangeReceiveType: (id: string, receiveType: string) => void;
  onEditItem?: (
    id: string,
    updated: {
      date: string;
      cleanDescription: string;
      amountCents: number;
      kind: BankTransactionKind;
      selectedCategoryId: string;
      selectedReceiveType?: string;
    },
  ) => void;
  onRemoveItem?: (id: string) => void;
  onAddManualItem?: (item: {
    date: string;
    cleanDescription: string;
    amountCents: number;
    kind: BankTransactionKind;
    selectedCategoryId: string;
    selectedReceiveType?: string;
  }) => void;
  onUncheckDuplicates?: () => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
  importProgress?: StatementImportProgress | null;
}

type FilterTab = "all" | "expenses" | "incomes" | "new" | "matched" | "duplicates";

const RECEIVE_TYPE_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "salario", label: "Salário / Pró-labore" },
  { value: "ted", label: "TED / Transferência" },
  { value: "rendimento", label: "Rendimentos / Proventos" },
  { value: "outros", label: "Outros" },
];

/**
 * Passo 3 do Diálogo de Importação de Extrato Bancário:
 * Staging area interativa com conferência e conciliação de despesas e receitas do extrato,
 * seleção em lote, edição inline, remoção de linhas indesejadas, inclusão de linhas manuais
 * e detecção visual de duplicidades antes da gravação final.
 */
export function BankStatementReconcileStep({
  items,
  categories,
  onToggleItem,
  onToggleAll,
  onChangeCategory,
  onChangeReceiveType,
  onEditItem,
  onRemoveItem,
  onAddManualItem,
  onUncheckDuplicates,
  onBack,
  onConfirm,
  isPending,
  importProgress,
}: BankStatementReconcileStepProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  // Estado de Edição de Item da Staging Area
  const [editingItem, setEditingItem] = useState<BankTransactionItem | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmountCents, setEditAmountCents] = useState(0);
  const [editKind, setEditKind] = useState<BankTransactionKind>("expense");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editReceiveType, setEditReceiveType] = useState("pix");

  // Estado de Inclusão de Linha Manual
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [newDate, setNewDate] = useState(() => todayISO());
  const [newDescription, setNewDescription] = useState("");
  const [newAmountCents, setNewAmountCents] = useState(0);
  const [newKind, setNewKind] = useState<BankTransactionKind>("expense");
  const [newCategoryId, setNewCategoryId] = useState(() => categories[0]?.id ?? "");
  const [newReceiveType, setNewReceiveType] = useState("pix");

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories],
  );

  // Duplicidades potenciais (duplicatas no arquivo ou já cadastradas no app)
  const duplicateItems = useMemo(
    () => items.filter((it) => it.isInternalDuplicate || it.status === "exact_match"),
    [items],
  );
  const duplicateCount = duplicateItems.length;

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "expenses":
        return items.filter(
          (it) => it.kind === "expense" || it.kind === "card_payment_ignored" || it.kind === "transfer_ignored",
        );
      case "incomes":
        return items.filter((it) => it.kind === "income");
      case "new":
        return items.filter((it) => it.status === "unmatched_new" && !it.ignoredByDefault);
      case "matched":
        return items.filter((it) => it.status === "exact_match" || it.status === "probable_match");
      case "duplicates":
        return duplicateItems;
      default:
        return items;
    }
  }, [items, filter, duplicateItems]);

  const selectedItems = items.filter((it) => it.selected);
  const selectedCount = selectedItems.length;

  const selectedExpensesTotalCents = selectedItems
    .filter((it) => it.kind === "expense")
    .reduce((acc, it) => acc + it.transaction.amountCents, 0);

  const selectedIncomesTotalCents = selectedItems
    .filter((it) => it.kind === "income")
    .reduce((acc, it) => acc + it.transaction.amountCents, 0);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => it.selected);

  const tabsList = [
    { value: "all", label: "Todos", content: null },
    { value: "expenses", label: "Despesas", content: null },
    { value: "incomes", label: "Receitas", content: null },
    { value: "new", label: "Novos", content: null },
    { value: "matched", label: "Conciliados", content: null },
    ...(duplicateCount > 0
      ? [{ value: "duplicates", label: `Duplicatas (${duplicateCount})`, content: null }]
      : []),
  ];

  const handleStartEdit = (item: BankTransactionItem) => {
    setEditingItem(item);
    setEditDate(item.transaction.date);
    setEditDescription(item.transaction.cleanDescription);
    setEditAmountCents(item.transaction.amountCents);
    setEditKind(item.kind === "income" ? "income" : "expense");
    setEditCategoryId(item.selectedCategoryId || (categories[0]?.id ?? ""));
    setEditReceiveType(item.selectedReceiveType ?? "pix");
  };

  const handleOpenAddManual = () => {
    setNewDate(todayISO());
    setNewDescription("");
    setNewAmountCents(0);
    setNewKind("expense");
    setNewCategoryId(categories[0]?.id ?? "");
    setNewReceiveType("pix");
    setIsAddingManual(true);
  };

  return (
    <div className="space-y-3">
      {/* Alerta de Duplicidades com Ação Rápida */}
      {duplicateCount > 0 && filter !== "duplicates" && (
        <Alert variant="warning" className="py-2 px-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Copy className="size-4 shrink-0 text-warning-strong" aria-hidden />
              <span className="text-xs text-foreground">
                {duplicateCount === 1
                  ? "1 potencial duplicidade detectada no extrato."
                  : `${duplicateCount} potenciais duplicidades detectadas no extrato.`}
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
                  onClick={onUncheckDuplicates}
                >
                  Desmarcar duplicatas
                </Button>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* Barra de Filtros + Ações da Staging Area */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Tabs
            value={filter}
            onValueChange={(val) => {
              setFilter(val as FilterTab);
            }}
            items={tabsList}
          />
        </div>
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          {onAddManualItem && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
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
            disabled={isPending}
            className="shrink-0 text-xs cursor-pointer"
            onClick={() => {
              onToggleAll(!allFilteredSelected);
            }}
          >
            {allFilteredSelected ? "Desmarcar" : "Marcar todos"}
          </Button>
        </div>
      </div>

      {/* Tabela Interativa de Itens */}
      <div className="max-h-[min(380px,45dvh)] overflow-y-auto rounded-lg border border-border/70 bg-surface/40 divide-y divide-border/40">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma transação encontrada nesta categoria de filtro.
          </div>
        ) : (
          filteredItems.map((item) => {
            const { transaction: tx, kind, status, score, isInternalDuplicate } = item;
            const isIncome = kind === "income";
            const isIgnored = item.ignoredByDefault;

            return (
              <div
                key={tx.id}
                className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                  item.selected ? "bg-surface/90" : "opacity-60 bg-surface/20"
                }`}
              >
                {/* Lado Esquerdo: Checkbox + Identificação */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => {
                        onToggleItem(tx.id);
                      }}
                      aria-label={`Selecionar ${tx.cleanDescription}`}
                    />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground font-medium">{tx.date}</span>

                      {/* Badge de Natureza */}
                      {kind === "card_payment_ignored" ? (
                        <Badge variant="warning" size="xs">
                          Fatura de Cartão
                        </Badge>
                      ) : kind === "transfer_ignored" ? (
                        <Badge variant="muted" size="xs">
                          Transferência / Aporte
                        </Badge>
                      ) : isIncome ? (
                        <Badge variant="positive" size="xs">
                          Receita (+)
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="xs">
                          Despesa (-)
                        </Badge>
                      )}

                      {/* Badge de Duplicata Interna */}
                      {isInternalDuplicate ? (
                        <Badge variant="warning" size="xs">
                          <Copy className="size-3" aria-hidden="true" />
                          Duplicata no Arquivo
                        </Badge>
                      ) : null}

                      {/* Badge de Status de Conciliação */}
                      {status === "exact_match" ? (
                        <Badge variant="positive" size="xs">
                          <CheckCheck className="size-3" aria-hidden="true" />
                          Conciliado ({score}%)
                        </Badge>
                      ) : status === "probable_match" ? (
                        <Badge variant="warning" size="xs">
                          <Check className="size-3" aria-hidden="true" />
                          Sugestão ({score}%)
                        </Badge>
                      ) : !isIgnored ? (
                        <Badge variant="default" size="xs">
                          <Sparkles className="size-3" aria-hidden="true" />
                          Novo
                        </Badge>
                      ) : null}
                    </div>

                    <p className="font-medium text-xs text-foreground truncate">{tx.cleanDescription}</p>

                    {tx.rawDescription !== tx.cleanDescription && (
                      <p className="text-[10px] text-muted-foreground/80 truncate font-mono">
                        {tx.rawDescription}
                      </p>
                    )}

                    {/* Vínculo de Match Existente */}
                    {item.matchedExpenseDescription && (
                      <p className="text-[10px] text-positive-strong flex items-center gap-1">
                        <span>Casou com despesa:</span>
                        <span className="font-medium truncate">{item.matchedExpenseDescription}</span>
                        <span>({item.matchedExpenseDate})</span>
                      </p>
                    )}
                    {item.matchedIncomeDescription && (
                      <p className="text-[10px] text-positive-strong flex items-center gap-1">
                        <span>Casou com receita:</span>
                        <span className="font-medium truncate">{item.matchedIncomeDescription}</span>
                        <span>({item.matchedIncomeDate})</span>
                      </p>
                    )}

                    {/* Alerta de Item Ignorado ou Motivo de Duplicata */}
                    {item.duplicateReason && (
                      <p className="text-[10px] text-warning-strong italic">
                        {item.duplicateReason}
                      </p>
                    )}
                    {!item.duplicateReason && item.ignoreReason && (
                      <p className="text-[10px] text-warning-strong italic">
                        {item.ignoreReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Valor + Categoria / ReceiveType + Ações de Linha */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 w-full sm:w-auto shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-sm font-semibold">
                      <MoneyText
                        cents={tx.amountCents}
                        tone={isIncome ? "positive" : "negative"}
                        className="tabular-nums whitespace-nowrap"
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
                            onRemoveItem(tx.id);
                          }}
                          aria-label={`Remover ${tx.cleanDescription} da importação`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="w-40 sm:w-44">
                    {isIncome ? (
                      <Select
                        value={item.selectedReceiveType ?? "pix"}
                        onValueChange={(val) => onChangeReceiveType(tx.id, val)}
                        options={RECEIVE_TYPE_OPTIONS}
                        disabled={!item.selected}
                      />
                    ) : (
                      <Select
                        value={item.selectedCategoryId}
                        onValueChange={(val) => onChangeCategory(tx.id, val)}
                        options={categoryOptions}
                        disabled={!item.selected}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de progresso para importação em lotes */}
      {importProgress && importProgress.totalChunks > 1 && (
        <div
          role="region"
          aria-label="Progresso da importação em lotes"
          className="space-y-1.5 rounded-lg border border-border/80 bg-surface p-3 shadow-xs animate-in fade-in duration-200"
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
      )}

      {/* Rodapé e Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground min-w-0">
          <span className="font-semibold text-foreground">{selectedCount}</span> de {items.length} selecionados
          {selectedExpensesTotalCents > 0 && (
            <span className="text-negative-strong font-medium"> · -<MoneyText cents={selectedExpensesTotalCents} tone="negative" className="inline text-xs font-semibold tabular-nums whitespace-nowrap" /></span>
          )}
          {selectedIncomesTotalCents > 0 && (
            <span className="text-positive-strong font-medium"> · +<MoneyText cents={selectedIncomesTotalCents} tone="positive" className="inline text-xs font-semibold tabular-nums whitespace-nowrap" /></span>
          )}
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
            onClick={onConfirm}
            disabled={isPending || selectedCount === 0}
            className="gap-1.5"
          >
            {isPending ? (
              importProgress && importProgress.totalChunks > 1 ? (
                `Importando (${importProgress.percent}%)...`
              ) : (
                "Importando..."
              )
            ) : (
              <>
                <Check className="size-3.5" aria-hidden />
                Importar {selectedCount > 0 ? `(${selectedCount})` : ""}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal de Edição de Linha da Staging Area */}
      <Modal
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        title="Editar Lançamento"
        description="Ajuste os campos da transação antes de gravar a importação no banco de dados."
        size="md"
      >
        {editingItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editDescription.trim() || editAmountCents <= 0) return;
              triggerSensory("action");
              onEditItem?.(editingItem.transaction.id, {
                date: editDate,
                cleanDescription: editDescription.trim(),
                amountCents: editAmountCents,
                kind: editKind,
                selectedCategoryId: editCategoryId || (categories[0]?.id ?? ""),
                selectedReceiveType: editReceiveType,
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
                placeholder="Descrição da transação"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Tipo</label>
                <Select
                  value={editKind}
                  onValueChange={(val) => setEditKind(val as BankTransactionKind)}
                  options={[
                    { value: "expense", label: "Despesa (-)" },
                    { value: "income", label: "Receita (+)" },
                  ]}
                />
              </div>

              {editKind === "income" ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Tipo de Recebimento</label>
                  <Select
                    value={editReceiveType}
                    onValueChange={setEditReceiveType}
                    options={RECEIVE_TYPE_OPTIONS}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Categoria</label>
                  <Select
                    value={editCategoryId}
                    onValueChange={setEditCategoryId}
                    options={categoryOptions}
                  />
                </div>
              )}
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
        description="Inclua uma transação adicional na conferência antes da gravação."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newDescription.trim() || newAmountCents <= 0) return;
            triggerSensory("action");
            onAddManualItem?.({
              date: newDate,
              cleanDescription: newDescription.trim(),
              amountCents: newAmountCents,
              kind: newKind,
              selectedCategoryId: newCategoryId || (categories[0]?.id ?? ""),
              selectedReceiveType: newReceiveType,
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
              placeholder="Ex.: Depósito em dinheiro, almoço à vista"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Tipo</label>
              <Select
                value={newKind}
                onValueChange={(val) => setNewKind(val as BankTransactionKind)}
                options={[
                  { value: "expense", label: "Despesa (-)" },
                  { value: "income", label: "Receita (+)" },
                ]}
              />
            </div>

            {newKind === "income" ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Tipo de Recebimento</label>
                <Select
                  value={newReceiveType}
                  onValueChange={setNewReceiveType}
                  options={RECEIVE_TYPE_OPTIONS}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Categoria</label>
                <Select
                  value={newCategoryId}
                  onValueChange={setNewCategoryId}
                  options={categoryOptions}
                />
              </div>
            )}
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
