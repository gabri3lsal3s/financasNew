import { useId } from "react";
import { Card, CardContent, CardHeader, CardTitle, FormField, MoneyInput, MoneyText } from "@/components/ui";

export interface RebalanceKpiGridProps {
  patrimonyBaseCents: number;
  onPatrimonyBaseChange: (cents: number) => void;
  aporteAmountCents: number;
  onAporteAmountChange: (cents: number) => void;
  newTotalPatrimonyBRL: number;
  monthlyPassiveBRL: number;
  annualDividendsBRL: number;
}

export function RebalanceKpiGrid({
  patrimonyBaseCents,
  onPatrimonyBaseChange,
  aporteAmountCents,
  onAporteAmountChange,
  newTotalPatrimonyBRL,
  monthlyPassiveBRL,
  annualDividendsBRL,
}: RebalanceKpiGridProps) {
  const patrimonyId = useId();
  const aporteId = useId();

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Patrimônio Atual" htmlFor={patrimonyId}>
            <MoneyInput
              id={patrimonyId}
              cents={patrimonyBaseCents}
              onCentsChange={onPatrimonyBaseChange}
              size="md"
              aria-label="Patrimônio atual investido"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Valor do Próximo Aporte" htmlFor={aporteId}>
            <MoneyInput
              id={aporteId}
              cents={aporteAmountCents}
              onCentsChange={onAporteAmountChange}
              size="md"
              aria-label="Valor do próximo aporte"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Novo Patrimônio Projetado
          </span>
          <CardTitle className="text-xl sm:text-2xl font-bold pt-2">
            <MoneyText
              cents={Math.round(newTotalPatrimonyBRL * 100)}
              tone="default"
              variant="hero"
              animated
              className="font-bold text-xl sm:text-2xl"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Base + Novo Aporte</p>
        </CardContent>
      </Card>

      <Card className="border-positive/30 bg-positive/5 shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-positive-strong">
            Renda Passiva Mensal Estimada
          </span>
          <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong pt-2">
            <MoneyText
              cents={Math.round(monthlyPassiveBRL * 100)}
              tone="positive"
              variant="hero"
              animated
              className="font-bold text-xl sm:text-2xl"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            ~<MoneyText cents={Math.round(annualDividendsBRL * 100)} tone="default" className="inline font-medium" /> ao ano
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
