import { useMemo } from "react";
import { Layers, PieChart } from "lucide-react";
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
}

/**
 * Seção de Gráficos Donut de Classes e Setores em Largura Total (w-full).
 * Cada donut ocupa toda a largura horizontal, acomodando o gráfico à esquerda
 * e uma grade ampla de legenda à direita (2 a 3 colunas) sem sobreposição de textos.
 */
export function ReportAllocationDonuts({
  classSegments,
  sectorSegments,
  totalBRL,
  totalUniqueSectors,
  variant = "screen",
  className,
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

  // Variante para o Dossiê Executivo A4 (Impressão/PDF em Largura Total)
  if (variant === "print") {
    return (
      <div className={cn("flex flex-col gap-3.5 w-full break-inside-avoid", className)}>
        {/* 1. Donut de Classes em Largura Total */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 print:bg-white print:border-border shadow-2xs break-inside-avoid w-full flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Distribuição Consolidada por Classe de Ativos
              </h4>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono num">
              Total: <strong className="text-foreground"><MoneyText cents={numberToCents(totalBRL)} /></strong>
            </span>
          </div>

          <ReportDonutChart
            segments={preparedClassSegments}
            centerLabel="Patrimônio"
            centerValue={
              <MoneyText
                cents={numberToCents(totalBRL)}
                className="text-[9.5px] font-bold whitespace-nowrap"
              />
            }
            size={115}
            strokeWidth={12}
            className="border-0 bg-transparent p-0 shadow-none gap-5 w-full flex-row"
            legendClassName="grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-[10px]"
          />
        </div>

        {/* 2. Donut de Setores em Largura Total */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 print:bg-white print:border-border shadow-2xs break-inside-avoid w-full flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Diversificação & Exposição por Setor Econômico ({numSectors} {numSectors === 1 ? "setor" : "setores"})
              </h4>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono num">
              Representatividade Setorial
            </span>
          </div>

          <ReportDonutChart
            segments={preparedSectorSegments}
            centerLabel="Setores"
            centerValue={<span className="text-[10px] font-bold text-foreground">{numSectors}</span>}
            size={115}
            strokeWidth={12}
            className="border-0 bg-transparent p-0 shadow-none gap-5 w-full flex-row"
            legendClassName="grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-[10px]"
          />
        </div>
      </div>
    );
  }

  // Variante Web Padrão (Tela / Navegador em Largura Total)
  return (
    <div className={cn("flex flex-col gap-4 w-full", className)}>
      {/* 1. Donut de Classes em Largura Total */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs w-full">
        <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                Composição por Classe de Ativos
              </h3>
              <span className="text-[11px] text-muted-foreground leading-tight">
                Alocação percentual e volumetria do patrimônio consolidado
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-mono num hidden sm:inline-block">
            Total: <strong className="text-foreground"><MoneyText cents={numberToCents(totalBRL)} /></strong>
          </span>
        </div>

        <ReportDonutChart
          segments={preparedClassSegments}
          centerLabel="Patrimônio"
          centerValue={
            <MoneyText
              cents={numberToCents(totalBRL)}
              className="text-[11px] font-bold whitespace-nowrap"
            />
          }
          size={135}
          strokeWidth={14}
          className="border-0 bg-transparent p-0 shadow-none gap-6 w-full flex-col sm:flex-row"
          legendClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs"
        />
      </div>

      {/* 2. Donut de Setores em Largura Total */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs w-full">
        <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                Diversificação por Setor Econômico
              </h3>
              <span className="text-[11px] text-muted-foreground leading-tight">
                Exposição setorial detalhada da carteira ({numSectors}{" "}
                {numSectors === 1 ? "setor" : "setores"})
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-mono num hidden sm:inline-block">
            {numSectors} {numSectors === 1 ? "setor registrado" : "setores registrados"}
          </span>
        </div>

        <ReportDonutChart
          segments={preparedSectorSegments}
          centerLabel="Setores"
          centerValue={<span className="text-xs font-bold text-foreground">{numSectors}</span>}
          size={135}
          strokeWidth={14}
          className="border-0 bg-transparent p-0 shadow-none gap-6 w-full flex-col sm:flex-row"
          legendClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs"
        />
      </div>
    </div>
  );
}
