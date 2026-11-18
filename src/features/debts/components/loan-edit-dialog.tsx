import { useId, useMemo, useState } from "react";
import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import {
  calculateLoanRenegotiation,
  calculatePaidAmortization,
  type LoanRenegotiationStrategy,
} from "@/domain/loans";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useRenegotiateLoanContract } from "@/state";
import type { AmortizationSystem, Debt, Loan, LoanType } from "@/types";
import { LoanContractFields } from "./loan-contract-fields";
import { LoanRenegotiationHistoryCard } from "./loan-renegotiation-history-card";
import { LoanRenegotiationPreview } from "./loan-renegotiation-preview";

export interface LoanEditDialogProps {
  loan: Loan | null;
  debts?: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoanEditFormProps {
  loan: Loan;
  debts: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LoanEditForm({ loan, debts, open, onOpenChange }: LoanEditFormProps) {
  const formId = useId();
  const renegotiateLoan = useRenegotiateLoanContract();

  const contractDebts = useMemo(
    () => debts.filter((d) => d.installment_group_id === loan.installment_group_id),
    [debts, loan.installment_group_id],
  );
  const paidInfo = useMemo(
    () => calculatePaidAmortization(loan, contractDebts),
    [loan, contractDebts],
  );
  const hasPaid = paidInfo.paidCount > 0;

  const [strategy, setStrategy] = useState<LoanRenegotiationStrategy>("amortize_remaining");
  const [name, setName] = useState(loan.name);
  const [loanType, setLoanType] = useState<LoanType>(loan.loan_type);
  const [system, setSystem] = useState<AmortizationSystem>(loan.amortization_system);
  const [monthlyRatePercent, setMonthlyRatePercent] = useState(loan.interest_rate_monthly);
  const [principalCents, setPrincipalCents] = useState(
    hasPaid ? paidInfo.remainingBalanceCents : numberToCents(loan.principal_amount),
  );
  const [installmentsCount, setInstallmentsCount] = useState(
    hasPaid ? Math.max(1, loan.total_installments - paidInfo.paidCount) : loan.total_installments,
  );
  const [startDate, setStartDate] = useState(
    hasPaid ? paidInfo.nextSuggestedDueDate : loan.start_date,
  );
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      calculateLoanRenegotiation(loan, contractDebts, {
        name: name.trim(),
        loanType,
        principalCents,
        installmentsCount,
        monthlyRatePercent,
        system,
        startDate,
        strategy: hasPaid ? strategy : "reset",
      }),
    [loan, contractDebts, name, loanType, principalCents, installmentsCount, monthlyRatePercent, system, startDate, strategy, hasPaid],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      triggerSensory("error");
      setError("Informe o nome do contrato ou instituição credora.");
      return;
    }
    if (principalCents <= 0) {
      triggerSensory("error");
      setError("O valor a financiar deve ser maior que zero.");
      return;
    }
    if (installmentsCount < 1) {
      triggerSensory("error");
      setError("O número de parcelas deve ser pelo menos 1.");
      return;
    }

    const effectiveStrategy = hasPaid ? strategy : "reset";
    try {
      await renegotiateLoan.mutateAsync({
        loanId: loan.id,
        name: trimmedName,
        loanType,
        principalAmount: effectiveStrategy === "amortize_remaining" ? loan.principal_amount : principalCents / 100,
        interestRateMonthly: monthlyRatePercent,
        amortizationSystem: system,
        totalInstallments: preview.newTotalInstallments,
        startDate: effectiveStrategy === "amortize_remaining" ? loan.start_date : startDate,
        strategy: effectiveStrategy,
        installments: preview.scheduleToInsert.map((item) => ({
          installment_number: item.installmentNumber,
          due_date: item.dueDate,
          amount: item.amountCents / 100,
        })),
      });
      triggerSensory("success");
      pushToast({
        title: "Contrato atualizado com sucesso!",
        description: `O cronograma foi recalculado com ${preview.newTotalInstallments} parcelas.`,
        variant: "default",
      });
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const isAmortizing = hasPaid && strategy === "amortize_remaining";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar e Repactuar Contrato"
      description="Atualize parcelas, taxas, prazos ou valor financiado com recálculo automático."
      size="xl"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={renegotiateLoan.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={renegotiateLoan.isPending || !name.trim() || principalCents <= 0}
          >
            {renegotiateLoan.isPending ? "Recalculando parcelas…" : "Salvar e Atualizar Parcelas"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {hasPaid ? (
          <LoanRenegotiationHistoryCard
            paidCount={paidInfo.paidCount}
            totalInstallments={loan.total_installments}
            totalPaidAmountCents={paidInfo.totalPaidAmountCents}
            remainingBalanceCents={paidInfo.remainingBalanceCents}
            strategy={strategy}
            onStrategyChange={setStrategy}
          />
        ) : null}

        <LoanContractFields
          idPrefix="edit-loan"
          name={name}
          onNameChange={setName}
          nameLabel="Nome do contrato / credor"
          namePlaceholder="Ex.: Financiamento Imobiliário Caixa"
          nameRequired
          loanType={loanType}
          onLoanTypeChange={setLoanType}
          system={system}
          onSystemChange={setSystem}
          principalCents={principalCents}
          onPrincipalCentsChange={setPrincipalCents}
          principalLabel={isAmortizing ? "Saldo a financiar (restante amortizado)" : "Valor financiado (principal)"}
          installmentsCount={installmentsCount}
          onInstallmentsCountChange={setInstallmentsCount}
          installmentsLabel={isAmortizing ? "Novas parcelas restantes a pagar" : "Total de parcelas"}
          installmentsHelperText={
            isAmortizing
              ? `Total resultante: ${paidInfo.paidCount} pagas + ${installmentsCount} restantes = ${paidInfo.paidCount + installmentsCount} parcelas.`
              : undefined
          }
          monthlyRatePercent={monthlyRatePercent}
          onMonthlyRatePercentChange={setMonthlyRatePercent}
          startDate={startDate}
          onStartDateChange={setStartDate}
          startDateLabel={isAmortizing ? "Vencimento da próxima parcela" : "Data da 1ª parcela"}
          startDateAriaLabel="Data de vencimento"
        />

        <LoanRenegotiationPreview preview={preview} previousTotalInstallments={loan.total_installments} system={system} />
      </form>
    </Modal>
  );
}

/** Diálogo para edição, recálculo e repactuação de contratos de crédito. */
export function LoanEditDialog({ loan, debts = [], open, onOpenChange }: LoanEditDialogProps) {
  if (!loan || !open) return null;
  return <LoanEditForm key={loan.id} loan={loan} debts={debts} open={open} onOpenChange={onOpenChange} />;
}
