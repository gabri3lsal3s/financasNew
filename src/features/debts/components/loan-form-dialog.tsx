import { useId, useState } from "react";
import { Alert, Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { calculateLoanSchedule } from "@/domain/loans";
import { toISODate } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { sensory } from "@/services/sensory";
import { useCreateLoanContract } from "@/state";
import type { AmortizationSystem, LoanType } from "@/types";
import { LoanContractFields } from "./loan-contract-fields";

export interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LoanFormContent({ open, onOpenChange }: LoanFormDialogProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("financing");
  const [principalCents, setPrincipalCents] = useState(500000); // R$ 5.000,00
  const [installmentsCount, setInstallmentsCount] = useState(24);
  const [monthlyRatePercent, setMonthlyRatePercent] = useState(1.8);
  const [system, setSystem] = useState<AmortizationSystem>("price");
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const createLoan = useCreateLoanContract();
  const pending = createLoan.isPending;

  const preview = calculateLoanSchedule({
    principalCents,
    totalInstallments: installmentsCount,
    monthlyRatePercent,
    system,
    startDate,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      sensory.error();
      setError("Informe o nome ou credor do empréstimo/financiamento.");
      return;
    }
    if (principalCents <= 0) {
      sensory.error();
      setError("Informe o valor financiado.");
      return;
    }

    try {
      await createLoan.mutateAsync({
        name: name.trim(),
        loanType,
        principalAmount: principalCents / 100,
        interestRateMonthly: monthlyRatePercent,
        amortizationSystem: system,
        totalInstallments: installmentsCount,
        startDate,
        installments: preview.schedule.map((item) => ({
          installment_number: item.installmentNumber,
          due_date: item.dueDate,
          amount: item.amountCents / 100,
        })),
      });
      sensory.success();
      onOpenChange(false);
    } catch (err) {
      sensory.error();
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo empréstimo / financiamento"
      description="Cadastre o contrato com cálculo de saldo devedor e parcelas"
      size="xl"
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
            disabled={pending || !name.trim() || principalCents <= 0}
          >
            {pending ? "Criando contrato…" : "Salvar contrato"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3.5">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <LoanContractFields
          idPrefix="loan"
          name={name}
          onNameChange={setName}
          loanType={loanType}
          onLoanTypeChange={setLoanType}
          system={system}
          onSystemChange={setSystem}
          principalCents={principalCents}
          onPrincipalCentsChange={setPrincipalCents}
          installmentsCount={installmentsCount}
          onInstallmentsCountChange={setInstallmentsCount}
          monthlyRatePercent={monthlyRatePercent}
          onMonthlyRatePercentChange={setMonthlyRatePercent}
          startDate={startDate}
          onStartDateChange={setStartDate}
        />

        {preview.schedule.length > 0 ? (
          <div className="rounded-xl border border-border/80 p-3.5 bg-surface shadow-xs flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Primeira parcela:</span>
              <MoneyText
                cents={preview.schedule[0]?.amountCents ?? 0}
                tone="default"
                className="text-xs font-semibold"
              />
            </div>
            {system === "sac" ? (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Última parcela estimada:</span>
                <MoneyText
                  cents={preview.schedule[preview.schedule.length - 1]?.amountCents ?? 0}
                  tone="default"
                  className="text-xs font-semibold"
                />
              </div>
            ) : null}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total de juros estimados:</span>
              <MoneyText
                cents={preview.totalInterestCents}
                tone="default"
                className="text-xs font-semibold text-warning-strong"
              />
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

export function LoanFormDialog({ open, onOpenChange }: LoanFormDialogProps) {
  if (!open) return null;

  return <LoanFormContent key="new-loan" open={open} onOpenChange={onOpenChange} />;
}
