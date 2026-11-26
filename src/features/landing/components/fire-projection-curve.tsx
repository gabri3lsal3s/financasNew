import { useCallback, useMemo, useRef, useState } from "react";
import { triggerSensory } from "@/services/sensory";
import { projectPatrimony, type ProjectionBasis } from "@/domain/portfolio/projection";
import { buildFireChartGeometry } from "@/domain/simulators/fire-curve";
import { cn } from "@/lib/utils";
import { FireInteractiveSvgChart } from "./fire-interactive-svg-chart";
import { FireProjectionMetrics } from "./fire-projection-metrics";

export interface FireProjectionCurveProps {
  /** Patrimônio atual em reais. */
  initialPatrimony?: number;
  /** Aporte mensal em reais. */
  monthlyAporte: number;
  /** Custo de vida mensal desejado em reais (base do capital crítico). */
  monthlyExpenses?: number;
  /** Rentabilidade anual esperada (decimal — 0.08 = 8% a.a.). */
  annualRate?: number;
  /** Yield anual da carteira usado na renda passiva (decimal). Default: `annualRate`. */
  annualPassiveYield?: number;
  years?: number;
  basis?: ProjectionBasis;
  className?: string;
}

/**
 * Curva de projeção patrimonial — a série vem do motor puro
 * `projectPatrimony` (domínio), nunca de cálculo local no componente.
 */
export function FireProjectionCurve({
  initialPatrimony = 0,
  monthlyAporte,
  monthlyExpenses = 2500,
  annualRate = 0.08,
  annualPassiveYield,
  years = 25,
  basis = "nominal",
  className,
}: FireProjectionCurveProps) {
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [realValues, setRealValues] = useState(basis === "real");
  const lastSensoryIndexRef = useRef<number | null>(null);

  const activeBasis: ProjectionBasis = realValues ? "real" : "nominal";

  const projection = useMemo(
    () =>
      projectPatrimony({
        initialCents: Math.round(initialPatrimony * 100),
        monthlyContributionCents: Math.round(monthlyAporte * 100),
        annualRatePercent: annualRate * 100,
        annualPassiveYieldPercent: (annualPassiveYield ?? annualRate) * 100,
        monthlyLivingCostCents: Math.round(monthlyExpenses * 100),
        years,
        basis: activeBasis,
      }),
    [initialPatrimony, monthlyAporte, annualRate, annualPassiveYield, monthlyExpenses, years, activeBasis],
  );

  const comparison = useMemo(() => {
    if (monthlyAporte <= 0) return null;
    return projectPatrimony({
      initialCents: Math.round(initialPatrimony * 100),
      monthlyContributionCents: 0,
      annualRatePercent: annualRate * 100,
      annualPassiveYieldPercent: (annualPassiveYield ?? annualRate) * 100,
      monthlyLivingCostCents: Math.round(monthlyExpenses * 100),
      years,
      basis: activeBasis,
    });
  }, [initialPatrimony, monthlyAporte, annualRate, annualPassiveYield, monthlyExpenses, years, activeBasis]);

  const geometry = useMemo(
    () => buildFireChartGeometry(projection, comparison),
    [projection, comparison],
  );

  const dataPoints = projection.years;
  const fireTarget = projection.independenceTargetCents;
  const activeIndex =
    scrubIndex !== null
      ? scrubIndex
      : geometry.fireCrossoverIndex !== -1
        ? geometry.fireCrossoverIndex
        : dataPoints.length - 1;

  const activePoint = dataPoints[activeIndex]!;
  const isFireReached = fireTarget !== null && activePoint.balanceCents >= fireTarget;

  const handleSelectIndex = useCallback(
    (nextRaw: number, emitSensory: boolean) => {
      const clamped = Math.max(0, Math.min(dataPoints.length - 1, nextRaw));
      if (emitSensory && clamped !== lastSensoryIndexRef.current) {
        lastSensoryIndexRef.current = clamped;
        triggerSensory("selection", { skipSound: true });
      }
      setScrubIndex(clamped);
    },
    [dataPoints.length],
  );

  const handleSelectMilestone = useCallback(
    (year: number) => {
      handleSelectIndex(year, true);
    },
    [handleSelectIndex],
  );

  return (
    <div className={cn("flex flex-col gap-3.5 sm:gap-4 w-full min-w-0 select-none", className)}>
      <FireInteractiveSvgChart
        years={years}
        dataPoints={dataPoints}
        activeIndex={activeIndex}
        activePoint={activePoint}
        geometry={geometry}
        fireTargetCents={fireTarget}
        isFireReached={isFireReached}
        onSelectIndex={handleSelectIndex}
      />
      <FireProjectionMetrics
        years={years}
        monthlyAporte={monthlyAporte}
        monthlyExpenses={monthlyExpenses}
        hasComparison={Boolean(geometry.comparisonPath)}
        realValues={realValues}
        onRealValuesChange={setRealValues}
        activePoint={activePoint}
        fireCrossover={geometry.fireCrossover}
        projection={projection}
        onSelectMilestone={handleSelectMilestone}
      />
    </div>
  );
}
