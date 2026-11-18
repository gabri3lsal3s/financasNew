import { useMemo } from "react";
import { AlertTriangle, Building2, ShieldCheck } from "lucide-react";
import { calculateFiiExposure, type PositionLikeItem } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import {
  ReportExposureBreakdownCard,
  type ExposureBreakdownView,
  type ExposureColorToken,
} from "./report-exposure-breakdown-card";

export interface ReportFiiBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const FII_CATEGORY_COLORS: Record<string, ExposureColorToken> = {
  tijolo: "cat1",
  papel: "cat3",
  fof: "cat5",
  hibrido: "cat2",
  agro_infra: "cat8",
  outros: "cat10",
};

export function ReportFiiBreakdownCard({
  positions,
  className,
  title = "Raio-X de Fundos Imobiliários (Tijolo vs. Dívida)",
  mode = "interactive",
}: ReportFiiBreakdownCardProps) {
  const exposure = useMemo(() => calculateFiiExposure(positions), [positions]);

  const views = useMemo<ExposureBreakdownView[]>(
    () => [
      {
        id: "fii",
        label: "Estratégia",
        icon: Building2,
        printTitle: "Estratégia / Categoria",
        columnLabel: "Estratégia / Categoria",
        printCenterLabel: "Total FIIs",
        items: exposure.orderedGroups.map((g) => ({ ...g, colorToken: FII_CATEGORY_COLORS[g.key] ?? "cat10" })),
      },
    ],
    [exposure.orderedGroups],
  );

  return (
    <ReportExposureBreakdownCard
      title={title}
      subtitle="Segregação por estratégia imobiliária (imóveis físicos, títulos de crédito, FOFs e agro)."
      icon={Building2}
      emptyMessage="Nenhum fundo imobiliário em custódia na carteira para decomposição setorial."
      totalAssetsCount={exposure.totalAssetsCount}
      totalValueBRL={exposure.totalValueBRL}
      interactiveCenterLabel="Total FIIs"
      itemUnitLabel="ativo(s)"
      statusBadge={
        exposure.isConcentrated
          ? {
              label: `Concentrado (${formatPercent(exposure.topCategory?.pct ?? 0)}% ${exposure.topCategory?.label ?? ""})`,
              variant: "warning",
              icon: AlertTriangle,
            }
          : {
              label: "Diversificado",
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
