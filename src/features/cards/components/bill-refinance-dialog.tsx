import { useId, useState } from "react";
import {
  Alert,
  Button,
  FormField,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  PercentInput,
  Select,
  Skeleton,
} from "@/components/ui";
import { calculateBillRefinancePlan } from "@/domain/cards/refinancing";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { sensory } from "@/services/sensory";
import { useCategories, useRefinanceCreditCardBill } from "@/state";

export interface BillRefinanceDialogProps {
  cardId: string;
  competenceMonth: string; // YYYY-MM
  remainingBalanceCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INSTALLMENT_OPTIONS = [
  { value: "2", label: "2x" },
  { value: "3", label: "3x" },
  { value: "4", label: "4x" },
  { value: "6", label: "6x" },
  { value: "8", label: "8x" },
  { value: "10", label: "10x" },
  { value: "12", label: "12x" },
  { value: "18", label: "18x" },
  { value: "24", label: "24x" },
];

function BillRefinanceContent({
  cardId,
  competenceMonth,
  remainingBalanceCents,
  open,
  onOpenChange,
}: BillRefinanceDialogProps) {
  const formId = useId();
  const [initialPaymentCents, setInitialPaymentCents] = useState(0);
  const [installmentsCount, setInstallmentsCount] = useState(4);
  const [monthlyRatePercent, setMonthlyRatePercent] = useState(3.5);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const refinanceBill = useRefinanceCreditCardBill();
  const pending = refinanceBill.isPending;

  const balanceToFinance = Math.max(0, remainingBalanceCents - initialPaymentCents);
  const plan = calculateBillRefinancePlan({
    remainingBalanceCents: balanceToFinance,
    installmentsCount,
    monthlyInterestRatePercent: monthlyRatePercent,
    firstCompetenceMonth: competenceMonth,
  });

  const handleConfirm = async () => {
    setError(null);
    if (!categoryId) {
      sensory.error();
      setError("Selecione uma categoria para os juros do parcelamento.");
      return;
    }

    try {
      await refinanceBill.mutateAsync({
        cardId,
        competenceMonth,
        initialPaymentAmount: initialPaymentCents / 100,
        expenseCategoryId: categoryId,
        interestInstallments: plan.installments.map((item) => ({
          amount: item.interestCents / 100,
          date: item.date,
          installments_total: item.installmentsTotal,
          installment_number: item.installmentNumber,
          bill_competence: item.billCompetence,
        })),
        principalInstallments: plan.installments.map((item) => ({
          amount: item.principalCents / 100,
          bill_competence: item.billCompetence,
        })),
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
      title="Parcelar fatura do cartão"
      description={`Simulação para a fatura de ${monthLabel(competenceMonth)}`}
      size="xl"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} sensoryIntent={false} disabled={pending || !categoryId || balanceToFinance <= 0}>
            {pending ? "Processando…" : "Confirmar parcelamento"}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && categoryId && balanceToFinance > 0) void handleConfirm();
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="rounded-xl border border-border/80 bg-surface-raised p-3.5 flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Saldo aberto da fatura:</span>
            <MoneyText cents={remainingBalanceCents} tone="default" className="text-xs font-semibold" />
          </div>
          <p className="leading-relaxed">
            O parcelamento divide o saldo restante e adiciona apenas os{" "}
            <strong className="text-foreground">juros excedentes</strong> nas próximas faturas, evitando
            duplicar gastos de compras no orçamento.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Entrada / Pagamento hoje" htmlFor="refinance-initial">
            <MoneyInput
              id="refinance-initial"
              cents={initialPaymentCents}
              onCentsChange={setInitialPaymentCents}
              aria-label="Entrada paga hoje"
            />
          </FormField>

          <FormField label="Número de parcelas" htmlFor="refinance-installments">
            <Select
              id="refinance-installments"
              value={String(installmentsCount)}
              onValueChange={(val) => setInstallmentsCount(Number(val))}
              options={INSTALLMENT_OPTIONS}
              ariaLabel="Quantidade de parcelas do cartão"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Taxa de juros (% a.m.)" htmlFor="refinance-rate">
            <PercentInput
              id="refinance-rate"
              value={monthlyRatePercent}
              onValueChange={setMonthlyRatePercent}
              suffix="% a.m."
              aria-label="Taxa de juros mensal"
            />
          </FormField>

          <FormField label="Categoria dos juros" htmlFor="refinance-category">
            {expenseCategories.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                id="refinance-category"
                value={categoryId}
                onValueChange={setCategoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione categoria"
                ariaLabel="Categoria dos juros"
              />
            )}
          </FormField>
        </div>

        {plan.installments.length > 0 ? (
          <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Saldo a financiar:</span>
              <MoneyText cents={balanceToFinance} tone="default" className="text-xs font-medium" />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total de juros adicionais:</span>
              <MoneyText cents={plan.totalInterestCents} tone="default" className="text-xs font-semibold text-warning-strong" />
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-foreground pt-2 border-t border-border/80">
              <span>Parcela estimada na fatura:</span>
              <span className="inline-flex items-baseline gap-1">
                <MoneyText cents={plan.installments[0]?.amountCents ?? 0} tone="default" className="text-sm font-semibold" />
                <span className="text-xs font-normal text-muted-foreground">/ mês</span>
              </span>
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

export function BillRefinanceDialog(props: BillRefinanceDialogProps) {
  if (!props.open) return null;
  return <BillRefinanceContent key={`${props.cardId}:${props.competenceMonth}`} {...props} />;
}
