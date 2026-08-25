import { useState } from "react";
import { Alert, Button, Input, Modal, MoneyInput, Select, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks";
import { calculateBillRefinancePlan } from "@/domain/cards/refinancing";
import { useCategories, useRefinanceCreditCardBill } from "@/state";


export interface BillRefinanceDialogProps {
  cardId: string;
  competenceMonth: string; // YYYY-MM
  remainingBalanceCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BillRefinanceContentProps {
  cardId: string;
  competenceMonth: string;
  remainingBalanceCents: number;
  onClose: () => void;
}

function BillRefinanceContent({
  cardId,
  competenceMonth,
  remainingBalanceCents,
  onClose,
}: BillRefinanceContentProps) {
  const [initialPaymentCents, setInitialPaymentCents] = useState(0);
  const [installmentsCount, setInstallmentsCount] = useState(4);
  const [monthlyRateStr, setMonthlyRateStr] = useState("3.5");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const refinanceBill = useRefinanceCreditCardBill();
  const pending = refinanceBill.isPending;

  const actualRate = parseFloat(monthlyRateStr.replace(",", ".")) || 0;
  const balanceToFinance = Math.max(0, remainingBalanceCents - initialPaymentCents);

  const plan = calculateBillRefinancePlan({
    remainingBalanceCents: balanceToFinance,
    installmentsCount,
    monthlyInterestRatePercent: actualRate,
    firstCompetenceMonth: competenceMonth,
  });

  const handleConfirm = async () => {
    setError(null);
    if (!categoryId) {
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
      });
      triggerHaptic("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const categories = expenseCategories.data ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && categoryId) {
          void handleConfirm();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="rounded-md border border-border/70 p-3 bg-muted/20 flex flex-col gap-1.5 text-xs text-muted-foreground">

        <div className="flex justify-between font-medium text-foreground">
          <span>Saldo aberto da fatura:</span>
          <span>{formatCentsAsBRL(remainingBalanceCents)}</span>
        </div>
        <p>
          O parcelamento divide o saldo restante e adiciona apenas os <strong>juros excedentes</strong> nas próximas faturas, evitando duplicar gastos de compras no orçamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="refinance-initial" className="text-sm font-medium">
            Entrada / Pagamento hoje
          </label>
          <MoneyInput
            id="refinance-initial"
            cents={initialPaymentCents}
            onCentsChange={setInitialPaymentCents}
            aria-label="Entrada paga hoje"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="refinance-installments" className="text-sm font-medium">
            Número de parcelas
          </label>
          <Select
            value={String(installmentsCount)}
            onValueChange={(val) => setInstallmentsCount(Number(val))}
            options={[
              { value: "2", label: "2x" },
              { value: "3", label: "3x" },
              { value: "4", label: "4x" },
              { value: "6", label: "6x" },
              { value: "8", label: "8x" },
              { value: "10", label: "10x" },
              { value: "12", label: "12x" },
              { value: "18", label: "18x" },
              { value: "24", label: "24x" },
            ]}
            ariaLabel="Quantidade de parcelas do cartão"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="refinance-rate" className="text-sm font-medium">
            Taxa de juros (% a.m.)
          </label>
          <Input
            id="refinance-rate"
            value={monthlyRateStr}
            onChange={(e) => setMonthlyRateStr(e.target.value)}
            placeholder="Ex.: 3.5"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Categoria dos juros</span>
          {expenseCategories.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecione categoria"
              ariaLabel="Categoria dos juros"
            />
          )}
        </div>
      </div>

      {plan.installments.length > 0 ? (
        <div className="rounded-md border border-border p-3 bg-card flex flex-col gap-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Saldo a financiar:</span>
            <span>{formatCentsAsBRL(balanceToFinance)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total de juros adicionais:</span>
            <span className="font-semibold text-warning">
              {formatCentsAsBRL(plan.totalInterestCents)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-foreground pt-1 border-t border-border/50">
            <span>Parcela estimada na fatura:</span>
            <span>
              {formatCentsAsBRL(plan.installments[0]?.amountCents ?? 0)}{" "}
              / mês
            </span>
          </div>
        </div>
      ) : null}


      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || !categoryId || balanceToFinance <= 0}>
          {pending ? "Processando…" : "Confirmar parcelamento"}
        </Button>
      </div>
    </form>
  );
}

export function BillRefinanceDialog(props: BillRefinanceDialogProps) {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Parcelar fatura do cartão"
      description={`Simulação para a fatura de ${props.competenceMonth}`}
      showCalculator
    >
      {props.open ? (
        <BillRefinanceContent
          key={`${props.cardId}:${props.competenceMonth}`}
          cardId={props.cardId}
          competenceMonth={props.competenceMonth}
          remainingBalanceCents={props.remainingBalanceCents}
          onClose={() => props.onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
