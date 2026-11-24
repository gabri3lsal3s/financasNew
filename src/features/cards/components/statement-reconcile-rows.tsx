import { memo, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCheck,
  Copy,
  CornerDownRight,
  Edit3,
  Plus,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Input,
  MoneyInput,
  MoneyText,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type SelectOption,
} from "@/components/ui";
import { todayISO } from "@/domain/debts";
import type {
  ExistingExpenseForReconciliation,
  ReconciliationItem,
} from "@/domain/reconciliation";
import { formatDateBR } from "@/lib/date";
import type { StatementItemPatch } from "./statement-import-helpers";

export interface CategoryPillProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CategoryPill({
  value,
  options,
  onChange,
  disabled = false,
}: CategoryPillProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-border/80 bg-surface hover:bg-surface-raised active:bg-surface-raised text-foreground transition-colors w-full sm:w-44 truncate text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 cursor-pointer"
          aria-label={`Categoria: ${selectedOption?.label ?? "Selecionar categoria"}`}
        >
          <span className="truncate flex-1">
            {selectedOption?.label ?? "Selecionar categoria"}
          </span>
          <Tag className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-56 p-2 space-y-1.5 z-dropdown bg-surface/98 border border-border/80 rounded-xl shadow-lg"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria..."
          className="h-8 text-xs"
          autoFocus={false}
        />
        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
          {filteredOptions.length === 0 ? (
            <div className="p-2 text-center text-[11px] text-muted-foreground">
              Nenhuma categoria encontrada.
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  opt.value === value
                    ? "bg-primary/10 text-primary-strong font-semibold"
                    : "text-foreground hover:bg-surface-raised"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value ? (
                  <Check className="size-3 shrink-0 text-primary-strong" aria-hidden="true" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface StatementAppOnlyRowProps {
  expense: ExistingExpenseForReconciliation;
  categoryName: string;
}

export function StatementAppOnlyRow({ expense, categoryName }: StatementAppOnlyRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 bg-warning/10">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="pt-0.5 text-warning-strong shrink-0">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        </div>

        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
              <span className="font-medium text-xs text-foreground truncate">
                {expense.description || "Despesa sem descrição"}
              </span>

              {expense.installmentNumber && expense.installmentsTotal ? (
                <Badge variant="muted" size="xs" className="font-mono">
                  {expense.installmentNumber}/{expense.installmentsTotal}
                </Badge>
              ) : null}

              <Badge variant="warning" size="xs">
                Ausente no Extrato
              </Badge>
            </div>

            <div className="sm:hidden text-right shrink-0">
              <MoneyText cents={expense.valueCents} tone="negative" className="font-semibold text-xs" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono tabular-nums">{formatDateBR(expense.date)}</span>
            <span>· Lançamento manual cadastrado no app</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
        <span className="text-xs text-muted-foreground">{categoryName}</span>
        <div className="hidden sm:block text-right min-w-[80px]">
          <MoneyText cents={expense.valueCents} tone="negative" className="font-medium text-xs" />
        </div>
      </div>
    </div>
  );
}

export interface StatementInlineEditRowProps {
  item: ReconciliationItem;
  categoryOptions: SelectOption[];
  onSave: (id: string, updated: StatementItemPatch) => void;
  onCancel: () => void;
}

export function StatementInlineEditRow({
  item,
  categoryOptions,
  onSave,
  onCancel,
}: StatementInlineEditRowProps) {
  const tx = item.transaction;
  const [date, setDate] = useState(tx.date);
  const [cleanDescription, setCleanDescription] = useState(tx.cleanDescription);
  const [amountCents, setAmountCents] = useState(tx.amountCents);
  const [categoryId, setCategoryId] = useState(
    item.selectedCategoryId || categoryOptions[0]?.value || "",
  );
  const [installmentCurrent, setInstallmentCurrent] = useState(
    tx.installment ? String(tx.installment.current) : "",
  );
  const [installmentTotal, setInstallmentTotal] = useState(
    tx.installment ? String(tx.installment.total) : "",
  );

  const canSubmit = cleanDescription.trim().length > 0 && amountCents > 0;

  const handleSave = () => {
    if (!canSubmit) return;
    const cur = Number.parseInt(installmentCurrent, 10);
    const tot = Number.parseInt(installmentTotal, 10);
    const installment =
      !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
        ? { current: cur, total: tot }
        : undefined;

    onSave(tx.id, {
      date,
      cleanDescription: cleanDescription.trim(),
      amountCents,
      selectedCategoryId: categoryId,
      installment,
    });
  };

  return (
    <div className="p-3.5 bg-surface-raised border border-primary/25 rounded-xl space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-1 border-b border-border/60">
        <span className="text-xs font-semibold text-foreground">Editar Lançamento</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onCancel}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Fechar edição"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Data</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Valor</label>
          <MoneyInput
            cents={amountCents}
            onCentsChange={setAmountCents}
            autoFocus={false}
            placeholder="R$ 0,00"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Parc. Atual</label>
            <Input
              value={installmentCurrent}
              onChange={(e) => setInstallmentCurrent(e.target.value)}
              placeholder="Ex: 1"
              autoFocus={false}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Total Parc.</label>
            <Input
              value={installmentTotal}
              onChange={(e) => setInstallmentTotal(e.target.value)}
              placeholder="Ex: 12"
              autoFocus={false}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Descrição</label>
          <Input
            value={cleanDescription}
            onChange={(e) => setCleanDescription(e.target.value)}
            placeholder="Descrição da despesa"
            autoFocus={false}
            className="h-9 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Categoria</label>
          <CategoryPill
            value={categoryId}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs cursor-pointer">
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSave}
          className="h-8 text-xs gap-1 cursor-pointer"
        >
          <Check className="size-3.5" aria-hidden="true" />
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}

export interface StatementInlineAddRowProps {
  categoryOptions: SelectOption[];
  defaultCategoryId: string;
  defaultDate?: string;
  onAdd: (patch: StatementItemPatch) => void;
  onCancel: () => void;
}

export function StatementInlineAddRow({
  categoryOptions,
  defaultCategoryId,
  defaultDate,
  onAdd,
  onCancel,
}: StatementInlineAddRowProps) {
  const [date, setDate] = useState(defaultDate || todayISO());
  const [cleanDescription, setCleanDescription] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId || categoryOptions[0]?.value || "",
  );
  const [installmentCurrent, setInstallmentCurrent] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");

  const canSubmit = cleanDescription.trim().length > 0 && amountCents > 0;

  const handleAdd = () => {
    if (!canSubmit) return;
    const cur = Number.parseInt(installmentCurrent, 10);
    const tot = Number.parseInt(installmentTotal, 10);
    const installment =
      !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
        ? { current: cur, total: tot }
        : undefined;

    onAdd({
      date,
      cleanDescription: cleanDescription.trim(),
      amountCents,
      selectedCategoryId: categoryId,
      installment,
    });
  };

  return (
    <div className="p-3.5 bg-surface-raised border border-primary/30 rounded-xl space-y-3 mb-2 animate-in fade-in duration-150 shadow-xs">
      <div className="flex items-center justify-between pb-1 border-b border-border/60">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="size-3.5 text-primary-strong" aria-hidden="true" />
          Adicionar Linha Manual
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onCancel}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Fechar inclusão manual"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Data</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Valor</label>
          <MoneyInput
            cents={amountCents}
            onCentsChange={setAmountCents}
            autoFocus={false}
            placeholder="R$ 0,00"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Parc. Atual</label>
            <Input
              value={installmentCurrent}
              onChange={(e) => setInstallmentCurrent(e.target.value)}
              placeholder="Ex: 1"
              autoFocus={false}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Total Parc.</label>
            <Input
              value={installmentTotal}
              onChange={(e) => setInstallmentTotal(e.target.value)}
              placeholder="Ex: 12"
              autoFocus={false}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Descrição</label>
          <Input
            value={cleanDescription}
            onChange={(e) => setCleanDescription(e.target.value)}
            placeholder="Ex.: Compra Farmácia"
            autoFocus={false}
            className="h-9 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Categoria</label>
          <CategoryPill
            value={categoryId}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs cursor-pointer">
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={handleAdd}
          className="h-8 text-xs gap-1 cursor-pointer"
        >
          <Check className="size-3.5" aria-hidden="true" />
          Adicionar Linha
        </Button>
      </div>
    </div>
  );
}

