import {
  DatePicker,
  FormField,
  Input,
  MoneyInput,
  NumberStepper,
  PercentInput,
  Select,
} from "@/components/ui";
import { AMORTIZATION_SYSTEM_LABELS, LOAN_TYPE_LABELS } from "@/domain/loans";
import type { AmortizationSystem, LoanType } from "@/types";

const LOAN_TYPE_OPTIONS = (Object.keys(LOAN_TYPE_LABELS) as LoanType[]).map((key) => ({
  value: key,
  label: LOAN_TYPE_LABELS[key],
}));

const AMORTIZATION_OPTIONS = (Object.keys(AMORTIZATION_SYSTEM_LABELS) as AmortizationSystem[]).map(
  (key) => ({
    value: key,
    label: AMORTIZATION_SYSTEM_LABELS[key],
  }),
);

export interface LoanContractFieldsProps {
  idPrefix: string;
  name: string;
  onNameChange: (value: string) => void;
  nameLabel?: string;
  namePlaceholder?: string;
  nameRequired?: boolean;
  loanType: LoanType;
  onLoanTypeChange: (value: LoanType) => void;
  system: AmortizationSystem;
  onSystemChange: (value: AmortizationSystem) => void;
  principalCents: number;
  onPrincipalCentsChange: (cents: number) => void;
  principalLabel?: string;
  installmentsCount: number;
  onInstallmentsCountChange: (count: number) => void;
  installmentsLabel?: string;
  installmentsHelperText?: string;
  monthlyRatePercent: number;
  onMonthlyRatePercentChange: (rate: number) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  startDateLabel?: string;
  startDateAriaLabel?: string;
}

export function LoanContractFields({
  idPrefix,
  name,
  onNameChange,
  nameLabel = "Nome do contrato ou credor",
  namePlaceholder = "Ex.: Financiamento Carro, Empréstimo Caixa",
  nameRequired = false,
  loanType,
  onLoanTypeChange,
  system,
  onSystemChange,
  principalCents,
  onPrincipalCentsChange,
  principalLabel = "Valor financiado (principal)",
  installmentsCount,
  onInstallmentsCountChange,
  installmentsLabel = "Número de parcelas",
  installmentsHelperText,
  monthlyRatePercent,
  onMonthlyRatePercentChange,
  startDate,
  onStartDateChange,
  startDateLabel = "Data da 1ª parcela",
  startDateAriaLabel = "Data inicial",
}: LoanContractFieldsProps) {
  const nameId = `${idPrefix}-name`;
  const loanTypeId = `${idPrefix}-type`;
  const systemId = `${idPrefix}-system`;
  const principalId = `${idPrefix}-principal`;
  const rateId = `${idPrefix}-rate`;
  const startDateId = `${idPrefix}-start-date`;

  return (
    <>
      <FormField label={nameLabel} htmlFor={nameId}>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          required={nameRequired}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Tipo de crédito" htmlFor={loanTypeId}>
          <Select
            id={loanTypeId}
            value={loanType}
            onValueChange={(val) => onLoanTypeChange(val as LoanType)}
            options={LOAN_TYPE_OPTIONS}
            ariaLabel="Tipo de crédito"
          />
        </FormField>

        <FormField label="Sistema de amortização" htmlFor={systemId}>
          <Select
            id={systemId}
            value={system}
            onValueChange={(val) => onSystemChange(val as AmortizationSystem)}
            options={AMORTIZATION_OPTIONS}
            ariaLabel="Sistema de amortização"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label={principalLabel} htmlFor={principalId}>
          <MoneyInput
            id={principalId}
            cents={principalCents}
            onCentsChange={onPrincipalCentsChange}
            aria-label="Valor financiado"
          />
        </FormField>

        <FormField label={installmentsLabel} helperText={installmentsHelperText}>
          <NumberStepper
            editable
            min={1}
            max={420}
            step={1}
            value={installmentsCount}
            onValueChange={(val) => onInstallmentsCountChange(Math.max(1, Math.min(420, Math.round(val))))}
            ariaLabel="Número de parcelas"
            decreaseLabel="Diminuir número de parcelas"
            increaseLabel="Aumentar número de parcelas"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Taxa de juros (% a.m.)" htmlFor={rateId}>
          <PercentInput
            id={rateId}
            value={monthlyRatePercent}
            onValueChange={onMonthlyRatePercentChange}
            suffix="% a.m."
            aria-label="Taxa de juros (% a.m.)"
          />
        </FormField>

        <FormField label={startDateLabel} htmlFor={startDateId}>
          <DatePicker
            id={startDateId}
            value={startDate}
            onValueChange={onStartDateChange}
            ariaLabel={startDateAriaLabel}
          />
        </FormField>
      </div>
    </>
  );
}
