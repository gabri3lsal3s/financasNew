import { AlertTriangle, Copy, Layers, PieChart, ShieldAlert } from "lucide-react";
import {
  AlertCarouselCard,
  type AlertCarouselCardTone,
} from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import type { StructuralRiskAlert } from "@/domain/portfolio/portfolio-risk-policy";
import { formatPercent } from "@/services/masks";

export interface BuildStructuralRiskItemsParams {
  alerts: readonly StructuralRiskAlert[];
  isCardVisible?: (cardKey: string) => boolean;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  isAlertDismissed?: (alertId: string, fingerprint: string) => boolean;
  dismissAlert?: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}

export function buildStructuralRiskItems({
  alerts,
  isCardVisible,
  onSelectPreset,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: BuildStructuralRiskItemsParams): (DashboardAlertItem | false)[] {
  return alerts.map((alert) => {
    const fingerprint = `${alert.type}:${alert.id}`;
    const cardKey = alert.id.startsWith("portfolio.risk.")
      ? alert.id
      : `portfolio.risk.${alert.id}`;

    if (
      (isCardVisible && !isCardVisible(cardKey)) ||
      isAlertDismissed?.(alert.id, fingerprint)
    ) {
      return false;
    }

    const policy = resolveCarouselCardPolicy(cardKey);

    let icon = <AlertTriangle className="size-4.5" />;
    let badgeText = "Risco Estrutural";
    let badgeVariant: "critical" | "warning" | "muted" = "muted";

    switch (alert.type) {
      case "single_asset_concentration": {
        icon = <AlertTriangle className="size-4.5" />;
        const weight = Number(alert.metadata?.weightPct ?? 0);
        badgeText = `${formatPercent(weight)}% do total`;
        badgeVariant = "critical";
        break;
      }
      case "private_issuer_fgc": {
        icon = <ShieldAlert className="size-4.5" />;
        badgeText = alert.metadata?.exceedsFgc ? "Teto FGC" : "Teto RF";
        badgeVariant = "critical";
        break;
      }
      case "macro_sector_concentration": {
        icon = <Layers className="size-4.5" />;
        const macroPct = Number(alert.metadata?.macroInClassPct ?? 0);
        badgeText = `${formatPercent(macroPct)}% das Ações`;
        badgeVariant = "warning";
        break;
      }
      case "low_diversification_nef": {
        icon = <PieChart className="size-4.5" />;
        const nef = Number(alert.metadata?.classNef ?? 0);
        badgeText = `Nef = ${formatPercent(nef)}`;
        badgeVariant = "muted";
        break;
      }
      case "benchmark_overlap": {
        icon = <Copy className="size-4.5" />;
        const count = Number(alert.metadata?.count ?? 2);
        badgeText = `${count} ETFs sobrepostos`;
        badgeVariant = "muted";
        break;
      }
    }

    const handleAction = () => {
      switch (alert.ctaAction) {
        case "navigate_aporte":
          onNavigate("/investments?tab=aporte");
          break;
        case "navigate_fixed_income":
        case "navigate_portfolio":
          onNavigate("/investments?tab=posicao");
          break;
        default:
          onNavigate("/investments?tab=aporte");
          break;
      }
    };

    const slideTone: AlertCarouselCardTone =
      alert.tone === "info" || alert.tone === "primary" ? "info" : alert.tone;

    return {
      id: cardKey,
      priority: alert.priority,
      content: (
        <AlertCarouselCard
          id={cardKey}
          tone={slideTone}
          icon={icon}
          title={alert.title}
          badge={{ label: badgeText, variant: badgeVariant }}
          description={alert.description}
          className={className}
          primaryAction={{
            label: alert.ctaText ?? "Ver Detalhes",
            onClick: handleAction,
            variant: "outline",
          }}
          dismissPolicy={{
            allowedPresets: policy.allowedPresets,
            onSelectPreset: (preset) => {
              if (onSelectPreset) {
                onSelectPreset(cardKey, preset);
              } else {
                dismissAlert?.(alert.id, preset === "7d" ? 7 : 30, fingerprint);
              }
            },
          }}
        />
      ),
    };
  });
}
