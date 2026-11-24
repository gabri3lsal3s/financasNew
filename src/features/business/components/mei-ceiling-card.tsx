import { Gauge } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText, Progress } from "@/components/ui";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { MeiAnnualLimitResult } from "@/domain/business";
import { buildMeiCeilingBreakdown } from "@/domain/calculation-memory";
import { formatPercent } from "@/services/masks/percent";

export interface MeiCeilingCardProps {
  mei: MeiAnnualLimitResult;
  yearLabel: string;
}

const ALERT_BADGE_MAP: Record<
  MeiAnnualLimitResult["alertLevel"],
  { label: string; variant: "positive" | "warning" | "critical" }
> = {
  safe: { label: "Dentro do teto", variant: "positive" },
  attention: { label: "Atenção (70%+)", variant: "warning" },
  warning: { label: "Perto do teto (85%+)", variant: "critical" },
  ceiling_reached: { label: "Teto atingido", variant: "critical" },
  tolerance_exceeded: { label: "Acima de 120%", variant: "critical" },
};

/** Card do Termômetro do Teto Anual MEI (apuração acumulada em regime de caixa recebido). */
export function MeiCeilingCard({ mei, yearLabel }: MeiCeilingCardProps) {
  const breakdown = buildMeiCeilingBreakdown(mei, yearLabel);
  const badgeInfo = ALERT_BADGE_MAP[mei.alertLevel];
  const progressTone =
    mei.usagePct >= 85 ? "critical" : mei.usagePct >= 70 ? "warning" : "positive";

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2.5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Gauge className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <CardTitle className="text-sm sm:text-base font-semibold line-clamp-2 break-words">
            Termômetro Teto MEI ({yearLabel})
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={badgeInfo.variant} size="xs">
            {badgeInfo.label}
          </Badge>
          <CalculationMemoryModal breakdown={breakdown} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5 text-xs sm:text-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Utilização anual do limite</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatPercent(mei.usagePct, 1)}
            </span>
          </div>
          <Progress value={Math.min(100, mei.usagePct)} tone={progressTone} size="md" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Faturado no ano ({yearLabel})</span>
            <MoneyText cents={mei.annualGrossRevenueCents} tone="default" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Teto anual parametrizado</span>
            <MoneyText cents={mei.annualCeilingCents} tone="default" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Margem restante no teto</span>
            <MoneyText
              cents={mei.remainingCents}
              tone={mei.remainingCents > 0 ? "positive" : "negative"}
              className="text-sm font-semibold"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">
              Ritmo seguro ({mei.remainingMonths} mês(es))
            </span>
            <MoneyText cents={mei.monthlySafePaceCents} tone="default" className="text-sm font-semibold" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
