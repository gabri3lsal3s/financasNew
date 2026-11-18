import { Button, NumberStepper } from "@/components/ui";

export interface CalculatorInstallmentSplitterProps {
  installments: number;
  onInstallmentsChange: (value: number) => void;
  plan: string | null;
  onSplit: () => void;
}

/** Subcomponente para divisão exata em parcelas na calculadora monetária. */
export function CalculatorInstallmentSplitter({
  installments,
  onInstallmentsChange,
  plan,
  onSplit,
}: CalculatorInstallmentSplitterProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Dividir em parcelas</p>
        <NumberStepper
          value={installments}
          onValueChange={onInstallmentsChange}
          min={1}
          max={60}
          decreaseLabel="Diminuir parcelas"
          increaseLabel="Aumentar parcelas"
          className="w-36"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {plan ?? "Divisão exata em centavos (resto na primeira parcela)."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onSplit}>
          Dividir
        </Button>
      </div>
    </div>
  );
}
