import { useState } from "react";
import { Alert, Button, Modal, MoneyInput, Select, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks";
import { calculateEarlyAmortization } from "@/domain/loans";
import { useCategories, useEarlyAmortizeLoan } from "@/state";
import type { Debt, Loan } from "@/types";


export interface EarlyAmortizationDialogProps {
  loan: Loan;
  debts: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EarlyAmortizationDialog({ loan, debts, open, onOpenChange }: EarlyAmortizationDialogProps) {
  const [budgetCents, setBudgetCents] = useState(100000); // R$ 1.000,00
  const withExpense = true;
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const amortizeLoan = useEarlyAmortizeLoan();
  const pending = amortizeLoan.isPending;

  // Filtra parcelas pendentes
  const pendingDebts = debts.filter((d) => d.paid_at === null && d.installment_group_id === loan.installment_group_id);

  const formattedItems = pendingDebts.map((d, index) => ({
    id: d.id,
    installmentNumber: index + 1,
    amountCents: Math.round(d.amount * 100),
    dueDate: d.due_date,
  }));

  const monthlyRatePercent = (loan.interest_rate_monthly || 0) * 100;

  const result = calculateEarlyAmortization(
    formattedItems,
    monthlyRatePercent,
    budgetCents
  );

  const handleConfirm = async () => {
    setError(null);
    if (result.eliminatedInstallmentIds.length === 0) {
      setError("O valor informado não é suficiente para quitar nenhuma parcela futura.");
      return;
    }
    if (withExpense && !categoryId) {
      setError("Selecione uma categoria para a despesa de amortização.");
      return;
    }

    try {
      await amortizeLoan.mutateAsync({
        loanId: loan.id,
        debtIds: result.eliminatedInstallmentIds,
        createExpense: withExpense,
        expenseCategoryId: withExpense ? categoryId : null,
        totalPaid: result.totalPresentValuePaidCents / 100,
        discountTotal: result.totalDiscountCents / 100,
      });
      triggerHaptic("success");
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const categories = expenseCategories.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Amortização antecipada com desconto"
      description={`Elimine parcelas do final de ${loan.name}`}
      showCalculator
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && result.eliminatedInstallmentIds.length > 0) {
            void handleConfirm();
          }
        }}
        className="mt-4 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="amortize-budget" className="text-sm font-medium">
            Valor disponível para amortizar
          </label>
          <MoneyInput
            id="amortize-budget"
            cents={budgetCents}
            onCentsChange={setBudgetCents}
            aria-label="Valor para amortização extraordinária"
          />
        </div>

        {result.eliminatedInstallmentIds.length > 0 ? (
          <div className="rounded-md border border-border p-3 bg-muted/20 flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Parcelas eliminadas do final:</span>
              <span className="font-semibold text-foreground">
                {result.eliminatedInstallmentIds.length} parcela(s)
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Valor nominal das parcelas:</span>
              <span>{formatCentsAsBRL(result.totalOriginalAmountCents)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Desconto de juros obtido:</span>
              <span className="font-semibold text-success">
                {formatCentsAsBRL(result.totalDiscountCents)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground pt-1 border-t border-border/50">
              <span>Total efetivo a pagar hoje:</span>
              <span className="text-primary font-bold">
                {formatCentsAsBRL(result.totalPresentValuePaidCents)}
              </span>
            </div>

          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aumente o valor para cobrir ao menos uma parcela com desconto a valor presente.
          </p>
        )}

        {withExpense && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Categoria da despesa</span>
            {expenseCategories.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione categoria"
                ariaLabel="Categoria da despesa de amortização"
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={pending || result.eliminatedInstallmentIds.length === 0 || (withExpense && !categoryId)}
          >
            {pending ? "Processando…" : "Confirmar amortização"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
