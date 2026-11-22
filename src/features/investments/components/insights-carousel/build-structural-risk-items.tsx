import { AlertTriangle, Copy, Layers, PieChart, ShieldAlert } from "lucide-react";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import type { StructuralRiskAlert } from "@/domain/portfolio/portfolio-risk-policy";
import { formatPercent } from "@/services/masks";
import { InsightSlide, type InsightTone } from "./insight-slide";

export interface BuildStructuralRiskItemsParams {
  alerts: readonly StructuralRiskAlert[];
  isAlertDismissed: (alertId: string, fingerprint: string) => boolean;
  dismissAlert: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}

export function buildStructuralRiskItems({
  alerts,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: BuildStructuralRiskItemsParams): (DashboardAlertItem | false)[] {
  return alerts.map((alert) => {
    const fingerprint = `${alert.type}:${alert.id}`;
    if (isAlertDismissed(alert.id, fingerprint)) {
      return false;
    }

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
          onNavigate("/investments?tab=rebalancear&view=simulador");
          break;
        case "navigate_fixed_income":
        case "navigate_portfolio":
          onNavigate("/investments?tab=posicao");
          break;
        default:
          onNavigate("/investments?tab=rebalancear&view=simulador");
          break;
      }
    };

    const slideTone: InsightTone = alert.tone === "info" ? "primary" : alert.tone;

    return {
      id: alert.id,
      priority: alert.priority,
      content: (
        <InsightSlide
          tone={slideTone}
          icon={icon}
          title={alert.title}
          badgeText={badgeText}
          badgeVariant={badgeVariant}
          description={alert.description}
          onDismiss={(days) => dismissAlert(alert.id, days, fingerprint)}
          className={className}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={handleAction}>
              {alert.ctaText ?? "Ver Detalhes"}
            </Button>
          }
        />
      ),
    };
  });
}
