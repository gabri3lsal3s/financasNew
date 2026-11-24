import { Briefcase } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { BusinessDreResult } from "@/domain/business";
import { buildBusinessDreBreakdown } from "@/domain/calculation-memory";
import { formatPercent } from "@/services/masks/percent";

export interface BusinessDreCardProps {
  dre: BusinessDreResult;
  periodLabel: string;
}

/** Card do DRE Simplificado Mensal (Regime de Competência PJ). */
export function BusinessDreCard({ dre, periodLabel }: BusinessDreCardProps) {
  const breakdown = buildBusinessDreBreakdown(dre, periodLabel);

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2.5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <CardTitle className="text-sm sm:text-base font-semibold line-clamp-2 break-words">
            DRE Simplificado
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={dre.netProfitAfterTaxCents >= 0 ? "positive" : "critical"} size="xs">
            Margem {formatPercent(dre.marginPct, 1)}
          </Badge>
          <CalculationMemoryModal breakdown={breakdown} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 text-xs sm:text-sm">
        <DreRow label="(+) Receita Bruta PJ" cents={dre.grossRevenueCents} tone="positive" />
        <DreRow
          label="(-) Custos Operacionais e Encargos"
          cents={-Math.abs(dre.operationalCostsCents)}
          tone="negative"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/80 pt-2">
          <span className="font-medium text-foreground">(=) Lucro Operacional</span>
          <MoneyText
            cents={dre.operationalProfitCents}
            tone={dre.operationalProfitCents >= 0 ? "positive" : "negative"}
            className="font-semibold"
          />
        </div>
        <DreRow
          label="(-) Impostos Fiscais Pagos (DAS / ISS)"
          cents={-Math.abs(dre.fiscalTaxesPaidCents)}
          tone="negative"
        />
        <DreRow
          label="(-) Pró-Labore e Distribuição (PJ para PF)"
          cents={-Math.abs(dre.proLaboreWithdrawnCents)}
          tone="default"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/80 pt-2.5">
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground">Lucro Retido no Caixa PJ</span>
            {dre.pendingReceivablesCents > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                A receber pendente:{" "}
                <MoneyText
                  cents={dre.pendingReceivablesCents}
                  tone="default"
                  variant="caption"
                  className="text-[11px]"
                />
              </span>
            ) : null}
          </div>
          <MoneyText
            cents={dre.retainedEarningsCents}
            tone={dre.retainedEarningsCents >= 0 ? "positive" : "negative"}
            className="text-base sm:text-lg font-bold"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DreRow({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone: "positive" | "negative" | "default";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <MoneyText cents={cents} tone={tone} className="font-medium" />
    </div>
  );
}
