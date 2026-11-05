import { useMemo } from "react";
import { Layers, PieChart, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationDonutSegment } from "@/domain/reports";
import { cn } from "@/lib/utils";

export interface ReportAllocationDonutsProps {
  classSegments: readonly AllocationDonutSegment[];
  sectorSegments: readonly AllocationDonutSegment[];
  totalBRL: number;
  totalUniqueSectors?: number;
  variant?: "screen" | "print";
  className?: string;
  onClassClick?: (className: string) => void;
  onSectorClick?: (sectorName: string) => void;
}

/**
 * Seção de Gráficos Donut de Classes e Setores em Largura Total (w-full).
 * Padronizada com a anatomia canônica dos cards do sistema:
 * fundo bg-surface/90, borda border-border/80, sombra shadow-xs,
 * cabeçalho com ícone, título, subtítulo e badge semântico,
 * além de tabela analítica com Saldo (R$) e Peso (%).
 */
export function ReportAllocationDonuts({
  classSegments,
  sectorSegments,
  totalBRL,
  totalUniqueSectors,
  variant = "screen",
  className,
  onClassClick,
  onSectorClick,
}: ReportAllocationDonutsProps) {
  const preparedClassSegments: ReportDonutSegment[] = useMemo(
    () =>
      classSegments.map((s) => ({
        key: s.key,
        label: s.label,
        value: s.value,
        pct: s.pct,
        color: s.color,
        formattedValue: <MoneyText cents={numberToCents(s.value)} />,
      })),
    [classSegments],
  );

  const preparedSectorSegments: ReportDonutSegment[] = useMemo(
    () =>
      sectorSegments.map((s) => ({
        key: s.key,
        label: s.label,
        value: s.value,
        pct: s.pct,
        color: s.color,
        formattedValue: <MoneyText cents={numberToCents(s.value)} />,
      })),
    [sectorSegments],
  );

  if (classSegments.length === 0 && sectorSegments.length === 0) {
    return null;
  }

  const numSectors = totalUniqueSectors ?? sectorSegments.length;

  // Variante para o Dossiê Executivo A4 (Impressão/PDF em Largura Total sem fundo artificial)
  if (variant === "print") {
    return (
      <div className={cn("flex flex-col gap-3 w-full", className)}>
        {/* 1. Donut de Classes em Largura Total */}
        <div className="rounded-xl border border-border/80 bg-surface/90 p-3 print:bg-white print:border-border shadow-2xs break-inside-avoid w-full flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Composição por Classe de Ativos
                </h4>
                <p className="text-[10px] text-muted-foreground leading-none m-0">
                  Alocação percentual e volumetria do patrimônio consolidado
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="muted" size="sm">
                <span>{classSegments.length} classes</span>
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono num">
                Total: <strong className="text-foreground"><MoneyText cents={numberToCents(totalBRL)} /></strong>
              </span>
            </div>
          </div>

          <div className="flex flex-row items-center gap-4">
            <div className="shrink-0 flex justify-center py-1">
              <ReportDonutChart
                segments={preparedClassSegments}
                centerLabel="Patrimônio"
                centerValue={
                  <MoneyText
                    cents={numberToCents(totalBRL)}
                    className="text-[10px] font-bold whitespace-nowrap"
                  />
                }
                size={115}
                strokeWidth={13}
                showLegend={false}
              />
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-surface-hover/60 border-b border-border/70 text-[10.5px] font-semibold text-muted-foreground">
                      <th className="py-1 px-2.5 font-semibold text-left">Classe de Ativo</th>
                      <th className="py-1 px-2.5 text-right font-medium w-28 whitespace-nowrap">Saldo (R$)</th>
                      <th className="py-1 px-2.5 text-right font-medium w-16 whitespace-nowrap">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {classSegments.map((seg) => (
                      <tr key={seg.key} className="hover:bg-surface-hover/30 text-[10.5px]">
                        <td className="py-1 px-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: seg.color }}
                              aria-hidden="true"
                            />
                            <span className="font-medium text-foreground truncate">{seg.label}</span>
                          </div>
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                          <MoneyText cents={numberToCents(seg.value)} />
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                          {seg.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Donut de Setores em Largura Total */}
        <div className="rounded-xl border border-border/80 bg-surface/90 p-3 print:bg-white print:border-border shadow-2xs break-inside-avoid w-full flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Diversificação por Segmento & Indexador
                </h4>
                <p className="text-[10px] text-muted-foreground leading-none m-0">
                  Exposição por atividade econômica e indexadores ({numSectors} {numSectors === 1 ? "segmento" : "segmentos"})
                </p>
              </div>
            </div>
            <Badge variant="muted" size="sm">
              <span>{numSectors} {numSectors === 1 ? "segmento" : "segmentos"}</span>
            </Badge>
          </div>

          <div className="flex flex-row items-center gap-4">
            <div className="shrink-0 flex justify-center py-1">
              <ReportDonutChart
                segments={preparedSectorSegments}
                centerLabel="Setores"
                centerValue={<span className="text-[10px] font-bold text-foreground">{numSectors}</span>}
                size={115}
                strokeWidth={13}
                showLegend={false}
              />
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="rounded-lg border border-border/70 overflow-hidden text-xs">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-surface-hover/60 border-b border-border/70 text-[10.5px] font-semibold text-muted-foreground">
                      <th className="py-1 px-2.5 font-semibold text-left">Segmento / Indexador</th>
                      <th className="py-1 px-2.5 text-right font-medium w-28 whitespace-nowrap">Saldo (R$)</th>
                      <th className="py-1 px-2.5 text-right font-medium w-16 whitespace-nowrap">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sectorSegments.map((seg) => (
                      <tr key={seg.key} className="hover:bg-surface-hover/30 text-[10.5px]">
                        <td className="py-1 px-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: seg.color }}
                              aria-hidden="true"
                            />
                            <span className="font-medium text-foreground truncate">{seg.label}</span>
                          </div>
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                          <MoneyText cents={numberToCents(seg.value)} />
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                          {seg.pct.toFixed(1)}%
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
    );
  }

  // Variante Web Padrão (Tela / Navegador em Largura Total)
  return (
    <div className={cn("flex flex-col gap-4.5 w-full", className)}>
      {/* 1. Donut de Classes em Largura Total */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm sm:text-base font-bold text-foreground">
                Composição por Classe de Ativos
              </h4>
              <p className="text-[11px] text-muted-foreground leading-normal m-0">
                Alocação percentual e volumetria do patrimônio consolidado por macroclasse.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center">
              <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
              <span>{classSegments.length} classes de ativos</span>
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Donut Chart */}
          <div className="shrink-0 flex justify-center py-2">
            <ReportDonutChart
              segments={preparedClassSegments}
              centerLabel="Patrimônio"
              centerValue={
                <MoneyText
                  cents={numberToCents(totalBRL)}
                  className="text-xs font-bold tabular-nums tracking-tight whitespace-nowrap"
                />
              }
              size={140}
              strokeWidth={16}
              showLegend={false}
              onSegmentClick={onClassClick ? (seg) => onClassClick(seg.label) : undefined}
            />
          </div>

          {/* Tabela de Decomposição Analítica */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
            <div className="rounded-xl border border-border/70 overflow-hidden text-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/60 border-b border-border/70 text-[11px] font-semibold text-muted-foreground">
                    <th className="py-2 px-3 font-semibold text-left">Classe de Ativo</th>
                    <th className="py-2 px-3 text-right font-medium w-28 whitespace-nowrap">Saldo (R$)</th>
                    <th className="py-2 px-3 text-right font-medium w-16 whitespace-nowrap">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {classSegments.map((seg) => (
                    <tr
                      key={seg.key}
                      onClick={onClassClick ? () => onClassClick(seg.label) : undefined}
                      className={cn(
                        "hover:bg-surface-hover/30 transition-colors text-xs",
                        onClassClick && "cursor-pointer",
                      )}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground truncate">{seg.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                        <MoneyText cents={numberToCents(seg.value)} />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                        {seg.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Donut de Setores em Largura Total */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm sm:text-base font-bold text-foreground">
                Diversificação por Segmento & Indexador
              </h4>
              <p className="text-[11px] text-muted-foreground leading-normal m-0">
                Exposição por atividade econômica e indexadores ({numSectors}{" "}
                {numSectors === 1 ? "segmento registrado" : "segmentos registrados"}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center">
              <span>{numSectors} {numSectors === 1 ? "segmento" : "segmentos"}</span>
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Donut Chart */}
          <div className="shrink-0 flex justify-center py-2">
            <ReportDonutChart
              segments={preparedSectorSegments}
              centerLabel="Setores"
              centerValue={<span className="text-xs font-bold text-foreground">{numSectors}</span>}
              size={140}
              strokeWidth={16}
              showLegend={false}
              onSegmentClick={onSectorClick ? (seg) => onSectorClick(seg.label) : undefined}
            />
          </div>

          {/* Tabela de Decomposição Analítica */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
            <div className="rounded-xl border border-border/70 overflow-hidden text-xs max-h-72 overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/60 border-b border-border/70 text-[11px] font-semibold text-muted-foreground sticky top-0 bg-surface">
                    <th className="py-2 px-3 font-semibold text-left">Segmento / Indexador</th>
                    <th className="py-2 px-3 text-right font-medium w-28 whitespace-nowrap">Saldo (R$)</th>
                    <th className="py-2 px-3 text-right font-medium w-16 whitespace-nowrap">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sectorSegments.map((seg) => (
                    <tr
                      key={seg.key}
                      onClick={onSectorClick ? () => onSectorClick(seg.label) : undefined}
                      className={cn(
                        "hover:bg-surface-hover/30 transition-colors text-xs",
                        onSectorClick && "cursor-pointer",
                      )}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground truncate">{seg.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap">
                        <MoneyText cents={numberToCents(seg.value)} />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                        {seg.pct.toFixed(1)}%
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
  );
}
