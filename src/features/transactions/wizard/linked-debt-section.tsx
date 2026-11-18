import { Checkbox, DatePicker, MoneyInput, RadioGroup } from "@/components/ui";
import type { DebtType } from "@/types";

export interface LinkedDebtSectionProps {
  debtEnabled: boolean;
  debtType: DebtType;
  debtAmountCents: number;
  debtDueDate: string;
  onDebtToggle: (enabled: boolean) => void;
  onDebtTypeChange: (type: DebtType) => void;
  onDebtAmountChange: (cents: number) => void;
  onDebtDueDateChange: (date: string) => void;
}

const DEBT_TYPE_OPTIONS: { value: DebtType; label: string }[] = [
  { value: "payable", label: "A pagar (minha dívida pendente)" },
  { value: "receivable", label: "A receber (reembolso / alguém me deve)" },
];

export function LinkedDebtSection({
  debtEnabled,
  debtType,
  debtAmountCents,
  debtDueDate,
  onDebtToggle,
  onDebtTypeChange,
  onDebtAmountChange,
  onDebtDueDateChange,
}: LinkedDebtSectionProps) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-border/80 pt-3">
      <Checkbox
        checked={debtEnabled}
        onCheckedChange={onDebtToggle}
        label="Criar cobrança vinculada"
      />
      {debtEnabled ? (
        <div className="flex flex-col gap-2.5 pl-4 sm:pl-6 pt-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Tipo de cobrança</span>
            <RadioGroup
              value={debtType}
              onValueChange={(val) => onDebtTypeChange(val as DebtType)}
              name="debt-type"
              options={DEBT_TYPE_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Valor da cobrança</span>
              <MoneyInput
                cents={debtAmountCents}
                onCentsChange={onDebtAmountChange}
                aria-label="Valor da cobrança vinculada"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Vencimento</span>
              <DatePicker value={debtDueDate} onValueChange={onDebtDueDateChange} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
