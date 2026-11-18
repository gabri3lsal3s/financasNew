import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  MoneyInput,
  MoneyText,
  PercentInput,
} from "@/components/ui";
import type { SimulatorDebtInput } from "@/domain/debts";

interface DebtEditorRowProps {
  debt: SimulatorDebtInput;
  index: number;
  onUpdate: (id: string, updates: Partial<SimulatorDebtInput>) => void;
  onRemove: (id: string) => void;
}

function DebtEditorRow({ debt, index, onUpdate, onRemove }: DebtEditorRowProps) {
  const baseId = useId();
  const balanceId = `${baseId}-balance`;
  const rateId = `${baseId}-rate`;
  const minPayId = `${baseId}-min`;

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-surface-raised/50 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 max-w-xs min-w-0">
          <Input
            value={debt.name}
            onChange={(e) => onUpdate(debt.id, { name: e.target.value })}
            placeholder="Nome da Dívida"
            className="text-base sm:text-sm font-semibold"
            aria-label={`Nome da dívida ${index + 1}`}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(debt.id)}
          className="text-muted-foreground hover:text-critical-strong"
          aria-label={`Remover dívida ${debt.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Saldo Devedor" htmlFor={balanceId}>
          <MoneyInput
            id={balanceId}
            cents={debt.balanceCents}
            onCentsChange={(val) => onUpdate(debt.id, { balanceCents: val })}
            size="md"
            aria-label={`Saldo da dívida ${debt.name}`}
          />
        </FormField>

        <FormField label="Taxa de Juros (a.m.)" htmlFor={rateId}>
          <PercentInput
            id={rateId}
            value={debt.monthlyRatePercent}
            onValueChange={(val) => onUpdate(debt.id, { monthlyRatePercent: val })}
            size="md"
            aria-label={`Taxa de juros da dívida ${debt.name}`}
          />
        </FormField>

        <FormField label="Parcela Mínima" htmlFor={minPayId}>
          <MoneyInput
            id={minPayId}
            cents={debt.minPaymentCents}
            onCentsChange={(val) => onUpdate(debt.id, { minPaymentCents: val })}
            size="md"
            aria-label={`Parcela mínima da dívida ${debt.name}`}
          />
        </FormField>
      </div>
    </div>
  );
}

export interface DebtItemEditorListProps {
  debts: readonly SimulatorDebtInput[];
  extraBudgetCents: number;
  totalMinPaymentCents: number;
  onAddDebt: () => void;
  onUpdateDebt: (id: string, updates: Partial<SimulatorDebtInput>) => void;
  onRemoveDebt: (id: string) => void;
  onExtraBudgetChange: (cents: number) => void;
}

export function DebtItemEditorList({
  debts,
  extraBudgetCents,
  totalMinPaymentCents,
  onAddDebt,
  onUpdateDebt,
  onRemoveDebt,
  onExtraBudgetChange,
}: DebtItemEditorListProps) {
  const extraId = useId();

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <CardTitle className="text-base font-bold">Suas Dívidas Cadastradas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Insira cada dívida com saldo devedor atual, taxa mensal e parcela mínima.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddDebt}
          className="gap-1.5 self-start sm:self-auto text-xs"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>Adicionar Dívida</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {debts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma dívida adicionada. Clique em Adicionar Dívida para começar.
          </div>
        ) : (
          debts.map((debt, index) => (
            <DebtEditorRow
              key={debt.id}
              debt={debt}
              index={index}
              onUpdate={onUpdateDebt}
              onRemove={onRemoveDebt}
            />
          ))
        )}

        <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor={extraId} className="text-xs font-bold text-foreground block">
                Aporte Extra Mensal para Aceleração
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Valor mensal além da soma das parcelas mínimas (
                <MoneyText cents={totalMinPaymentCents} tone="default" className="inline font-medium" />
                ) dedicado exclusivamente para quitar a dívida prioritária.
              </p>
            </div>
            <div className="w-full sm:w-44 shrink-0">
              <MoneyInput
                id={extraId}
                cents={extraBudgetCents}
                onCentsChange={onExtraBudgetChange}
                size="md"
                aria-label="Aporte extra mensal para quitação"
              />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Orçamento mensal total do plano:{" "}
            <strong className="text-foreground">
              <MoneyText
                cents={totalMinPaymentCents + extraBudgetCents}
                tone="default"
                className="inline font-bold"
              />
              /mês
            </strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
