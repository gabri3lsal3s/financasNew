import { useMemo } from "react";
import { Calendar, Landmark, Percent, Shield, ShieldAlert, Sparkles } from "lucide-react";
import { numberToCents } from "@/domain/money";
import {
  calculateFixedIncomeDiagnostics,
  calculateFixedIncomeExposure,
  type FixedIncomePositionInput,
  type PositionLikeItem,
} from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import type { PortfolioAsset } from "@/types";
import {
  ReportExposureBreakdownCard,
  type ExposureBreakdownView,
  type ExposureColorToken,
} from "./report-exposure-breakdown-card";

export interface ReportFixedIncomeBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  assetsMetadata?: readonly PortfolioAsset[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const INDEXER_COLORS: Record<string, ExposureColorToken> = {
  pos_fixado: "cat1",
  cdi: "cat1",
  selic: "cat7",
  ipca: "cat2",
  pre: "cat3",
};

const ISSUER_COLORS: Record<string, ExposureColorToken> = {
  tesouro: "cat2",
  bancario_fgc: "cat1",
  credito_privado: "cat3",
};

const MATURITY_COLORS: Record<string, ExposureColorToken> = {
  up_to_1y: "cat1",
  "1y_to_2y": "cat2",
  "2y_to_5y": "cat3",
  above_5y: "cat4",
  liquid_or_none: "cat7",
};

export function ReportFixedIncomeBreakdownCard({
  positions,
  assetsMetadata = [],
  className,
  title = "Raio-X de Renda Fixa (Indexadores, Emissores & Prazos)",
  mode = "interactive",
}: ReportFixedIncomeBreakdownCardProps) {
  const exposure = useMemo(
    () => calculateFixedIncomeExposure(positions, assetsMetadata),
    [positions, assetsMetadata],
  );

  const fiDiagnostics = useMemo(() => {
    const metadataMap = new Map<string, PortfolioAsset>();
    for (const a of assetsMetadata) {
      metadataMap.set(a.id, a);
      metadataMap.set(a.ticker.trim().toUpperCase(), a);
    }

    const inputRows: FixedIncomePositionInput[] = positions.map((p) => {
      const meta = (p.assetId ? metadataMap.get(p.assetId) : null) ?? metadataMap.get(p.ticker.trim().toUpperCase());
      return {
        assetId: p.assetId ?? p.ticker,
        ticker: p.ticker,
        name: meta?.notes ?? p.ticker,
        assetClass: p.assetClass ?? meta?.asset_class ?? null,
        valueBRL: p.valueBRL,
        maturityDate: meta?.fixed_income_metadata?.maturity_date,
        fixedIncomeMetadata: meta?.fixed_income_metadata,
      };
    });

    return calculateFixedIncomeDiagnostics(inputRows);
  }, [positions, assetsMetadata]);

  const views = useMemo<ExposureBreakdownView[]>(
    () => [
      {
        id: "indexer",
        label: "Por Indexador",
        icon: Percent,
        printTitle: "Indexador & Taxa de Juros",
        columnLabel: "Indexador",
        interactiveColumnLabel: "Indexador / Regime",
        printCenterLabel: "Indexador",
        items: (exposure.orderedMacroIndexers ?? exposure.orderedIndexers).map((g) => ({ ...g, colorToken: INDEXER_COLORS[g.key] ?? "cat10" })),
      },
      {
        id: "issuer",
        label: "Por Emissor & FGC",
        icon: Shield,
        printTitle: "Tipo de Emissor & Garantia FGC",
        columnLabel: "Emissor / Risco",
        interactiveColumnLabel: "Tipo de Emissor / Risco",
        printCenterLabel: "Emissor",
        items: exposure.orderedIssuers.map((g) => ({ ...g, colorToken: ISSUER_COLORS[g.key] ?? "cat10" })),
      },
      {
        id: "maturity",
        label: "Por Vencimento",
        icon: Calendar,
        printTitle: "Cronograma de Vencimento & Liquidez",
        columnLabel: "Prazo de Vencimento",
        interactiveColumnLabel: "Faixa de Vencimento / Liquidez",
        printCenterLabel: "Vencimento",
        items: fiDiagnostics.maturities.map((m) => ({
          key: m.bucketKey,
          label: m.label,
          valueBRL: m.totalBRL,
          pct: m.shareInFixedIncomePct,
          count: m.count,
          colorToken: MATURITY_COLORS[m.bucketKey] ?? "cat10",
        })),
      },
    ],
    [exposure.orderedIndexers, exposure.orderedMacroIndexers, exposure.orderedIssuers, fiDiagnostics.maturities],
  );

  return (
    <ReportExposureBreakdownCard
      title={title}
      subtitle="Análise de risco de taxa de juros (indexador), risco de crédito (emissor/garantia FGC) e cronograma de vencimento."
      icon={Landmark}
      emptyMessage="Nenhum título de renda fixa cadastrado na carteira para análise de indexadores."
      totalAssetsCount={exposure.totalAssetsCount}
      totalValueBRL={exposure.totalValueBRL}
      interactiveCenterLabel="Renda Fixa"
      itemUnitLabel="título(s)"
      statusBadge={
        fiDiagnostics.fgcExceededCount > 0
          ? {
              label: `${fiDiagnostics.fgcExceededCount} ${
                fiDiagnostics.fgcExceededCount === 1 ? "emissor excede" : "emissores excedem"
              } o teto FGC (R$ 250k)`,
              variant: "warning",
              icon: ShieldAlert,
            }
          : undefined
      }
      highlightCallout={{
        icon: Sparkles,
        tone: "positive",
        label: (
          <span className="font-semibold">
            Eficiência Fiscal: {formatPercent(exposure.taxExemptPct)}% isento de Imposto de Renda
          </span>
        ),
        valueLabel: "Total Isento",
        valueCents: numberToCents(exposure.taxExemptValueBRL),
      }}
      views={views}
      mode={mode}
      className={className}
    />
  );
}
