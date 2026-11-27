import { ArrowRight, TrendingDown } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import type { ReferenceBudgetSource } from "@/domain/insights";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { AlertCarouselCard } from "./alert-carousel-card";

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
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
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
  onSelectPreset,
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
  const baseLabel = resolveBaseDescriptionLabel(
    referenceBudgetSource,
    isProvisionalReference,
  );
  const policy = resolveCarouselCardPolicy("cashflow.pace");

  return (
    <AlertCarouselCard
      id="cashflow.pace"
      tone={isDeficit ? "critical" : "warning"}
      role="region"
      ariaLabel="Atenção ao ritmo de gastos"
      className={className}
      icon={<TrendingDown className="size-4.5" />}
      title={isDeficit ? "Projeção pede ajuste no mês" : "Ritmo acima do planejado"}
      badge={{
        label: isDeficit ? "Atenção ao ritmo" : "Ritmo acelerado",
        variant: isDeficit ? "critical" : "warning",
      }}
      description={
        <>
          Você utilizou {Math.round(spentPercent)}% da {baseLabel} (
          {Math.round(elapsedPercent)}% do mês).
          {dailyCents !== null && dailyCents > 0 ? (
            <>
              {" "}
              Para fechar no azul, mire em até{" "}
              <MoneyText
                cents={dailyCents}
                tone="default"
                className="font-semibold text-foreground"
              />
              /dia.
            </>
          ) : dailyCents === 0 ? (
            <> Orçamento mensal atingido.</>
          ) : null}
        </>
      }
      calculationBreakdown={calculationBreakdown}
      calculationMemoryLabel="Memória de cálculo do ritmo de gastos"
      primaryAction={{
        label: "Simular cortes e projeção",
        onClick: onNavigateInsights,
        variant: isDeficit ? "destructive" : "warning",
        icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar aviso de ritmo de gastos",
            }
          : undefined
      }
    />
  );
}
