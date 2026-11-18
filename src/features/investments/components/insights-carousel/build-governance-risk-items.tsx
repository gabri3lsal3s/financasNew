import { AlertTriangle, ShieldAlert, TrendingDown } from "lucide-react";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { InsightSlide } from "./insight-slide";

export function buildGovernanceRiskItems({
  lowScoreRiskCount,
  quarantinedCount,
  discountOpportunitiesCount,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: {
  lowScoreRiskCount: number;
  quarantinedCount: number;
  discountOpportunitiesCount: number;
  isAlertDismissed: (alertId: string, fingerprint: string) => boolean;
  dismissAlert: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  return [
    lowScoreRiskCount > 0 &&
      !isAlertDismissed("low-score-risk-alert", String(lowScoreRiskCount)) && {
        id: "low-score-risk-alert",
        priority: 8,
        content: (
          <InsightSlide
            tone="critical"
            icon={<AlertTriangle className="size-4.5" />}
            title="Concentração em Baixa Convicção"
            badgeText={`${lowScoreRiskCount} ${lowScoreRiskCount === 1 ? "ativo" : "ativos"}`}
            badgeVariant="critical"
            description="Ativos com nota baixa (≤ 4) representam mais de 5% da carteira. Avalie reduzir exposição."
            onDismiss={(days) => dismissAlert("low-score-risk-alert", days, String(lowScoreRiskCount))}
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("/investments?tab=rebalancear&view=metas&subtab=assets")}
              >
                Auditar Carteira
              </Button>
            }
          />
        ),
      },

    quarantinedCount > 0 &&
      !isAlertDismissed("quarantine-governance-alert", String(quarantinedCount)) && {
        id: "quarantine-governance-alert",
        priority: 9,
        content: (
          <InsightSlide
            tone="warning"
            icon={<ShieldAlert className="size-4.5" />}
            title="Ativos em Quarentena"
            badgeText={`${quarantinedCount} em observação`}
            badgeVariant="warning"
            description={
              quarantinedCount === 1
                ? "1 ativo está com aporte bloqueado aguardando auditoria de fundamentos."
                : `${quarantinedCount} ativos estão com aportes bloqueados aguardando auditoria de fundamentos.`
            }
            onDismiss={(days) =>
              dismissAlert("quarantine-governance-alert", days, String(quarantinedCount))
            }
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("/investments?tab=rebalancear&view=metas&subtab=assets")}
              >
                Auditar Carteira
              </Button>
            }
          />
        ),
      },

    discountOpportunitiesCount > 0 &&
      !isAlertDismissed("discount-opportunity-alert", String(discountOpportunitiesCount)) && {
        id: "discount-opportunity-alert",
        priority: 10,
        content: (
          <InsightSlide
            tone="positive"
            icon={<TrendingDown className="size-4.5" />}
            title="Oportunidade em Desconto"
            badgeText={`${discountOpportunitiesCount} ${discountOpportunitiesCount === 1 ? "ativo" : "ativos"}`}
            badgeVariant="positive"
            description="Ativos de alta convicção (Nota ≥ 8) cotados abaixo do seu preço médio histórico."
            onDismiss={(days) =>
              dismissAlert("discount-opportunity-alert", days, String(discountOpportunitiesCount))
            }
            className={className}
            actions={
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onNavigate("/investments?tab=rebalancear&view=simulador")}
              >
                Simular Aporte
              </Button>
            }
          />
        ),
      },
  ];
}
