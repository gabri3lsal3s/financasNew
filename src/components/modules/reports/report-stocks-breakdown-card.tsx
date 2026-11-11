import { useMemo, useState } from "react";
import { TrendingUp, AlertTriangle, ShieldCheck, Layers, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks";
import { numberToCents } from "@/domain/money";
import {
  calculateStocksExposure,
  type StocksExposureResult,
  type PositionLikeItem,
} from "@/domain/portfolio";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";
import { cn } from "@/lib/utils";

export interface ReportStocksBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const PROFILE_COLORS: Record<string, string> = {
  defensivo_besst: "#10b981", // Emerald 500 (Bancos, Energia, Saneamento, Seguros, Telecom)
  commodities: "#f59e0b", // Amber 500 (Petróleo, Mineração, Agro)
  ciclico_domestico: "#3b82f6", // Blue 500 (Varejo, Construção, Saúde, Tecnologia)
  outros_indices: "#8b5cf6", // Purple 500 (Índices e Outros)
};

const CAP_SIZE_COLORS: Record<string, string> = {
  large_cap: "#0284c7", // Sky 600 (Blue Chips)
  mid_cap: "#6366f1", // Indigo 500 (Médio Porte)
  small_cap: "#ec4899", // Pink 500 (Small/Micro Caps)
};

export function ReportStocksBreakdownCard({
  positions,
  className,
  title = "Raio-X de Ações Brasil (Ciclismo & Porte)",
  mode = "interactive",
}: ReportStocksBreakdownCardProps) {
  const [activeView, setActiveView] = useState<"profile" | "capSize">("profile");

  const exposure: StocksExposureResult = useMemo(
    () => calculateStocksExposure(positions),
    [positions],
  );

  const profileSegments: ReportDonutSegment[] = useMemo(() => {
    return exposure.profileSegments.map((seg) => ({
      key: seg.key,
      label: seg.label,
      value: seg.valueBRL,
      pct: seg.pct,
      color: PROFILE_COLORS[seg.key] ?? "#64748b",
      formattedValue: <MoneyText cents={numberToCents(seg.valueBRL)} />,
    }));
  }, [exposure.profileSegments]);

  const capSizeSegments: ReportDonutSegment[] = useMemo(() => {
    return exposure.capSizeSegments.map((seg) => ({
      key: seg.key,
      label: seg.label,
      value: seg.valueBRL,
      pct: seg.pct,
      color: CAP_SIZE_COLORS[seg.key] ?? "#64748b",
      formattedValue: <MoneyText cents={numberToCents(seg.valueBRL)} />,
    }));
  }, [exposure.capSizeSegments]);

  if (exposure.totalAssetsCount === 0 || exposure.totalValueBRL <= 0) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 border-b border-border/70 pb-2.5">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma ação da B3 em custódia na carteira para decomposição setorial.
        </p>
      </div>
    );
  }

  const currentSegments = activeView === "profile" ? profileSegments : capSizeSegments;
  const currentOrderedList = activeView === "profile" ? exposure.orderedProfiles : exposure.orderedCapSizes;

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground">{title}</h4>
            <p className="text-[11px] text-muted-foreground leading-normal m-0">
              Perfil cíclico (dividendos BESST, commodities ou consumo) e capitalização de mercado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {exposure.isConcentrated ? (
            <Badge variant="warning" size="sm" className="gap-1 inline-flex items-center">
              <AlertTriangle className="size-3" aria-hidden="true" />
              <span>Concentrado ({formatPercent(exposure.topProfile?.pct ?? 0)}% {exposure.topProfile?.label})</span>
            </Badge>
          ) : (
            <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center">
              <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
              <span>Equilibrado</span>
            </Badge>
          )}

          {/* Alternador de Visão (Oculto no modo print_all) */}
          {mode !== "print_all" && (
            <div className="flex items-center gap-1 rounded-xl bg-surface-hover/70 p-1 border border-border/80 print:hidden">
              <button
                type="button"
                onClick={() => setActiveView("profile")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5",
                  activeView === "profile"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PieChart className="size-3" aria-hidden="true" />
                <span>Por Perfil Cíclico</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("capSize")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5",
                  activeView === "capSize"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="size-3" aria-hidden="true" />
                <span>Por Porte</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "print_all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
          {/* 1. Perfil Cíclico */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 bg-surface/50 print:bg-white print:border-border">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
              <PieChart className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">Perfil Cíclico & Resiliência</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="shrink-0 flex justify-center py-1">
                <ReportDonutChart
                  segments={profileSegments}
                  centerLabel="Perfil"
                  centerValue={
                    <MoneyText
                      cents={numberToCents(exposure.totalValueBRL)}
                      className="text-[10px] font-bold tabular-nums tracking-tight whitespace-nowrap"
                    />
                  }
                  size={112}
                  strokeWidth={10}
                  showLegend={false}
                />
              </div>
              <div className="w-full min-w-0">
                <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-surface-hover/60 border-b border-border/70 text-[10.5px] font-semibold text-muted-foreground">
                        <th className="py-1 px-2.5 font-semibold text-left">Perfil</th>
                        <th className="py-1 px-2 text-right font-medium w-24">Saldo (R$)</th>
                        <th className="py-1 px-2 text-right font-medium w-14">Peso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {exposure.orderedProfiles.map((grp) => (
                        <tr key={grp.key} className="hover:bg-surface-hover/30 text-[10.5px]">
                          <td className="py-1 px-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: PROFILE_COLORS[grp.key] ?? "#64748b" }}
                                aria-hidden="true"
                              />
                              <span className="font-medium text-foreground truncate">{grp.label}</span>
                              <span className="text-[9.5px] text-muted-foreground shrink-0">({grp.count})</span>
                            </div>
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                            <MoneyText cents={numberToCents(grp.valueBRL)} />
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                            {formatPercent(grp.pct)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Porte / Capitalização */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 bg-surface/50 print:bg-white print:border-border">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
              <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">Porte / Capitalização de Mercado</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="shrink-0 flex justify-center py-1">
                <ReportDonutChart
                  segments={capSizeSegments}
                  centerLabel="Porte"
                  centerValue={
                    <MoneyText
                      cents={numberToCents(exposure.totalValueBRL)}
                      className="text-[10px] font-bold tabular-nums tracking-tight whitespace-nowrap"
                    />
                  }
                  size={112}
                  strokeWidth={10}
                  showLegend={false}
                />
              </div>
              <div className="w-full min-w-0">
                <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-surface-hover/60 border-b border-border/70 text-[10.5px] font-semibold text-muted-foreground">
                        <th className="py-1 px-2.5 font-semibold text-left">Porte</th>
                        <th className="py-1 px-2 text-right font-medium w-24">Saldo (R$)</th>
                        <th className="py-1 px-2 text-right font-medium w-14">Peso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {exposure.orderedCapSizes.map((grp) => (
                        <tr key={grp.key} className="hover:bg-surface-hover/30 text-[10.5px]">
                          <td className="py-1 px-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: CAP_SIZE_COLORS[grp.key] ?? "#64748b" }}
                                aria-hidden="true"
                              />
                              <span className="font-medium text-foreground truncate">{grp.label}</span>
                              <span className="text-[9.5px] text-muted-foreground shrink-0">({grp.count})</span>
                            </div>
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                            <MoneyText cents={numberToCents(grp.valueBRL)} />
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                            {formatPercent(grp.pct)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              centerLabel="Ações Brasil"
              centerValue={
                <MoneyText
                  cents={numberToCents(exposure.totalValueBRL)}
                  className="text-xs font-bold tabular-nums tracking-tight whitespace-nowrap"
                />
              }
              size={140}
              strokeWidth={13}
              showLegend={false}
            />
          </div>

          {/* Tabela de Decomposição */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
            <div className="rounded-xl border border-border/70 overflow-hidden text-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/60 border-b border-border/70 text-[11px] font-semibold text-muted-foreground">
                    <th className="py-2 px-3 font-semibold text-left">
                      {activeView === "profile" ? "Perfil Cíclico / Resiliência" : "Porte / Capitalização"}
                    </th>
                    <th className="py-2 px-3 text-right font-medium w-28">Saldo (R$)</th>
                    <th className="py-2 px-3 text-right font-medium w-16">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {currentOrderedList.map((grp) => {
                    const color =
                      activeView === "profile"
                        ? PROFILE_COLORS[grp.key] ?? "#64748b"
                        : CAP_SIZE_COLORS[grp.key] ?? "#64748b";

                    return (
                      <tr key={grp.key} className="hover:bg-surface-hover/30 transition-colors text-xs">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2 min-w-0">
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
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                          <MoneyText cents={numberToCents(grp.valueBRL)} />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                          {formatPercent(grp.pct)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
