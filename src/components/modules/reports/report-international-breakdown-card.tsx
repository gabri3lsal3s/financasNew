import { useMemo, useState } from "react";
import { Globe, AlertTriangle, ShieldCheck, DollarSign, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  calculateInternationalExposure,
  type InternationalExposureResult,
  type PositionLikeItem,
} from "@/domain/portfolio";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";
import { cn } from "@/lib/utils";

export interface ReportInternationalBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const REGION_COLORS: Record<string, string> = {
  eua: "#3b82f6", // Blue 500 (US Equity)
  desenvolvidos_ex_us: "#8b5cf6", // Purple 500 (Europa, Japão, etc.)
  emergentes: "#f59e0b", // Amber 500 (China, Índia, etc.)
  global: "#10b981", // Emerald 500 (Neutro All-World)
};

const VEHICLE_COLORS: Record<string, string> = {
  moeda_forte_usd: "#059669", // Emerald 600 (USD Direto)
  bdr_brl: "#6366f1", // Indigo 500 (BDRs na B3)
};

export function ReportInternationalBreakdownCard({
  positions,
  className,
  title = "Raio-X Internacional (Geografia & Moeda Forte)",
  mode = "interactive",
}: ReportInternationalBreakdownCardProps) {
  const [activeView, setActiveView] = useState<"region" | "vehicle">("region");

  const exposure: InternationalExposureResult = useMemo(
    () => calculateInternationalExposure(positions),
    [positions],
  );

  const regionSegments: ReportDonutSegment[] = useMemo(() => {
    return exposure.regionSegments.map((seg) => ({
      key: seg.key,
      label: seg.label,
      value: seg.valueBRL,
      pct: seg.pct,
      color: REGION_COLORS[seg.key] ?? "#64748b",
      formattedValue: <MoneyText cents={numberToCents(seg.valueBRL)} />,
    }));
  }, [exposure.regionSegments]);

  const vehicleSegments: ReportDonutSegment[] = useMemo(() => {
    return exposure.vehicleSegments.map((seg) => ({
      key: seg.key,
      label: seg.label,
      value: seg.valueBRL,
      pct: seg.pct,
      color: VEHICLE_COLORS[seg.key] ?? "#64748b",
      formattedValue: <MoneyText cents={numberToCents(seg.valueBRL)} />,
    }));
  }, [exposure.vehicleSegments]);

  if (exposure.totalAssetsCount === 0 || exposure.totalValueBRL <= 0) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 border-b border-border/70 pb-2.5">
          <Globe className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhum ativo internacional ou BDR em custódia na carteira para análise geográfica.
        </p>
      </div>
    );
  }

  const currentSegments = activeView === "region" ? regionSegments : vehicleSegments;
  const currentOrderedList = activeView === "region" ? exposure.orderedRegions : exposure.orderedVehicles;

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground">{title}</h4>
            <p className="text-[11px] text-muted-foreground leading-normal m-0">
              Descentralização geográfica global e custódia em moeda forte (dólar direto vs. BDRs).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {exposure.isConcentrated ? (
            <Badge variant="warning" size="sm" className="gap-1 inline-flex items-center">
              <AlertTriangle className="size-3" aria-hidden="true" />
              <span>Concentrado ({exposure.topRegion?.pct.toFixed(0)}% {exposure.topRegion?.label})</span>
            </Badge>
          ) : (
            <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center">
              <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
              <span>Global</span>
            </Badge>
          )}

          {/* Alternador de Visão (Oculto no modo print_all) */}
          {mode !== "print_all" && (
            <div className="flex items-center gap-1 rounded-xl bg-surface-hover/70 p-1 border border-border/60 print:hidden">
              <button
                type="button"
                onClick={() => setActiveView("region")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5",
                  activeView === "region"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MapPin className="size-3" aria-hidden="true" />
                <span>Por Região</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("vehicle")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5",
                  activeView === "vehicle"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <DollarSign className="size-3" aria-hidden="true" />
                <span>Por Custódia</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Faixa de Moeda Forte Direta (Dólar) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl bg-surface-hover/40 border border-border/70 p-2.5 text-xs">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <DollarSign className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span>
            Exposição em Dólar Direto (Conta Internacional): <strong className="font-semibold text-foreground">{exposure.usdDirectPct.toFixed(1)}%</strong>
          </span>
        </div>
        <span className="font-mono text-muted-foreground text-[11px]">
          Equivalente BRL: <strong className="text-foreground"><MoneyText cents={numberToCents(exposure.usdDirectValueBRL)} /></strong>
        </span>
      </div>

      {mode === "print_all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
          {/* 1. Região Geográfica */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 bg-surface/50 print:bg-white print:border-border">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
              <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">Região Geográfica</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="shrink-0 flex justify-center py-1">
                <ReportDonutChart
                  segments={regionSegments}
                  centerLabel="Região"
                  centerValue={
                    <MoneyText
                      cents={numberToCents(exposure.totalValueBRL)}
                      className="text-[11px] font-bold tabular-nums tracking-tight whitespace-nowrap"
                    />
                  }
                  size={115}
                  strokeWidth={13}
                  showLegend={false}
                />
              </div>
              <div className="flex-1 w-full min-w-0">
                <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                  <div className="bg-surface-hover/60 px-2.5 py-1.5 font-semibold text-muted-foreground flex justify-between items-center border-b border-border/70 text-[11px]">
                    <span className="truncate pr-1">Região</span>
                    <div className="flex items-center gap-2.5 shrink-0 text-right font-medium">
                      <span className="w-20 text-right">Saldo (R$)</span>
                      <span className="w-10 text-right">Peso</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {exposure.orderedRegions.map((grp) => (
                      <div key={grp.key} className="px-2.5 py-1.5 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: REGION_COLORS[grp.key] ?? "#64748b" }}
                            aria-hidden="true"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground truncate text-[11px]">{grp.label}</span>
                            <span className="text-[9.5px] text-muted-foreground">{grp.count} ativo(s)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 font-mono text-right text-[11px]">
                          <span className="w-20 text-right font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                            <MoneyText cents={numberToCents(grp.valueBRL)} />
                          </span>
                          <span className="w-10 text-right font-semibold text-muted-foreground tabular-nums">
                            {grp.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Veículo de Custódia */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 bg-surface/50 print:bg-white print:border-border">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
              <DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">Veículo de Custódia (Dólar vs. BDR)</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="shrink-0 flex justify-center py-1">
                <ReportDonutChart
                  segments={vehicleSegments}
                  centerLabel="Custódia"
                  centerValue={
                    <MoneyText
                      cents={numberToCents(exposure.totalValueBRL)}
                      className="text-[11px] font-bold tabular-nums tracking-tight whitespace-nowrap"
                    />
                  }
                  size={115}
                  strokeWidth={13}
                  showLegend={false}
                />
              </div>
              <div className="flex-1 w-full min-w-0">
                <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                  <div className="bg-surface-hover/60 px-2.5 py-1.5 font-semibold text-muted-foreground flex justify-between items-center border-b border-border/70 text-[11px]">
                    <span className="truncate pr-1">Veículo</span>
                    <div className="flex items-center gap-2.5 shrink-0 text-right font-medium">
                      <span className="w-20 text-right">Saldo (R$)</span>
                      <span className="w-10 text-right">Peso</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {exposure.orderedVehicles.map((grp) => (
                      <div key={grp.key} className="px-2.5 py-1.5 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: VEHICLE_COLORS[grp.key] ?? "#64748b" }}
                            aria-hidden="true"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground truncate text-[11px]">{grp.label}</span>
                            <span className="text-[9.5px] text-muted-foreground">{grp.count} ativo(s)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 font-mono text-right text-[11px]">
                          <span className="w-20 text-right font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                            <MoneyText cents={numberToCents(grp.valueBRL)} />
                          </span>
                          <span className="w-10 text-right font-semibold text-muted-foreground tabular-nums">
                            {grp.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Donut Chart */}
          <div className="shrink-0 flex justify-center py-2">
            <ReportDonutChart
              segments={currentSegments}
              centerLabel="Internacional"
              centerValue={
                <MoneyText
                  cents={numberToCents(exposure.totalValueBRL)}
                  className="text-xs font-bold tabular-nums tracking-tight whitespace-nowrap"
                />
              }
              size={140}
              strokeWidth={16}
              showLegend={false}
            />
          </div>

          {/* Tabela de Decomposição */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
            <div className="rounded-xl border border-border/70 overflow-hidden text-xs">
              <div className="bg-surface-hover/60 px-3 py-2 font-semibold text-muted-foreground flex justify-between items-center border-b border-border/70">
                <span className="truncate pr-2">
                  {activeView === "region" ? "Região Geográfica" : "Veículo de Custódia"}
                </span>
                <div className="flex items-center gap-4 shrink-0 text-right font-medium">
                  <span className="w-24 text-right">Saldo (R$)</span>
                  <span className="w-12 text-right">Peso</span>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {currentOrderedList.map((grp) => {
                  const color =
                    activeView === "region"
                      ? REGION_COLORS[grp.key] ?? "#64748b"
                      : VEHICLE_COLORS[grp.key] ?? "#64748b";

                  return (
                    <div key={grp.key} className="px-3 py-2 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground truncate">{grp.label}</span>
                          <span className="text-[10px] text-muted-foreground">{grp.count} ativo(s)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                        <span className="w-24 text-right font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                          <MoneyText cents={numberToCents(grp.valueBRL)} />
                        </span>
                        <span className="w-12 text-right font-semibold text-muted-foreground tabular-nums">
                          {grp.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
