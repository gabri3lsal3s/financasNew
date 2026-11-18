import { Button, Checkbox, Modal, ModalFooter } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { formatCentsAsBRL } from "@/services/masks";
import { cn } from "@/lib/utils";
import type { Debt, Expense } from "@/types";

export interface SplitDeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedDebt?: Debt | null;
  expenseId?: string;
  hasLinkedExpense: boolean;
  isExpenseFetched: boolean;
  linkedExpense?: Expense | null;
  totalCents: number;
  deleteLinkedDebt: boolean;
  onDeleteLinkedDebtChange: (checked: boolean) => void;
  deleteOriginalExpense: boolean;
  onDeleteOriginalExpenseChange: (checked: boolean) => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
}

/** Modal elevado de exclusão granular de racha e registros vinculados. */
export function SplitDeleteConfirmModal({
  open, onOpenChange, linkedDebt, expenseId, hasLinkedExpense, isExpenseFetched,
  linkedExpense, totalCents, deleteLinkedDebt, onDeleteLinkedDebtChange,
  deleteOriginalExpense, onDeleteOriginalExpenseChange, isDeleting, onConfirmDelete,
}: SplitDeleteConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      elevated
      title="Excluir Racha de Despesa"
      description="Escolha quais registros vinculados a este racha você também deseja remover:"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" disabled={isDeleting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirmDelete}>
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-surface">
          <Checkbox checked={true} disabled={true} onCheckedChange={() => {}} aria-label="Link e dados do racha" />
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">Link e dados do racha</span>
            <span className="text-[11px] text-muted-foreground block">
              Cancela a página pública do Pix e o acompanhamento das cotas.
            </span>
          </div>
        </div>

        {linkedDebt ? (
          <div
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer",
              deleteLinkedDebt ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
            )}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
              onDeleteLinkedDebtChange(!deleteLinkedDebt);
            }}
          >
            <Checkbox
              checked={deleteLinkedDebt}
              onCheckedChange={(checked) => onDeleteLinkedDebtChange(Boolean(checked))}
              aria-label="Cobrança a receber vinculada"
            />
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Conta a receber vinculada</span>
                <MoneyText cents={Math.round(linkedDebt.amount * 100)} variant="value" className="text-xs font-medium" />
              </div>
              <span className="text-[11px] text-muted-foreground block">
                Remove a pendência de recebimento da sua lista de Dívidas.
              </span>
            </div>
          </div>
        ) : null}

        {expenseId && hasLinkedExpense ? (
          <div
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer",
              deleteOriginalExpense ? "border-critical/40 bg-critical/5" : "border-border/80 bg-surface",
            )}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
              onDeleteOriginalExpenseChange(!deleteOriginalExpense);
            }}
          >
            <Checkbox
              checked={deleteOriginalExpense}
              onCheckedChange={(checked) => onDeleteOriginalExpenseChange(Boolean(checked))}
              aria-label="Despesa original no extrato"
            />
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Despesa original no extrato</span>
                <MoneyText cents={totalCents} variant="value" className="text-xs font-medium" />
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {deleteOriginalExpense
                  ? "Apaga totalmente a despesa do seu extrato e recalcula o seu saldo."
                  : "Mantém a despesa no extrato e restaura o valor para 100% integral."}
              </span>
            </div>
          </div>
        ) : null}

        {expenseId && isExpenseFetched && !linkedExpense ? (
          <div className="rounded-xl border border-border/80 bg-surface p-3 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground block mb-0.5">Despesa vinculada já excluída</span>
            A despesa original vinculada a este racha já foi removida do seu extrato. Apenas o link e os dados do racha serão excluídos.
          </div>
        ) : null}

        {!deleteOriginalExpense && expenseId && hasLinkedExpense ? (
          <div className="rounded-xl border border-border/80 bg-surface px-3 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Aviso contábil:</span> A despesa original permanecerá no seu extrato e terá seu rateio restaurado para 100% ({formatCentsAsBRL(totalCents)}).
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
