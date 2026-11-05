import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, History, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  NumberStepperInput,
  RadioGroup,
  Select,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { numberToCents } from "@/domain/money";
import {
  AMORTIZATION_SYSTEM_LABELS,
  LOAN_TYPE_LABELS,
  calculateLoanRenegotiation,
  calculatePaidAmortization,
  type LoanRenegotiationStrategy,
} from "@/domain/loans";
import { useRenegotiateLoanContract } from "@/state";
import type { AmortizationSystem, Debt, Loan, LoanType } from "@/types";

export interface LoanEditDialogProps {
  loan: Loan | null;
  debts?: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOAN_TYPE_OPTIONS = (Object.keys(LOAN_TYPE_LABELS) as LoanType[]).map((key) => ({
  value: key,
  label: LOAN_TYPE_LABELS[key],
}));

const AMORTIZATION_OPTIONS = (Object.keys(AMORTIZATION_SYSTEM_LABELS) as AmortizationSystem[]).map((key) => ({
  value: key,
  label: AMORTIZATION_SYSTEM_LABELS[key],
}));

interface LoanEditFormProps {
  loan: Loan;
  debts: Debt[];
  onClose: () => void;
}

function LoanEditForm({ loan, debts, onClose }: LoanEditFormProps) {
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

  // Estados do formulário
  const [strategy, setStrategy] = useState<LoanRenegotiationStrategy>("amortize_remaining");
  const [name, setName] = useState(loan.name);
  const [loanType, setLoanType] = useState<LoanType>(loan.loan_type);
  const [system, setSystem] = useState<AmortizationSystem>(loan.amortization_system);
  const [monthlyRateStr, setMonthlyRateStr] = useState(String(loan.interest_rate_monthly));

  // Se tem parcelas pagas e está repactuando, o saldo devedor inicial é o restante
  const [principalCents, setPrincipalCents] = useState(
    hasPaid ? paidInfo.remainingBalanceCents : numberToCents(loan.principal_amount),
  );

  // Quantidade de parcelas (restantes na repactuação, ou total no reset)
  const [installmentsCount, setInstallmentsCount] = useState(
    hasPaid
      ? Math.max(1, loan.total_installments - paidInfo.paidCount)
      : loan.total_installments,
  );

  const [startDate, setStartDate] = useState(
    hasPaid ? paidInfo.nextSuggestedDueDate : loan.start_date,
  );

  const [error, setError] = useState<string | null>(null);

  const actualRate = parseFloat(monthlyRateStr.replace(",", ".")) || 0;

  // Preview em tempo real do recálculo
  const preview = useMemo(() => {
    return calculateLoanRenegotiation(loan, contractDebts, {
      name: name.trim(),
      loanType,
      principalCents,
      installmentsCount,
      monthlyRatePercent: actualRate,
      system,
      startDate,
      strategy: hasPaid ? strategy : "reset",
    });
  }, [
    loan,
    contractDebts,
    name,
    loanType,
    principalCents,
    installmentsCount,
    actualRate,
    system,
    startDate,
    strategy,
    hasPaid,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome do contrato ou instituição credora.");
      return;
    }

    if (principalCents <= 0) {
      setError("O valor a financiar deve ser maior que zero.");
      return;
    }

    if (installmentsCount < 1) {
      setError("O número de parcelas deve ser pelo menos 1.");
      return;
    }

    const effectiveStrategy = hasPaid ? strategy : "reset";

    try {
      await renegotiateLoan.mutateAsync({
        loanId: loan.id,
        name: trimmedName,
        loanType,
        principalAmount:
          effectiveStrategy === "amortize_remaining"
            ? loan.principal_amount
            : principalCents / 100,
        interestRateMonthly: actualRate,
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

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* Card de Status do Histórico quando há parcelas quitadas */}
      {hasPaid ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface-hover/30 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                Histórico do Contrato
              </span>
            </div>
            <Badge variant="positive" size="sm">
              <CheckCircle2 className="size-3 mr-1" aria-hidden="true" />
              {paidInfo.paidCount} de {loan.total_installments} parcelas quitadas
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-surface border border-border/40">
              <span className="text-muted-foreground">Total já quitado:</span>
              <span className="font-semibold text-positive-strong">
                <MoneyText cents={paidInfo.totalPaidAmountCents} />
              </span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-surface border border-border/40">
              <span className="text-muted-foreground">Saldo restante amortizado:</span>
              <span className="font-semibold text-foreground">
                <MoneyText cents={paidInfo.remainingBalanceCents} />
              </span>
            </div>
          </div>

          {/* Seletor de Estratégia de Edição */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
            <span className="text-xs font-semibold text-foreground">
              Como deseja aplicar as alterações?
            </span>
            <RadioGroup
              value={strategy}
              onValueChange={(val) => setStrategy(val as LoanRenegotiationStrategy)}
              name="renegotiation-strategy"
              options={[
                {
                  value: "amortize_remaining",
                  label: "Repactuar saldo restante (Recomendado — mantém as parcelas quitadas)",
                },
                {
                  value: "reset",
                  label: "Recalcular contrato inteiro do zero (descarta histórico de quitação)",
                },
              ]}
            />
          </div>
        </div>
      ) : null}

      {/* Dados Principais */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-loan-name" className="text-xs font-semibold text-foreground">
          Nome do Contrato / Credor
        </label>
        <Input
          id="edit-loan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Financiamento Imobiliário Caixa"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-loan-type" className="text-xs font-semibold text-foreground">
            Tipo de Crédito
          </label>
          <Select
            value={loanType}
            onValueChange={(val) => setLoanType(val as LoanType)}
            options={LOAN_TYPE_OPTIONS}
            ariaLabel="Tipo de crédito"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-loan-system" className="text-xs font-semibold text-foreground">
            Sistema de Amortização
          </label>
          <Select
            value={system}
            onValueChange={(val) => setSystem(val as AmortizationSystem)}
            options={AMORTIZATION_OPTIONS}
            ariaLabel="Sistema de amortização"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-loan-principal" className="text-xs font-semibold text-foreground">
            {hasPaid && strategy === "amortize_remaining"
              ? "Saldo a financiar (restante amortizado)"
              : "Valor financiado (principal)"}
          </label>
          <MoneyInput
            id="edit-loan-principal"
            cents={principalCents}
            onCentsChange={setPrincipalCents}
            aria-label="Valor financiado"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-loan-installments" className="text-xs font-semibold text-foreground">
            {hasPaid && strategy === "amortize_remaining"
              ? "Novas parcelas restantes a pagar"
              : "Total de parcelas"}
          </label>
          <NumberStepperInput
            min={1}
            max={420}
            step={1}
            value={installmentsCount}
            onValueChange={(val) => setInstallmentsCount(Math.max(1, parseInt(val, 10) || 1))}
            ariaLabel="Número de parcelas"
          />
          {hasPaid && strategy === "amortize_remaining" ? (
            <span className="text-[11px] text-muted-foreground">
              Total resultante: {paidInfo.paidCount} pagas + {installmentsCount} restantes = {paidInfo.paidCount + installmentsCount} parcelas.
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-loan-rate" className="text-xs font-semibold text-foreground">
            Taxa de juros (% a.m.)
          </label>
          <Input
            id="edit-loan-rate"
            value={monthlyRateStr}
            onChange={(e) => setMonthlyRateStr(e.target.value)}
            placeholder="Ex.: 1.8"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {hasPaid && strategy === "amortize_remaining"
              ? "Vencimento da próxima parcela"
              : "Data da 1ª parcela"}
          </span>
          <DatePicker
            value={startDate}
            onValueChange={setStartDate}
            ariaLabel="Data de vencimento"
          />
        </div>
      </div>

      {/* Live Preview Comparativo em Tempo Real */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
          <Sparkles className="size-4" aria-hidden="true" />
          <span>Simulação do Novo Cronograma em Tempo Real</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/60">
            <span className="text-[11px] text-muted-foreground">Nova Parcela Estimada</span>
            <span className="text-sm font-bold text-foreground font-mono">
              {formatCentsAsBRL(preview.firstInstallmentAmountCents)}
            </span>
            {system === "sac" ? (
              <span className="text-[10px] text-muted-foreground">
                decrescendo até {formatCentsAsBRL(preview.lastInstallmentAmountCents)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/60">
            <span className="text-[11px] text-muted-foreground">Prazo Total Resultante</span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <span className="text-muted-foreground font-normal line-through">
                {loan.total_installments}x
              </span>
              <ArrowRight className="size-3 text-primary-strong" aria-hidden="true" />
              <span>{preview.newTotalInstallments}x</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {preview.remainingCount} parcelas a gerar
            </span>
          </div>

          <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/60">
            <span className="text-[11px] text-muted-foreground">Total de Juros Estimados</span>
            <span className="text-sm font-bold text-warning-strong font-mono">
              {formatCentsAsBRL(preview.totalEstimatedInterestCents)}
            </span>
            <span className="text-[10px] text-muted-foreground">sobre o saldo a pagar</span>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={renegotiateLoan.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={renegotiateLoan.isPending || !name.trim() || principalCents <= 0}
        >
          {renegotiateLoan.isPending ? "Recalculando parcelas…" : "Salvar e Atualizar Parcelas"}
        </Button>
      </ModalFooter>
    </form>
  );
}

/**
 * Diálogo inteligente para edição, recálculo e repactuação de contratos de crédito,
 * com atualização automática de parcelas, valores, juros e amortização.
 */
export function LoanEditDialog({
  loan,
  debts = [],
  open,
  onOpenChange,
}: LoanEditDialogProps) {
  if (!loan) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar e Repactuar Contrato"
      description="Atualize parcelas, taxas, prazos ou valor financiado com recálculo automático."
      size="xl"
      showCalculator
    >
      {open && (
        <LoanEditForm
          key={loan.id}
          loan={loan}
          debts={debts}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}
