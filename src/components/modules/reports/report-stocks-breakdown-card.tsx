import { useMemo } from "react";
import { AlertTriangle, Layers, PieChart, ShieldCheck, TrendingUp } from "lucide-react";
import { calculateStocksExposure, type PositionLikeItem } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import {
  ReportExposureBreakdownCard,
  type ExposureBreakdownView,
  type ExposureColorToken,
} from "./report-exposure-breakdown-card";

export interface ReportStocksBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const PROFILE_COLORS: Record<string, ExposureColorToken> = {
  defensivo_besst: "cat2",
  commodities: "cat3",
  ciclico_domestico: "cat1",
  outros_indices: "cat5",
};

const CAP_SIZE_COLORS: Record<string, ExposureColorToken> = {
  large_cap: "cat1",
  mid_cap: "cat5",
  small_cap: "cat6",
};

export function ReportStocksBreakdownCard({
  positions,
  className,
  title = "Raio-X de Ações Brasil (Ciclismo & Porte)",
  mode = "interactive",
}: ReportStocksBreakdownCardProps) {
  const exposure = useMemo(() => calculateStocksExposure(positions), [positions]);

  const views = useMemo<ExposureBreakdownView[]>(
    () => [
      {
        id: "profile",
        label: "Por Perfil Cíclico",
        icon: PieChart,
        printTitle: "Perfil Cíclico & Resiliência",
        columnLabel: "Perfil",
        interactiveColumnLabel: "Perfil Cíclico / Resiliência",
        printCenterLabel: "Perfil",
        items: exposure.orderedProfiles.map((g) => ({ ...g, colorToken: PROFILE_COLORS[g.key] ?? "cat10" })),
      },
      {
        id: "capSize",
        label: "Por Porte",
        icon: Layers,
        printTitle: "Porte / Capitalização de Mercado",
        columnLabel: "Porte",
        interactiveColumnLabel: "Porte / Capitalização",
        printCenterLabel: "Porte",
        items: exposure.orderedCapSizes.map((g) => ({ ...g, colorToken: CAP_SIZE_COLORS[g.key] ?? "cat10" })),
      },
    ],
    [exposure.orderedCapSizes, exposure.orderedProfiles],
  );

  return (
    <ReportExposureBreakdownCard
      title={title}
      subtitle="Perfil cíclico (dividendos BESST, commodities ou consumo) e capitalização de mercado."
      icon={TrendingUp}
      emptyMessage="Nenhuma ação da B3 em custódia na carteira para decomposição setorial."
      totalAssetsCount={exposure.totalAssetsCount}
      totalValueBRL={exposure.totalValueBRL}
      interactiveCenterLabel="Ações Brasil"
      itemUnitLabel="ativo(s)"
      statusBadge={
        exposure.isConcentrated
          ? {
              label: `Concentrado (${formatPercent(exposure.topProfile?.pct ?? 0)}% ${exposure.topProfile?.label ?? ""})`,
              variant: "warning",
              icon: AlertTriangle,
            }
          : {
              label: "Equilibrado",
              variant: "muted",
              icon: ShieldCheck,
              iconClassName: "text-positive-strong",
            }
      }
      views={views}
      mode={mode}
      className={className}
    />
  );
}
