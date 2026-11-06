import { useMemo } from "react";
import { Building2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  calculateFiiExposure,
  type FiiExposureResult,
  type PositionLikeItem,
} from "@/domain/portfolio";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";
import { cn } from "@/lib/utils";

export interface ReportFiiBreakdownCardProps {
  positions: readonly PositionLikeItem[];
  className?: string;
  title?: string;
  mode?: "interactive" | "print_all";
}

const FII_CATEGORY_COLORS: Record<string, string> = {
  tijolo: "#0284c7", // Sky 600
  papel: "#f59e0b", // Amber 500
  fof: "#8b5cf6", // Purple 500
  hibrido: "#10b981", // Emerald 500
  agro_infra: "#84cc16", // Lime 500
  outros: "#64748b", // Slate 500
};

export function ReportFiiBreakdownCard(props: ReportFiiBreakdownCardProps) {
  const {
    positions,
    className,
    title = "Raio-X de Fundos Imobiliários (Tijolo vs. Dívida)",
    mode = "interactive",
  } = props;
  const exposure: FiiExposureResult = useMemo(
    () => calculateFiiExposure(positions),
    [positions],
  );

  const donutSegments: ReportDonutSegment[] = useMemo(() => {
    return exposure.segments.map((seg) => ({
      key: seg.key,
      label: seg.label,
      value: seg.valueBRL,
      pct: seg.pct,
      color: FII_CATEGORY_COLORS[seg.key] ?? "#64748b",
      formattedValue: <MoneyText cents={numberToCents(seg.valueBRL)} />,
    }));
  }, [exposure.segments]);

  if (exposure.totalAssetsCount === 0 || exposure.totalValueBRL <= 0) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 border-b border-border/70 pb-2.5">
          <Building2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhum fundo imobiliário em custódia na carteira para decomposição setorial.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground">{title}</h4>
            <p className="text-[11px] text-muted-foreground leading-normal m-0">
              Segregação por estratégia imobiliária (imóveis físicos, títulos de crédito, FOFs e agro).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {exposure.isConcentrated ? (
            <Badge variant="warning" size="sm" className="gap-1 inline-flex items-center">
              <AlertTriangle className="size-3" aria-hidden="true" />
              <span>Concentrado ({exposure.topCategory?.pct.toFixed(0)}% {exposure.topCategory?.label})</span>
            </Badge>
          ) : (
            <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center">
              <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
              <span>Diversificado</span>
            </Badge>
          )}
        </div>
      </div>

      {mode === "print_all" ? (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="shrink-0 flex justify-center py-1">
            <ReportDonutChart
              segments={donutSegments}
              centerLabel="Total FIIs"
              centerValue={
                <MoneyText
                  cents={numberToCents(exposure.totalValueBRL)}
                  className="text-[11px] font-bold tabular-nums tracking-tight whitespace-nowrap"
                />
              }
              size={120}
              strokeWidth={11}
              showLegend={false}
            />
          </div>
          <div className="flex-1 w-full min-w-0">
            <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/60 border-b border-border/70 text-[10.5px] font-semibold text-muted-foreground">
                    <th className="py-1.5 px-3 font-semibold text-left">Estratégia / Categoria</th>
                    <th className="py-1.5 px-2.5 text-right font-medium w-28">Saldo (R$)</th>
                    <th className="py-1.5 px-2.5 text-right font-medium w-16">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {exposure.orderedGroups.map((grp) => (
                    <tr key={grp.key} className="hover:bg-surface-hover/30 text-[10.5px]">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: FII_CATEGORY_COLORS[grp.key] ?? "#64748b" }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground truncate">{grp.label}</span>
                          <span className="text-[9.5px] text-muted-foreground shrink-0">({grp.count} ativo(s))</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                        <MoneyText cents={numberToCents(grp.valueBRL)} />
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                        {grp.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Donut Chart */}
          <div className="shrink-0 flex justify-center py-2">
            <ReportDonutChart
              segments={donutSegments}
              centerLabel="Total FIIs"
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

          {/* Tabela de Decomposição das Categorias */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
            <div className="rounded-xl border border-border/70 overflow-hidden text-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/60 border-b border-border/70 text-[11px] font-semibold text-muted-foreground">
                    <th className="py-2 px-3 font-semibold text-left">Estratégia / Categoria</th>
                    <th className="py-2 px-3 text-right font-medium w-28">Saldo (R$)</th>
                    <th className="py-2 px-3 text-right font-medium w-16">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {exposure.orderedGroups.map((grp) => (
                    <tr key={grp.key} className="hover:bg-surface-hover/30 transition-colors text-xs">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: FII_CATEGORY_COLORS[grp.key] ?? "#64748b" }}
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
                        {grp.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
