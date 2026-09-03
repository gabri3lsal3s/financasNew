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
 * Grid duplo com gráficos Donut de Classes e Setores sincronizados.
 * Suporta modo tela web (interativo/amplo) e modo impressão A4 (compacto).
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

  // Variante para o Dossiê Executivo A4 (Impressão/PDF compacto)
  if (variant === "print") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid print:grid-cols-2",
          className,
        )}
      >
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3 print:bg-white print:border-border shadow-2xs flex flex-col gap-2">
          <div className="flex items-center gap-1.5 border-b border-border/70 pb-1">
            <Layers className="size-3 text-primary-strong shrink-0" aria-hidden="true" />
            <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Distribuição por Classe
            </h4>
          </div>
          <ReportDonutChart
            segments={preparedClassSegments}
            centerLabel="Total"
            centerValue={
              <MoneyText
                cents={numberToCents(totalBRL)}
                className="text-[9.5px] font-bold whitespace-nowrap"
              />
            }
            size={108}
            strokeWidth={11}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/10 p-3 print:bg-white print:border-border shadow-2xs flex flex-col gap-2">
          <div className="flex items-center gap-1.5 border-b border-border/70 pb-1">
            <PieChart className="size-3 text-primary-strong shrink-0" aria-hidden="true" />
            <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Exposição por Setor ({numSectors})
            </h4>
          </div>
          <ReportDonutChart
            segments={preparedSectorSegments}
            centerLabel="Setores"
            centerValue={<span className="text-[10px] font-bold text-foreground">{numSectors}</span>}
            size={108}
            strokeWidth={11}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>
      </div>
    );
  }

  // Variante Web Padrão (Tela / Navegador)
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/70 pb-2">
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
        <ReportDonutChart
          segments={preparedClassSegments}
          centerLabel="Patrimônio"
          centerValue={
            <MoneyText
              cents={numberToCents(totalBRL)}
              className="text-[11px] font-bold whitespace-nowrap"
            />
          }
          size={140}
          strokeWidth={14}
          className="border-0 bg-transparent p-0 shadow-none"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/70 pb-2">
          <PieChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
              Diversificação por Setor Econômico
            </h3>
            <span className="text-[11px] text-muted-foreground leading-tight">
              Concentração setorial e liquidez ({numSectors}{" "}
              {numSectors === 1 ? "setor" : "setores"})
            </span>
          </div>
        </div>
        <ReportDonutChart
          segments={preparedSectorSegments}
          centerLabel="Setores"
          centerValue={<span className="text-xs font-bold text-foreground">{numSectors}</span>}
          size={140}
          strokeWidth={14}
          className="border-0 bg-transparent p-0 shadow-none"
        />
      </div>
    </div>
  );
}
