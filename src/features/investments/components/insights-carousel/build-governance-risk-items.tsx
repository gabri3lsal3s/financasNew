import { AlertTriangle, ShieldAlert, TrendingDown } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export function buildGovernanceRiskItems({
  lowScoreRiskCount,
  quarantinedCount,
  discountOpportunitiesCount,
  lowScoreBreakdown,
  discountBreakdown,
  isCardVisible,
  onSelectPreset,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: {
  lowScoreRiskCount: number;
  quarantinedCount: number;
  discountOpportunitiesCount: number;
  lowScoreBreakdown?: CalculationBreakdown;
  discountBreakdown?: CalculationBreakdown;
  isCardVisible?: (cardKey: string) => boolean;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  isAlertDismissed?: (alertId: string, fingerprint: string) => boolean;
  dismissAlert?: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  const isLowScoreVisible =
    (isCardVisible ? isCardVisible("portfolio.low_score_risk") : true) &&
    !(isAlertDismissed?.("low-score-risk-alert", String(lowScoreRiskCount)) ?? false);
  const isQuarantineVisible =
    (isCardVisible ? isCardVisible("portfolio.quarantine") : true) &&
    !(isAlertDismissed?.("quarantine-governance-alert", String(quarantinedCount)) ?? false);
  const isDiscountVisible =
    (isCardVisible ? isCardVisible("portfolio.discount_opportunity") : true) &&
    !(isAlertDismissed?.("discount-opportunity-alert", String(discountOpportunitiesCount)) ?? false);

  const lowScorePolicy = resolveCarouselCardPolicy("portfolio.low_score_risk");
  const quarantinePolicy = resolveCarouselCardPolicy("portfolio.quarantine");
  const discountPolicy = resolveCarouselCardPolicy("portfolio.discount_opportunity");

  return [
    lowScoreRiskCount > 0 &&
      isLowScoreVisible && {
        id: "portfolio.low_score_risk",
        priority: 8,
        content: (
          <AlertCarouselCard
            id="portfolio.low_score_risk"
            tone="critical"
            icon={<AlertTriangle className="size-4.5" />}
            title="Concentração em Baixa Convicção"
            badge={{
              label: `${lowScoreRiskCount} ${lowScoreRiskCount === 1 ? "ativo" : "ativos"}`,
              variant: "critical",
            }}
            description="Ativos com nota baixa (≤ 4) representam mais de 5% da carteira. Avalie reduzir exposição."
            calculationBreakdown={lowScoreBreakdown}
            className={className}
            primaryAction={{
              label: "Auditar Carteira",
              onClick: () => onNavigate("/investments?tab=metas"),
              variant: "outline",
            }}
            dismissPolicy={{
              allowedPresets: lowScorePolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.low_score_risk", preset);
                } else {
                  dismissAlert?.(
                    "low-score-risk-alert",
                    preset === "7d" ? 7 : 30,
                    String(lowScoreRiskCount),
                  );
                }
              },
            }}
          />
        ),
      },

    quarantinedCount > 0 &&
      isQuarantineVisible && {
        id: "portfolio.quarantine",
        priority: 9,
        content: (
          <AlertCarouselCard
            id="portfolio.quarantine"
            tone="warning"
            icon={<ShieldAlert className="size-4.5" />}
            title="Ativos em Quarentena"
            badge={{
              label: `${quarantinedCount} em observação`,
              variant: "warning",
            }}
            description={
              quarantinedCount === 1
                ? "1 ativo está com aporte bloqueado aguardando auditoria de fundamentos."
                : `${quarantinedCount} ativos estão com aportes bloqueados aguardando auditoria de fundamentos.`
            }
            className={className}
            primaryAction={{
              label: "Auditar Carteira",
              onClick: () => onNavigate("/investments?tab=metas"),
              variant: "outline",
            }}
            dismissPolicy={{
              allowedPresets: quarantinePolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.quarantine", preset);
                } else {
                  dismissAlert?.(
                    "quarantine-governance-alert",
                    preset === "7d" ? 7 : 30,
                    String(quarantinedCount),
                  );
                }
              },
            }}
          />
        ),
      },

    discountOpportunitiesCount > 0 &&
      isDiscountVisible && {
        id: "portfolio.discount_opportunity",
        priority: 10,
        content: (
          <AlertCarouselCard
            id="portfolio.discount_opportunity"
            tone="positive"
            icon={<TrendingDown className="size-4.5" />}
            title="Oportunidade em Desconto"
            badge={{
              label: `${discountOpportunitiesCount} ${discountOpportunitiesCount === 1 ? "ativo" : "ativos"}`,
              variant: "positive",
            }}
            description="Ativos de alta convicção (Nota ≥ 8) com margem de segurança frente ao Preço Teto."
            calculationBreakdown={discountBreakdown}
            className={className}
            primaryAction={{
              label: "Simular Aporte",
              onClick: () => onNavigate("/investments?tab=aporte"),
              variant: "default",
            }}
            dismissPolicy={{
              allowedPresets: discountPolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.discount_opportunity", preset);
                } else {
                  dismissAlert?.(
                    "discount-opportunity-alert",
                    preset === "7d" ? 7 : 30,
                    String(discountOpportunitiesCount),
                  );
                }
              },
            }}
          />
        ),
      },
  ];
}
