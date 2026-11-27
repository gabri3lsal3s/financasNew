import { Compass, Wallet } from "lucide-react";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import type { CarouselAllocationDriftModel } from "@/domain/portfolio/insights-carousel-drift";
import { InsightSlide } from "./insight-slide";

const IDLE_CASH_THRESHOLD_BRL = 100;

export function buildAllocationInsightItems({
  driftModel,
  cashBRL,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: {
  driftModel: CarouselAllocationDriftModel;
  cashBRL: number;
  isAlertDismissed: (alertId: string, fingerprint: string) => boolean;
  dismissAlert: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  const { allocationDrift, driftSummaryText, driftFingerprint } = driftModel;
  const hasIdleCash = cashBRL >= IDLE_CASH_THRESHOLD_BRL;
  const cashFp = String(Math.floor(cashBRL / 100));

  return [
    allocationDrift.hasTargets &&
      !allocationDrift.isBalanced &&
      !isAlertDismissed("allocation-drift-alert", driftFingerprint) && {
        id: "allocation-drift-alert",
        priority: 5,
        content: (
          <InsightSlide
            tone="warning"
            icon={<Compass className="size-4.5" />}
            title="Desvio de Alocação Detectado"
            badgeText={`${allocationDrift.underweightItems.length + allocationDrift.overweightItems.length} desvios`}
            badgeVariant="warning"
            description={driftSummaryText}
            onDismiss={(days) => dismissAlert("allocation-drift-alert", days, driftFingerprint)}
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("/investments?tab=rebalancear&view=simulador")}
              >
                Simular Rebalanceamento
              </Button>
            }
          />
        ),
      },

    hasIdleCash &&
      !isAlertDismissed("idle-cash-alert", cashFp) && {
        id: "idle-cash-alert",
        priority: 11,
        content: (
          <InsightSlide
            tone="portfolio"
            icon={<Wallet className="size-4.5" />}
            title="Caixa Disponível para Aporte"
            badgeText="Saldo pronto"
            description={
              <>
                <MoneyText
                  cents={Math.round(cashBRL * 100)}
                  variant="caption"
                  tone="default"
                  className="font-medium text-foreground inline"
                />{" "}
                em caixa pronto para equilibrar suas metas de carteira.
              </>
            }
            onDismiss={(days) => dismissAlert("idle-cash-alert", days, cashFp)}
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("/investments?tab=rebalancear&view=simulador&usarCaixa=1")}
              >
                Simular com Caixa
              </Button>
            }
          />
        ),
      },
  ];
}
