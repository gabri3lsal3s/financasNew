import { ArrowRight, Compass, Wallet } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { MoneyText } from "@/components/ui/money-text";
import {
  buildPortfolioCarouselBreakdown,
  type PortfolioEvidence,
} from "@/domain/calculation-memory/builders/portfolio-carousel-breakdown";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import type { CarouselAllocationDriftModel } from "@/domain/portfolio/insights-carousel-drift";

const IDLE_CASH_THRESHOLD_BRL = 100;

export function buildAllocationInsightItems({
  driftModel,
  cashBRL,
  isCardVisible,
  onSelectPreset,
  isAlertDismissed,
  dismissAlert,
  onNavigate,
  className,
}: {
  driftModel: CarouselAllocationDriftModel;
  cashBRL: number;
  isCardVisible?: (cardKey: string) => boolean;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  isAlertDismissed?: (alertId: string, fingerprint: string) => boolean;
  dismissAlert?: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onNavigate: (to: string) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  const { allocationDrift, driftSummaryText, driftFingerprint } = driftModel;
  const hasIdleCash = cashBRL >= IDLE_CASH_THRESHOLD_BRL;
  const cashFp = String(Math.floor(cashBRL / 100));

  const isDriftVisible =
    (isCardVisible ? isCardVisible("portfolio.allocation_drift") : true) &&
    !(isAlertDismissed?.("allocation-drift-alert", driftFingerprint) ?? false);
  const isIdleVisible =
    (isCardVisible ? isCardVisible("portfolio.idle_cash") : true) &&
    !(isAlertDismissed?.("idle-cash-alert", cashFp) ?? false);

  const driftPolicy = resolveCarouselCardPolicy("portfolio.allocation_drift");
  const idlePolicy = resolveCarouselCardPolicy("portfolio.idle_cash");

  const driftEvidence: PortfolioEvidence = {
    kind: "drift",
    investableCents: allocationDrift.totalPortfolioCents,
    classes: [
      ...allocationDrift.underweightItems,
      ...allocationDrift.overweightItems,
    ].map((c) => ({
      name: c.name,
      valueCents: c.currentValueCents,
      targetPct: c.targetPercent,
      diffPp: c.diffPercent,
    })),
    unallocatedClassesBRL: driftModel.unallocatedClassesBRL,
    unallocatedClassNames: driftModel.unallocatedClassNames,
    tolerancePp: allocationDrift.tolerancePercent,
  };

  const idleEvidence: PortfolioEvidence = {
    kind: "idle",
    cashCents: Math.round(cashBRL * 100),
    components: [{ label: "Saldo disponível em corretora", valueCents: Math.round(cashBRL * 100) }],
    ticketCents: 10_000,
  };

  return [
    allocationDrift.hasTargets &&
      !allocationDrift.isBalanced &&
      isDriftVisible && {
        id: "portfolio.allocation_drift",
        priority: 5,
        content: (
          <AlertCarouselCard
            id="portfolio.allocation_drift"
            tone="warning"
            icon={<Compass className="size-4.5" />}
            title="Desvio de Alocação Detectado"
            badge={{
              label: `${allocationDrift.underweightItems.length + allocationDrift.overweightItems.length} desvios`,
              variant: "warning",
            }}
            description={driftSummaryText}
            calculationBreakdown={buildPortfolioCarouselBreakdown(driftEvidence)}
            className={className}
            primaryAction={{
              label: "Simular Rebalanceamento",
              onClick: () => onNavigate("/investments?tab=aporte"),
              variant: "outline",
              icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
            }}
            dismissPolicy={{
              allowedPresets: driftPolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.allocation_drift", preset);
                } else {
                  dismissAlert?.(
                    "allocation-drift-alert",
                    preset === "7d" ? 7 : 30,
                    driftFingerprint,
                  );
                }
              },
            }}
          />
        ),
      },

    hasIdleCash &&
      isIdleVisible && {
        id: "portfolio.idle_cash",
        priority: 11,
        content: (
          <AlertCarouselCard
            id="portfolio.idle_cash"
            tone="portfolio"
            icon={<Wallet className="size-4.5" />}
            title="Caixa Disponível para Aporte"
            badge={{ label: "Saldo pronto", variant: "portfolio" }}
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
            calculationBreakdown={buildPortfolioCarouselBreakdown(idleEvidence)}
            className={className}
            primaryAction={{
              label: "Simular com Caixa",
              onClick: () => onNavigate("/investments?tab=aporte&usarCaixa=1"),
              variant: "outline",
              icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
            }}
            dismissPolicy={{
              allowedPresets: idlePolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.idle_cash", preset);
                } else {
                  dismissAlert?.(
                    "idle-cash-alert",
                    preset === "7d" ? 7 : 30,
                    cashFp,
                  );
                }
              },
            }}
          />
        ),
      },
  ];
}
