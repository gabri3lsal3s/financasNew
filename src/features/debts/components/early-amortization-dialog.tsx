import { useId, useState } from "react";
import {
  Alert,
  Button,
  FormField,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  Select,
  Skeleton,
} from "@/components/ui";
import { calculateEarlyAmortization } from "@/domain/loans";
import { getErrorMessage } from "@/services/errors";
import { sensory } from "@/services/sensory";
import { useCategories, useEarlyAmortizeLoan } from "@/state";
import type { Debt, Loan } from "@/types";

export interface EarlyAmortizationDialogProps {
  loan: Loan;
  debts: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EarlyAmortizationContentProps {
  loan: Loan;
  debts: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EarlyAmortizationContent({
  loan,
  debts,
  open,
  onOpenChange,
}: EarlyAmortizationContentProps) {
  const formId = useId();
  const [budgetCents, setBudgetCents] = useState(100000); // R$ 1.000,00
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const amortizeLoan = useEarlyAmortizeLoan();
  const pending = amortizeLoan.isPending;

  const pendingDebts = debts.filter(
    (d) => d.paid_at === null && d.installment_group_id === loan.installment_group_id,
  );

  const formattedItems = pendingDebts.map((d, index) => ({
    id: d.id,
    installmentNumber: index + 1,
    amountCents: Math.round(d.amount * 100),
    dueDate: d.due_date,
  }));

  const monthlyRatePercent = loan.interest_rate_monthly || 0;

  const result = calculateEarlyAmortization(formattedItems, monthlyRatePercent, budgetCents);

  const handleConfirm = async () => {
    setError(null);
    if (result.eliminatedInstallmentIds.length === 0) {
      sensory.error();
      setError("O valor informado não é suficiente para quitar nenhuma parcela futura.");
      return;
    }
    if (!categoryId) {
      sensory.error();
      setError("Selecione uma categoria para a despesa de amortização.");
      return;
    }

    try {
      await amortizeLoan.mutateAsync({
        loanId: loan.id,
        debtIds: result.eliminatedInstallmentIds,
        createExpense: true,
        expenseCategoryId: categoryId,
        totalPaid: result.totalPresentValuePaidCents / 100,
        discountTotal: result.totalDiscountCents / 100,
      });
      sensory.success();
      onOpenChange(false);
    } catch (err) {
      sensory.error();
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
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={pending || result.eliminatedInstallmentIds.length === 0 || !categoryId}
            aria-label="Confirmar amortização"
          >
            {pending ? (
              "Processando…"
            ) : (
              <>
                <span className="hidden sm:inline">Confirmar amortização</span>
                <span className="sm:hidden">Amortizar</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && result.eliminatedInstallmentIds.length > 0 && categoryId) {
            void handleConfirm();
          }
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <FormField label="Valor disponível para amortizar" htmlFor="amortize-budget">
          <MoneyInput
            id="amortize-budget"
            cents={budgetCents}
            onCentsChange={setBudgetCents}
            aria-label="Valor para amortização extraordinária"
          />
        </FormField>

        {result.eliminatedInstallmentIds.length > 0 ? (
          <div className="rounded-xl border border-border/80 p-3.5 bg-surface shadow-xs flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Parcelas eliminadas do final:</span>
              <span className="font-semibold text-foreground">
                {result.eliminatedInstallmentIds.length} parcela(s)
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Valor nominal das parcelas:</span>
              <MoneyText
                cents={result.totalOriginalAmountCents}
                tone="default"
                className="text-xs font-medium"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Desconto de juros obtido:</span>
              <MoneyText
                cents={result.totalDiscountCents}
                tone="positive"
                className="text-xs font-semibold text-positive-strong"
              />
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground pt-2 border-t border-border/80">
              <span>Total efetivo a pagar hoje:</span>
              <MoneyText
                cents={result.totalPresentValuePaidCents}
                tone="default"
                className="text-sm font-bold text-primary-strong"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aumente o valor para cobrir ao menos uma parcela com desconto a valor presente.
          </p>
        )}

        <FormField label="Categoria da despesa" htmlFor="amortize-category">
          {expenseCategories.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              id="amortize-category"
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecione categoria"
              ariaLabel="Categoria da despesa de amortização"
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
}

export function EarlyAmortizationDialog({
  loan,
  debts,
  open,
  onOpenChange,
}: EarlyAmortizationDialogProps) {
  if (!open) return null;

  return (
    <EarlyAmortizationContent
      key={loan.id}
      loan={loan}
      debts={debts}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
