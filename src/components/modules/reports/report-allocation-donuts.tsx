import { useMemo } from "react";
import { Layers, PieChart, ShieldCheck } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationDonutSegment } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { ReportAllocationDonutCard } from "./report-allocation-donut-card";
import type { ReportDonutSegment } from "./report-donut-chart";

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

function toPreparedSegments(segments: readonly AllocationDonutSegment[]): ReportDonutSegment[] {
  return segments.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
    pct: s.pct,
    color: s.color,
    formattedValue: <MoneyText cents={numberToCents(s.value)} tone="default" />,
  }));
}

/**
 * Seção de Gráficos Donut de Classes e Setores em Largura Total (w-full).
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
  const preparedClassSegments = useMemo(() => toPreparedSegments(classSegments), [classSegments]);
  const preparedSectorSegments = useMemo(() => toPreparedSegments(sectorSegments), [sectorSegments]);

  if (classSegments.length === 0 && sectorSegments.length === 0) {
    return null;
  }

  // Contagem estritamente vinculada às linhas renderizadas (BUG-16)
  const numSectors = sectorSegments.length;
  const isGrouped = Boolean(totalUniqueSectors && totalUniqueSectors > numSectors);
  const totalCents = numberToCents(totalBRL);
  const isPrint = variant === "print";

  const sectorSubtitle = isPrint
    ? isGrouped
      ? `Exposição por atividade econômica e indexadores (${numSectors} segmentos agrupados de ${totalUniqueSectors} totais)`
      : `Exposição por atividade econômica e indexadores (${numSectors} ${numSectors === 1 ? "segmento" : "segmentos"})`
    : isGrouped
      ? `Exposição por atividade econômica e indexadores (${numSectors} segmentos agrupados de ${totalUniqueSectors} totais).`
      : `Exposição por atividade econômica e indexadores (${numSectors} ${numSectors === 1 ? "segmento registrado" : "segmentos registrados"}).`;

  return (
    <div className={cn("flex flex-col w-full", isPrint ? "gap-3" : "gap-4", className)}>
      <ReportAllocationDonutCard
        icon={Layers}
        title="Composição por Classe de Ativos"
        subtitle={
          isPrint
            ? "Alocação percentual e volumetria do patrimônio consolidado"
            : "Alocação percentual e volumetria do patrimônio consolidado por macroclasse."
        }
        badgeText={isPrint ? `${classSegments.length} classes` : `${classSegments.length} classes de ativos`}
        badgeIcon={isPrint ? undefined : ShieldCheck}
        columnHeader="Classe de Ativo"
        centerLabel="Patrimônio"
        centerValue={
          <MoneyText
            cents={totalCents}
            tone="default"
            className={isPrint ? "text-[10px] font-bold whitespace-nowrap" : "text-xs font-bold whitespace-nowrap"}
          />
        }
        headerRightExtra={
          isPrint ? (
            <span className="text-[10px] text-muted-foreground font-mono num whitespace-nowrap">
              Total: <strong className="text-foreground"><MoneyText cents={totalCents} tone="default" /></strong>
            </span>
          ) : undefined
        }
        segments={classSegments}
        preparedSegments={preparedClassSegments}
        variant={variant}
        onSegmentClick={isPrint ? undefined : onClassClick}
      />

      <ReportAllocationDonutCard
        icon={PieChart}
        title="Diversificação por Segmento & Indexador"
        subtitle={sectorSubtitle}
        badgeText={`${numSectors} ${numSectors === 1 ? "segmento" : "segmentos"}`}
        columnHeader="Segmento / Indexador"
        centerLabel="Setores"
        centerValue={<span className={cn("font-bold text-foreground font-mono tabular-nums", isPrint ? "text-[10px]" : "text-xs")}>{numSectors}</span>}
        segments={sectorSegments}
        preparedSegments={preparedSectorSegments}
        variant={variant}
        onSegmentClick={isPrint ? undefined : onSectorClick}
      />
    </div>
  );
}
