import { TrendingUp } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText, Progress } from "@/components/ui";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { BusinessBreakEvenResult } from "@/domain/business";
import { buildBreakEvenBreakdown } from "@/domain/calculation-memory";
import { formatPercent } from "@/services/masks/percent";

export interface BreakEvenCardProps {
  breakEven: BusinessBreakEvenResult;
  operationalCostsCents: number;
  estimatedTaxCents: number;
  targetProLaboreCents: number;
  periodLabel: string;
}

/** Card de Ponto de Equilíbrio Mensal (Break-even incluindo custos, impostos e pró-labore). */
export function BreakEvenCard({
  breakEven,
  operationalCostsCents,
  estimatedTaxCents,
  targetProLaboreCents,
  periodLabel,
}: BreakEvenCardProps) {
  const breakdown = buildBreakEvenBreakdown(breakEven, {
    operationalCostsCents,
    estimatedTaxCents,
    targetProLaboreCents,
    periodLabel,
  });

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2.5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <CardTitle className="text-sm sm:text-base font-semibold line-clamp-2 break-words">
            Ponto de Equilíbrio ({periodLabel})
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={breakEven.isReached ? "positive" : "muted"} size="xs">
            {breakEven.isReached ? "Atingido" : `${formatPercent(breakEven.progressPct, 0)} da meta`}
          </Badge>
          <CalculationMemoryModal breakdown={breakdown} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5 text-xs sm:text-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Cobertura da meta de faturamento</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatPercent(breakEven.progressPct, 1)}
            </span>
          </div>
          <Progress
            value={Math.min(100, breakEven.progressPct)}
            tone={breakEven.isReached ? "positive" : "portfolio"}
            size="md"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Meta de faturamento</span>
            <MoneyText cents={breakEven.breakEvenTargetCents} tone="default" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Receita alcançada</span>
            <MoneyText cents={breakEven.grossRevenueCents} tone="positive" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">
              {breakEven.isReached ? "Excedente acima da meta" : "Falta faturar no mês"}
            </span>
            <MoneyText
              cents={breakEven.isReached ? breakEven.surplusAboveBreakEvenCents : breakEven.remainingCents}
              tone={breakEven.isReached ? "positive" : "default"}
              className="text-sm font-semibold"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Meta de Pró-Labore inclusa</span>
            <MoneyText cents={targetProLaboreCents} tone="default" className="text-sm font-semibold" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
