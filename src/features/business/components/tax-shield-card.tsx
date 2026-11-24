import { ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText, Progress } from "@/components/ui";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { TaxShieldResult } from "@/domain/business";
import { buildTaxShieldBreakdown } from "@/domain/calculation-memory";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import { formatPercent } from "@/services/masks/percent";
import type { BusinessProfileKind } from "@/types";

export interface TaxShieldCardProps {
  shield: TaxShieldResult;
  profileKind: BusinessProfileKind;
  grossRevenueCents: number;
  periodLabel: string;
}

/** Card do Escudo Tributário Líquido (provisão vs impostos fiscais pagos e dedutíveis). */
export function TaxShieldCard({
  shield,
  profileKind,
  grossRevenueCents,
  periodLabel,
}: TaxShieldCardProps) {
  const profileLabel = BUSINESS_PROFILE_LABELS[profileKind] ?? profileKind;
  const breakdown = buildTaxShieldBreakdown(shield, {
    profileLabel,
    grossRevenueCents,
    periodLabel,
  });

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2.5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="size-4 shrink-0 text-positive-strong" aria-hidden="true" />
          <CardTitle className="text-sm sm:text-base font-semibold line-clamp-2 break-words">
            Escudo Tributário Líquido
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={shield.isFullyCovered ? "positive" : "warning"} size="xs">
            {shield.isFullyCovered ? "Coberto" : "A provisionar"}
          </Badge>
          <CalculationMemoryModal breakdown={breakdown} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5 text-xs sm:text-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Cobertura tributária do período</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatPercent(shield.coveragePct, 1)}
            </span>
          </div>
          <Progress
            value={shield.coveragePct}
            tone={shield.isFullyCovered ? "positive" : "warning"}
            size="md"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Provisão estimada ({profileLabel})</span>
            <MoneyText cents={shield.estimatedTaxCents} tone="default" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Imposto fiscal pago</span>
            <MoneyText cents={shield.paidFiscalTaxesCents} tone="positive" className="text-sm font-semibold" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Saldo ainda a reservar</span>
            <MoneyText
              cents={shield.netProvisionRemainingCents}
              tone={shield.netProvisionRemainingCents > 0 ? "negative" : "positive"}
              className="text-sm font-semibold"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Despesas dedutíveis (Livro-Caixa)</span>
            <MoneyText cents={shield.deductibleExpensesCents} tone="default" className="text-sm font-semibold" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
