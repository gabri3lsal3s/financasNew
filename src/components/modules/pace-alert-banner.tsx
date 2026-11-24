import { ArrowRight, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import type { ReferenceBudgetSource } from "@/domain/insights";
import { cn } from "@/lib/utils";
import { CalculationMemoryModal } from "./calculation-memory";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

export interface PaceAlertBannerProps {
  /** % do orçamento já gasto (0–100+). */
  spentPercent: number;
  /** % do mês decorrido (0–100). */
  elapsedPercent: number;
  /** Valor diário disponível em centavos (ou null se indisponível). */
  dailyCents: number | null;
  /** Dias restantes no mês (ou null). */
  daysRemaining: number | null;
  /** Superávit/Déficit projetado em centavos (ou null). */
  surplusCents: number | null;
  /** Indica se a base de cálculo é estimada/provisória. */
  isProvisionalReference?: boolean;
  /** Origem canônica da base mensal de referência. */
  referenceBudgetSource?: ReferenceBudgetSource;
  /** Memória de cálculo opcional para explicar o ritmo e a projeção ao usuário (?). */
  calculationBreakdown?: CalculationBreakdown;
  /** Callback para navegar à tela de Insights/Projeção. */
  onNavigateInsights: () => void;
  onDismiss?: (days: 7 | 30) => void;
  className?: string;
}

function resolveBaseDescriptionLabel(
  source?: ReferenceBudgetSource,
  isProvisional?: boolean,
): string {
  switch (source) {
    case "expected_income":
      return "renda habitual prevista";
    case "current_plus_expected_income":
      return "renda esperada do mês";
    case "category_budgets":
      return "meta de orçamentos";
    case "current_income":
      return "referência mensal";
    default:
      return isProvisional ? "referência prevista" : "referência mensal";
  }
}

/**
 * PaceAlertBanner — Banner contextual consultivo de ritmo de gastos (§3.8 / Fase 3).
 * Exibido na Visão Geral somente com base válida, sem divisões por 1 centavo.
 */
export function PaceAlertBanner({
  spentPercent,
  elapsedPercent,
  dailyCents,
  surplusCents,
  isProvisionalReference = false,
  referenceBudgetSource,
  calculationBreakdown,
  onNavigateInsights,
  onDismiss,
  className,
}: PaceAlertBannerProps) {
  if (
    !Number.isFinite(spentPercent) ||
    spentPercent <= 0 ||
    (dailyCents === null && surplusCents === null)
  ) {
    return null;
  }

  const isDeficit = surplusCents !== null && surplusCents < 0;
  const baseLabel = resolveBaseDescriptionLabel(referenceBudgetSource, isProvisionalReference);

  return (
    <section
      aria-label="Atenção ao ritmo de gastos"
      className={cn(
        "relative group w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 transition-all shadow-xs",
        isDeficit
          ? "border-critical/40 bg-critical/5 text-foreground"
          : "border-warning/40 bg-warning/5 text-foreground",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            isDeficit
              ? "bg-critical/10 border-critical/20 text-critical-strong"
              : "bg-warning/15 border-warning/20 text-warning-strong",
          )}
          aria-hidden="true"
        >
          <TrendingDown className="size-4.5" />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2
              className="text-sm font-semibold text-foreground truncate"
              title={isDeficit ? "Projeção pede ajuste no mês" : "Ritmo acima do planejado"}
            >
              {isDeficit ? "Projeção pede ajuste no mês" : "Ritmo acima do planejado"}
            </h2>
            <Badge
              variant={isDeficit ? "critical" : "warning"}
              size="xs"
              className="uppercase tracking-wider font-semibold"
            >
              {isDeficit ? "Atenção ao ritmo" : "Ritmo acelerado"}
            </Badge>
            {calculationBreakdown ? (
              <CalculationMemoryModal
                breakdown={calculationBreakdown}
                priority="p0"
                label="Memória de cálculo do ritmo de gastos"
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
            Você utilizou {Math.round(spentPercent)}% da {baseLabel} ({Math.round(elapsedPercent)}% do mês).
            {dailyCents !== null && dailyCents > 0 ? (
              <>
                {" "}Para fechar no azul, mire em até{" "}
                <MoneyText cents={dailyCents} tone="default" className="font-semibold text-foreground" />/dia.
              </>
            ) : dailyCents === 0 ? (
              <> Orçamento mensal atingido.</>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          variant={isDeficit ? "destructive" : "warning"}
          onClick={onNavigateInsights}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer flex-1 sm:flex-initial justify-center"
        >
          <span>Simular cortes e projeção</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss && (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover onDismiss={onDismiss} label="Dispensar aviso de ritmo de gastos" />
          </div>
        )}
      </div>
    </section>
  );
}
