import { AlertTriangle, Copy, Layers, PieChart, ShieldAlert } from "lucide-react";
import {
  AlertCarouselCard,
  type AlertCarouselCardTone,
} from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  buildPortfolioRiskBreakdown,
  type RiskConstituent,
} from "@/domain/calculation-memory/builders/portfolio-risk-breakdown";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import {
  DEFAULT_PORTFOLIO_RISK_POLICY,
  type PortfolioRiskPolicy,
  type StructuralRiskAlert,
} from "@/domain/portfolio/portfolio-risk-policy";
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

function toCents(valueBRL: unknown): number {
  const num = Number(valueBRL ?? 0);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function toConstituents(raw: unknown): RiskConstituent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      assetId: String(item.assetId ?? item.ticker ?? ""),
      ticker: String(item.ticker ?? ""),
      valueCents: toCents(item.valueBRL),
      source: item.source === "cost_fallback" ? "cost_fallback" : "position",
    }));
}

function buildAlertRiskBreakdown(alert: StructuralRiskAlert): CalculationBreakdown | undefined {
  const m = alert.metadata;
  if (!m || typeof m.totalValueBRL !== "number") return undefined;

  const asOf = typeof m.asOf === "string" ? m.asOf : new Date().toISOString().slice(0, 10);
  const totalCents = toCents(m.totalValueBRL);
  const fallbackTickers = Array.isArray(m.fallbackTickers)
    ? m.fallbackTickers.map(String)
    : undefined;
  const policy =
    (m.policy as PortfolioRiskPolicy | undefined) ?? DEFAULT_PORTFOLIO_RISK_POLICY;

  switch (alert.type) {
    case "single_asset_concentration": {
      const assetId = String(m.assetId ?? "");
      const ticker = String(m.ticker ?? "");
      const constituents: RiskConstituent[] = [
        {
          assetId,
          ticker,
          valueCents: toCents(m.assetValueBRL),
          source: fallbackTickers?.includes(ticker) ? "cost_fallback" : "position",
        },
      ];
      return buildPortfolioRiskBreakdown({
        kind: "asset",
        asOf,
        totalCents,
        constituents,
        fallbackTickers,
        policy,
        itemId: assetId,
        ticker,
        weightPct: Number(m.weightPct ?? 0),
        limitPct: Number(m.limitPct ?? policy.defaultAssetCeilingPct),
      });
    }
    case "private_issuer_fgc":
      return buildPortfolioRiskBreakdown({
        kind: "issuer",
        asOf,
        totalCents,
        constituents: toConstituents(m.constituents),
        fallbackTickers,
        policy,
        issuerKey: String(m.issuerKey ?? ""),
        issuerLabel: String(m.issuerLabel ?? "Emissor"),
        exposureCents: toCents(m.exposureBRL),
        rfCents: toCents(m.totalRfBRL),
        classPct: Number(m.classPct ?? 0),
        globalPct: Number(m.globalPct ?? 0),
        breachedLimit:
          (m.breachedLimit as "fgc_absolute" | "rf_class" | "global" | undefined) ??
          "fgc_absolute",
      });
    case "macro_sector_concentration":
      return buildPortfolioRiskBreakdown({
        kind: "macro",
        asOf,
        totalCents,
        constituents: toConstituents(m.constituents),
        fallbackTickers,
        policy,
        macroKey: String(m.macroKey ?? ""),
        macroLabel: String(m.macroLabel ?? "Setor"),
        classCents: toCents(m.totalStockBRL),
        exposureCents: toCents(m.macroValBRL),
        classPct: Number(m.macroInClassPct ?? 0),
        globalPct: Number(m.macroGlobalPct ?? 0),
        breachedLimit:
          (m.breachedLimit as "in_class" | "global" | undefined) ?? "in_class",
      });
    case "low_diversification_nef": {
      const rawWeights = Array.isArray(m.constituents) ? m.constituents : [];
      const classCents = toCents(m.classValueBRL);
      const weights = rawWeights
        .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
        .map((w) => {
          const val = Number(w.valueBRL ?? 0);
          const totalClass = Number(m.classValueBRL ?? 1) || 1;
          const weight = val / totalClass;
          return {
            ticker: String(w.ticker ?? ""),
            weight,
            weightSq: weight * weight,
          };
        });
      return buildPortfolioRiskBreakdown({
        kind: "nef",
        asOf,
        totalCents,
        constituents: toConstituents(m.constituents),
        fallbackTickers,
        policy,
        classCents,
        weights,
        hhi: Number(m.classHHI ?? 0),
        nef: Number(m.classNef ?? 0),
      });
    }
    case "benchmark_overlap":
      return buildPortfolioRiskBreakdown({
        kind: "benchmark",
        asOf,
        totalCents,
        constituents: toConstituents(m.constituents),
        fallbackTickers,
        policy,
        benchmarkKey: String(m.benchmark ?? ""),
        benchmarkLabel: String(m.benchmarkLabel ?? "Benchmark"),
        exposureCents: toCents(m.valueBRL),
        weightPct: Number(m.overlapPct ?? 0),
        limitPct: policy.benchmarkOverlapCeilingPct,
      });
    default:
      return undefined;
  }
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
          calculationBreakdown={buildAlertRiskBreakdown(alert)}
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
