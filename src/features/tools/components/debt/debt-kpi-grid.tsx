import { Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import type { DebtComparisonResult } from "@/domain/debts";

export interface DebtKpiGridProps {
  totalBalanceCents: number;
  debtsCount: number;
  comparison: DebtComparisonResult;
}

export function DebtKpiGrid({
  totalBalanceCents,
  debtsCount,
  comparison,
}: DebtKpiGridProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-muted-foreground">Saldo Devedor Total</span>
          <CardTitle className="text-xl sm:text-2xl font-bold">
            <MoneyText cents={totalBalanceCents} tone="default" variant="hero" animated className="font-bold text-xl sm:text-2xl" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{debtsCount} dívida(s) no plano</p>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Tempo de Quitação (Avalanche)
          </span>
          <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong font-mono tabular-nums">
            {comparison.avalanche.totalMonths} meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            vs {comparison.snowball.totalMonths} meses na Bola de Neve
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Juros Pagos (Avalanche)
          </span>
          <CardTitle className="text-xl sm:text-2xl font-bold">
            <MoneyText
              cents={comparison.avalanche.totalInterestCents}
              tone="negative"
              variant="hero"
              animated
              className="font-bold text-xl sm:text-2xl"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Bola de Neve:{" "}
            <MoneyText
              cents={comparison.snowball.totalInterestCents}
              tone="default"
              className="inline font-medium"
            />
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5 shadow-xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold text-primary-strong dark:text-primary">
            Economia com Avalanche
          </span>
          <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
            <MoneyText
              cents={comparison.interestSavedWithAvalancheCents}
              tone="positive"
              className="font-bold text-xl sm:text-2xl"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Economia direta em juros bancários</p>
        </CardContent>
      </Card>
    </section>
  );
}
