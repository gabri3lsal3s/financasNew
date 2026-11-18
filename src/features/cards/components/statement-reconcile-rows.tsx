import { AlertTriangle, CheckCheck, Copy, Edit3, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText, Select, type SelectOption } from "@/components/ui";
import type { ExistingExpenseForReconciliation, ReconciliationItem } from "@/domain/reconciliation";
import { formatDateBR } from "@/lib/date";

export interface StatementAppOnlyRowProps {
  expense: ExistingExpenseForReconciliation;
  categoryName: string;
}

export function StatementAppOnlyRow({ expense, categoryName }: StatementAppOnlyRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 bg-warning/10">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="pt-0.5 text-warning-strong">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        </div>

        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
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

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono tabular-nums">{formatDateBR(expense.date)}</span>
            <span>· Lançamento manual cadastrado no app</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
        <span className="text-xs text-muted-foreground">{categoryName}</span>

        <div className="text-right min-w-[80px]">
          <MoneyText cents={expense.valueCents} tone="negative" className="font-medium text-xs" />
        </div>
      </div>
    </div>
  );
}

export interface StatementReconcileItemRowProps {
  item: ReconciliationItem;
  categoryOptions: SelectOption[];
  onToggleItem: (id: string) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onEdit?: (item: ReconciliationItem) => void;
  onRemove?: (id: string) => void;
}

export function StatementReconcileItemRow({
  item,
  categoryOptions,
  onToggleItem,
  onChangeCategory,
  onEdit,
  onRemove,
}: StatementReconcileItemRowProps) {
  const tx = item.transaction;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 transition-colors ${
        item.selected ? "bg-primary/10" : "opacity-75 hover:opacity-100"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="pt-0.5">
          <Checkbox
            checked={item.selected}
            onCheckedChange={() => onToggleItem(tx.id)}
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
            <span className="font-mono tabular-nums">{formatDateBR(tx.date)}</span>
          </div>

          {item.matchedExpenseDescription ? (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5 flex-wrap">
              <span>Casa com:</span>
              <span className="font-medium text-foreground">{item.matchedExpenseDescription}</span>
              {item.matchedExpenseDate ? (
                <span className="font-mono">({formatDateBR(item.matchedExpenseDate)})</span>
              ) : null}
            </div>
          ) : null}

          {item.duplicateReason ? (
            <div className="text-[10px] text-warning-strong italic pt-0.5">{item.duplicateReason}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
        <div className="w-40 sm:w-44">
          <Select
            value={item.selectedCategoryId}
            onValueChange={(val) => onChangeCategory(tx.id, val)}
            options={categoryOptions}
            ariaLabel={`Categoria de ${tx.cleanDescription}`}
          />
        </div>

        <div className="text-right min-w-[80px]">
          <MoneyText
            cents={tx.amountCents}
            tone={tx.isRefund ? "positive" : "negative"}
            className="font-medium text-xs"
          />
        </div>

        <div className="flex items-center gap-1">
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative size-9 sm:size-8 p-0 text-muted-foreground hover:text-foreground max-sm:after:absolute max-sm:after:-inset-1.5"
              onClick={() => onEdit(item)}
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
              className="relative size-9 sm:size-8 p-0 text-muted-foreground hover:text-critical-strong max-sm:after:absolute max-sm:after:-inset-1.5"
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
}
