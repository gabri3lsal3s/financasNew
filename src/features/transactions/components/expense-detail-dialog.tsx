import { useState } from "react";
import { Alert, ConfirmDialog, Modal, Select } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { getErrorMessage } from "@/services/errors";
import { useDeleteExpense } from "@/state";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { Expense, InstallmentDeleteMode } from "@/types";

export interface ExpenseDetailDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODE_OPTIONS = [
  { value: "single", label: "Apenas esta parcela" },
  { value: "all", label: "Todas as parcelas" },
  { value: "subsequent", label: "Esta parcela e as seguintes" },
];

/** Detalhe da despesa + exclusão em 3 modos (D1/§3.2.2 — cascata de dívidas). */
export function ExpenseDetailDialog({ expense, open, onOpenChange }: ExpenseDetailDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [error, setError] = useState<string | null>(null);
  const deleteExpense = useDeleteExpense();

  const isInstallment = expense != null && expense.installments_total > 1;

  const handleConfirmDelete = async () => {
    if (!expense) return;
    setError(null);
    try {
      await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setError(null);
          onOpenChange(next);
        }}
        title="Detalhes da despesa"
      >
        {expense ? (
          <div className="mt-4 flex flex-col gap-4">
            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="flex flex-col gap-2">
              <MoneyText
                cents={Math.round(expense.value * 100)}
                tone="negative"
                variant="value"
                className="text-3xl font-bold"
              />
              <p className="text-sm text-muted-foreground">{expense.description || "Sem descrição"}</p>
            </div>

            <dl className="flex flex-col gap-1.5 text-sm">
              <dt className="text-muted-foreground">Data</dt>
              <dd className="font-medium">{expense.date}</dd>
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd className="font-medium">{PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}</dd>
              {isInstallment ? (
                <>
                  <dt className="text-muted-foreground">Parcela</dt>
                  <dd className="font-medium">
                    {expense.installment_number}/{expense.installments_total}
                  </dd>
                </>
              ) : null}
              {expense.bill_competence ? (
                <>
                  <dt className="text-muted-foreground">Fatura</dt>
                  <dd className="font-medium">{expense.bill_competence}</dd>
                </>
              ) : null}
            </dl>

            <button
              type="button"
              className="self-start rounded-lg text-sm font-medium text-critical transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setConfirmOpen(true)}
            >
              Excluir despesa
            </button>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir despesa?"
        description={
          isInstallment
            ? "A exclusão remove também as dívidas pendentes vinculadas. Dívidas quitadas não são alteradas."
            : "Esta ação não pode ser desfeita. Dívidas pendentes vinculadas também serão removidas."
        }
        confirmLabel={deleteExpense.isPending ? "Excluindo…" : "Excluir"}
        variant="destructive"
        confirmPending={deleteExpense.isPending}
        onConfirm={() => void handleConfirmDelete()}
      >
        {isInstallment ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium">O que excluir?</span>
            <Select value={mode} onValueChange={(value) => setMode(value as InstallmentDeleteMode)} options={MODE_OPTIONS} ariaLabel="Modo de exclusão" />
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
