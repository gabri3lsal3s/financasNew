import { useMemo } from "react";
import { AlertTriangle, DollarSign, Globe, MapPin, ShieldCheck } from "lucide-react";
import { numberToCents } from "@/domain/money";
import { calculateInternationalExposure, type PositionLikeItem } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import {
  ReportExposureBreakdownCard,
  type ExposureBreakdownView,
  type ExposureColorToken,
} from "./report-exposure-breakdown-card";

export interface ReportInternationalBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const REGION_COLORS: Record<string, ExposureColorToken> = {
  eua: "cat1",
  desenvolvidos_ex_us: "cat5",
  emergentes: "cat3",
  global: "cat2",
};

const VEHICLE_COLORS: Record<string, ExposureColorToken> = {
  moeda_forte_usd: "cat2",
  bdr_brl: "cat5",
};

export function ReportInternationalBreakdownCard({
  positions,
  className,
  title = "Raio-X Internacional (Geografia & Moeda Forte)",
  mode = "interactive",
}: ReportInternationalBreakdownCardProps) {
  const exposure = useMemo(() => calculateInternationalExposure(positions), [positions]);

  const views = useMemo<ExposureBreakdownView[]>(
    () => [
      {
        id: "region",
        label: "Por Região",
        icon: MapPin,
        printTitle: "Região Geográfica",
        columnLabel: "Região",
        interactiveColumnLabel: "Região Geográfica",
        printCenterLabel: "Região",
        items: exposure.orderedRegions.map((g) => ({ ...g, colorToken: REGION_COLORS[g.key] ?? "cat10" })),
      },
      {
        id: "vehicle",
        label: "Por Custódia",
        icon: DollarSign,
        printTitle: "Veículo de Custódia (Dólar vs. BDR)",
        columnLabel: "Veículo",
        interactiveColumnLabel: "Veículo de Custódia",
        printCenterLabel: "Custódia",
        items: exposure.orderedVehicles.map((g) => ({ ...g, colorToken: VEHICLE_COLORS[g.key] ?? "cat10" })),
      },
    ],
    [exposure.orderedRegions, exposure.orderedVehicles],
  );

  return (
    <ReportExposureBreakdownCard
      title={title}
      subtitle="Descentralização geográfica global e custódia em moeda forte (dólar direto vs. BDRs)."
      icon={Globe}
      emptyMessage="Nenhum ativo internacional ou BDR em custódia na carteira para análise geográfica."
      totalAssetsCount={exposure.totalAssetsCount}
      totalValueBRL={exposure.totalValueBRL}
      interactiveCenterLabel="Internacional"
      itemUnitLabel="ativo(s)"
      statusBadge={
        exposure.isConcentrated
          ? {
              label: `Concentrado (${formatPercent(exposure.topRegion?.pct ?? 0)}% ${exposure.topRegion?.label ?? ""})`,
              variant: "warning",
              icon: AlertTriangle,
            }
          : {
              label: "Global",
              variant: "muted",
              icon: ShieldCheck,
              iconClassName: "text-positive-strong",
            }
      }
      highlightCallout={{
        icon: DollarSign,
        iconClassName: "text-positive-strong",
        tone: "surface",
        label: (
          <span>
            Exposição em Dólar Direto (Conta Internacional):{" "}
            <strong className="font-semibold text-foreground">{formatPercent(exposure.usdDirectPct)}%</strong>
          </span>
        ),
        valueLabel: "Equivalente BRL",
        valueCents: numberToCents(exposure.usdDirectValueBRL),
      }}
      views={views}
      mode={mode}
      className={className}
    />
  );
}
