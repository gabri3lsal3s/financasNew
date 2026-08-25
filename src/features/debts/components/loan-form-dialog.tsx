import { useState } from "react";
import { Alert, Button, DatePicker, Input, Modal, MoneyInput, NumberStepperInput, Select } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import { formatCentsAsBRL } from "@/services/masks";
import { toISODate } from "@/domain/money";

import {
  AMORTIZATION_SYSTEM_LABELS,
  calculateLoanSchedule,
  LOAN_TYPE_LABELS,
} from "@/domain/loans";
import { useCreateLoanContract } from "@/state";
import type { AmortizationSystem, LoanType } from "@/types";

export interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoanFormDialog({ open, onOpenChange }: LoanFormDialogProps) {
  const [name, setName] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("financing");
  const [principalCents, setPrincipalCents] = useState(500000); // R$ 5.000,00
  const [installmentsCount, setInstallmentsCount] = useState(24);
  const [monthlyRateStr, setMonthlyRateStr] = useState("1.8");
  const [system, setSystem] = useState<AmortizationSystem>("price");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const createLoan = useCreateLoanContract();
  const pending = createLoan.isPending;

  const actualRate = parseFloat(monthlyRateStr.replace(",", ".")) || 0;

  const preview = calculateLoanSchedule({
    principalCents,
    totalInstallments: installmentsCount,
    monthlyRatePercent: actualRate,
    system,
    startDate,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome ou credor do empréstimo/financiamento.");
      return;
    }
    if (principalCents <= 0) {
      setError("Informe o valor financiado.");
      return;
    }

    try {
      await createLoan.mutateAsync({
        name: name.trim(),
        loanType,
        principalAmount: principalCents / 100,
        interestRateMonthly: actualRate / 100,
        amortizationSystem: system,
        totalInstallments: installmentsCount,
        startDate,
        installments: preview.schedule.map((item) => ({
          installment_number: item.installmentNumber,
          due_date: item.dueDate,
          amount: item.amountCents / 100,
        })),
      });
      triggerHaptic("success");
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo empréstimo / financiamento"
      description="Cadastre o contrato com cálculo de saldo devedor e parcelas"
      showCalculator
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="loan-name" className="text-sm font-medium">
            Nome do contrato ou credor
          </label>
          <Input
            id="loan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Financiamento Carro, Empréstimo Caixa"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="loan-type" className="text-sm font-medium">
              Tipo de crédito
            </label>
            <Select
              value={loanType}
              onValueChange={(val) => setLoanType(val as LoanType)}
              options={Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              ariaLabel="Tipo de empréstimo"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="loan-system" className="text-sm font-medium">
              Sistema de amortização
            </label>
            <Select
              value={system}
              onValueChange={(val) => setSystem(val as AmortizationSystem)}
              options={Object.entries(AMORTIZATION_SYSTEM_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              ariaLabel="Sistema de amortização"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="loan-principal" className="text-sm font-medium">
              Valor financiado (principal)
            </label>
            <MoneyInput
              id="loan-principal"
              cents={principalCents}
              onCentsChange={setPrincipalCents}
              aria-label="Valor financiado"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="loan-installments" className="text-sm font-medium">
              Número de parcelas
            </label>
            <NumberStepperInput
              min={1}
              max={420}
              step={1}
              value={installmentsCount}
              onValueChange={(val) => setInstallmentsCount(Math.max(1, parseInt(val) || 1))}
              ariaLabel="Número de parcelas"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="loan-rate" className="text-sm font-medium">
              Taxa de juros (% a.m.)
            </label>
            <Input
              id="loan-rate"
              value={monthlyRateStr}
              onChange={(e) => setMonthlyRateStr(e.target.value)}
              placeholder="Ex.: 1.8"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Data da 1ª parcela</span>
            <DatePicker value={startDate} onValueChange={setStartDate} ariaLabel="Data inicial" />
          </div>
        </div>

        {preview.schedule.length > 0 ? (
          <div className="rounded-md border border-border p-3 bg-muted/20 flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Primeira parcela:</span>
              <span className="font-semibold text-foreground">
                {formatCentsAsBRL(preview.schedule[0]?.amountCents ?? 0)}
              </span>
            </div>
            {system === "sac" && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Última parcela estimada:</span>
                <span className="font-semibold text-foreground">
                  {formatCentsAsBRL(preview.schedule[preview.schedule.length - 1]?.amountCents ?? 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total de juros estimados:</span>
              <span className="font-semibold text-warning">
                {formatCentsAsBRL(preview.totalInterestCents)}
              </span>
            </div>
          </div>
        ) : null}


        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim() || principalCents <= 0}>
            {pending ? "Criando contrato…" : "Salvar contrato"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
