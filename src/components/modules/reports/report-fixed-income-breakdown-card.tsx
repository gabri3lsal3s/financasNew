import { useMemo } from "react";
import { Landmark, Percent, Shield, Sparkles } from "lucide-react";
import { numberToCents } from "@/domain/money";
import { calculateFixedIncomeExposure, type PositionLikeItem } from "@/domain/portfolio";
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

export function ReportFixedIncomeBreakdownCard({
  positions,
  assetsMetadata = [],
  className,
  title = "Raio-X de Renda Fixa (Indexadores & Emissores)",
  mode = "interactive",
}: ReportFixedIncomeBreakdownCardProps) {
  const exposure = useMemo(
    () => calculateFixedIncomeExposure(positions, assetsMetadata),
    [positions, assetsMetadata],
  );

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
    ],
    [exposure.orderedIndexers, exposure.orderedMacroIndexers, exposure.orderedIssuers],
  );

  return (
    <ReportExposureBreakdownCard
      title={title}
      subtitle="Análise de risco de taxa de juros (indexador) e risco de crédito (emissor/garantia FGC)."
      icon={Landmark}
      emptyMessage="Nenhum título de renda fixa cadastrado na carteira para análise de indexadores."
      totalAssetsCount={exposure.totalAssetsCount}
      totalValueBRL={exposure.totalValueBRL}
      interactiveCenterLabel="Renda Fixa"
      itemUnitLabel="título(s)"
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