export interface StatementReconcileItemRowProps {
  item: ReconciliationItem;
  categoryOptions: SelectOption[];
  isEditing?: boolean;
  onToggleItem: (id: string) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onStartEdit?: (id: string) => void;
  onSaveEdit?: (id: string, updated: StatementItemPatch) => void;
  onCancelEdit?: () => void;
  onRemove?: (id: string) => void;
  isBusinessModeEnabled?: boolean;
  onToggleScope?: (id: string) => void;
  onToggleProjectSeries?: (id: string) => void;
  onLinkAndAdjust?: (id: string) => void;
  onCreateRefund?: (item: ReconciliationItem) => void;
}

export const StatementReconcileItemRow = memo(function StatementReconcileItemRow({
  item,
  categoryOptions,
  isEditing = false,
  onToggleItem,
  onChangeCategory,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  isBusinessModeEnabled = false,
  onToggleScope,
  onToggleProjectSeries,
  onLinkAndAdjust,
  onCreateRefund,
}: StatementReconcileItemRowProps) {
  const tx = item.transaction;

  if (isEditing && onSaveEdit && onCancelEdit) {
    return (
      <StatementInlineEditRow
        item={item}
        categoryOptions={categoryOptions}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  const hasSeries = Boolean(
    tx.installment &&
      tx.installment.total > 1 &&
      tx.installment.current < tx.installment.total &&
      item.seriesAnalysis &&
      item.seriesAnalysis.missingFutureInstallments.length > 0 &&
      item.seriesAnalysis.state !== "state_4_already_projected",
  );

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2.5 sm:gap-2 transition-colors ${
        item.selected ? "bg-primary/10" : "opacity-75 hover:opacity-100"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="pt-0.5 shrink-0">
          <Checkbox
            checked={item.selected}
            onCheckedChange={() => onToggleItem(tx.id)}
            aria-label={`Selecionar ${tx.cleanDescription}`}
          />
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
              <span className="font-medium text-xs text-foreground truncate">
                {tx.cleanDescription}
              </span>

              {tx.installment ? (
                <Badge variant="muted" size="xs" className="font-mono">
                  {tx.installment.current}/{tx.installment.total}
                </Badge>
              ) : null}

              {tx.originalDate && tx.originalDate !== tx.date ? (
                <Badge
                  variant="warning"
                  size="xs"
                  title={`Data original no extrato: ${formatDateBR(tx.originalDate)}. Ajustada para a data inicial do app.`}
                >
                  Data ajustada (era {formatDateBR(tx.originalDate)})
                </Badge>
              ) : null}

              {item.isInternalDuplicate ? (
                <Badge variant="warning" size="xs">
                  <Copy className="size-3" aria-hidden="true" />
                  Duplicata no Arquivo
                </Badge>
              ) : null}

              {item.isLinkedAndAdjusted ? (
                <Badge variant="positive" size="xs">
                  <CheckCheck className="size-3" aria-hidden="true" />
                  Vinculado e ajustado
                  {item.pendingAdjustmentDifferenceCents !== undefined &&
                  item.pendingAdjustmentDifferenceCents !== 0
                    ? ` (${item.pendingAdjustmentDifferenceCents > 0 ? "+" : ""}${(
                        item.pendingAdjustmentDifferenceCents / 100
                      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`
                    : ""}
                </Badge>
              ) : item.status === "exact_match" ? (
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

              {item.seriesAnalysis ? (
                <Badge
                  variant={
                    item.seriesAnalysis.state === "state_4_already_projected"
                      ? "muted"
                      : "portfolio"
                  }
                  size="xs"
                >
                  {item.seriesAnalysis.badgeLabel}
                </Badge>
              ) : null}
            </div>

            {/* Valor no mobile exibido na linha superior à direita */}
            <div className="sm:hidden text-right shrink-0">
              <MoneyText
                cents={tx.amountCents}
                tone={tx.isRefund ? "positive" : "negative"}
                className="font-semibold text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-mono tabular-nums">{formatDateBR(tx.date)}</span>
            {item.matchedExpenseDescription ? (
              <span className="flex items-center gap-1">
                <span>· Casa com:</span>
                <span className="font-medium text-foreground">{item.matchedExpenseDescription}</span>
                {item.matchedExpenseDate ? (
                  <span className="font-mono">({formatDateBR(item.matchedExpenseDate)})</span>
                ) : null}
              </span>
            ) : null}
          </div>

          {/* Ação de vincular e ajustar valor para sugestões */}
          {item.status === "probable_match" && item.matchedExpenseId && !item.isLinkedAndAdjusted && onLinkAndAdjust ? (
            <div className="pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-6 px-2 text-[11px] text-primary-strong border-primary/30 hover:bg-primary/10 gap-1 cursor-pointer"
                onClick={() => onLinkAndAdjust(tx.id)}
                title="Vincular a esta despesa cadastrada no app e ajustar o valor para o valor da fatura"
              >
                <CornerDownRight className="size-3" aria-hidden="true" />
                Vincular e ajustar valor
              </Button>
            </div>
          ) : null}

          {/* Ação de estorno em 1 clique */}
          {tx.isRefund && onCreateRefund ? (
            <div className="pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-6 px-2 text-[11px] text-positive-strong border-positive/30 hover:bg-positive/10 gap-1 cursor-pointer"
                onClick={() => onCreateRefund(item)}
                title="Registrar estorno de fatura no app gerando receita automática"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Registrar Estorno
              </Button>
            </div>
          ) : null}

          {/* Toggle de projeção de parcelas futuras */}
          {hasSeries && onToggleProjectSeries ? (
            <div className="pt-0.5">
              <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={item.projectSeries ?? true}
                  onCheckedChange={() => onToggleProjectSeries(tx.id)}
                />
                <span className="font-medium text-primary-strong">
                  Projetar parcelas futuras ({tx.installment!.current + 1} a {tx.installment!.total})
                </span>
              </label>
            </div>
          ) : null}

          {item.duplicateReason ? (
            <div className="text-[10px] text-warning-strong italic pt-0.5">{item.duplicateReason}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-7 sm:pl-0 w-full sm:w-auto">
        {isBusinessModeEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={`h-7 px-2 text-[11px] font-semibold border shrink-0 cursor-pointer ${
              (item.scope ?? "personal") === "business"
                ? "border-portfolio/40 bg-portfolio/15 text-portfolio hover:bg-portfolio/20"
                : "border-border/80 bg-surface text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onToggleScope?.(tx.id)}
            title={
              (item.scope ?? "personal") === "business"
                ? "Despesa do Negócio (PJ). Clique para mudar para Pessoal (PF)."
                : "Despesa Pessoal (PF). Clique para mudar para Negócio (PJ)."
            }
            aria-label={`Alternar esfera de ${tx.cleanDescription} entre Pessoal e Negócio`}
          >
            <Briefcase className="size-3 mr-1" aria-hidden="true" />
            <span>{(item.scope ?? "personal") === "business" ? "PJ" : "PF"}</span>
          </Button>
        ) : null}

        <div className="flex-1 sm:flex-initial sm:w-44 min-w-0">
          <CategoryPill
            value={item.selectedCategoryId}
            options={categoryOptions}
            onChange={(val) => onChangeCategory(tx.id, val)}
          />
        </div>

        {/* Valor no desktop */}
        <div className="hidden sm:block text-right min-w-[80px]">
          <MoneyText
            cents={tx.amountCents}
            tone={tx.isRefund ? "positive" : "negative"}
            className="font-medium text-xs"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onStartEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative size-9 sm:size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-1.5"
              onClick={() => onStartEdit(tx.id)}
              aria-label={`Editar ${tx.cleanDescription}`}
            >
              <Edit3 className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative size-9 sm:size-8 p-0 text-muted-foreground hover:text-critical-strong cursor-pointer max-sm:after:absolute max-sm:after:-inset-1.5"
              onClick={() => onRemove(tx.id)}
              aria-label={`Remover ${tx.cleanDescription} da importação`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
