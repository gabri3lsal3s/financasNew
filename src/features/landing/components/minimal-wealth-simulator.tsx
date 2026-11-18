import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, PieChart } from "lucide-react";
import { Card, buttonVariants } from "@/components/ui";
import type { AllocationSlice } from "@/components/modules/allocation-donut";
import { cn } from "@/lib/utils";
import { useAnimatedNumber, useLandingCta } from "@/features/landing/hooks";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { SimulatorInputsPanel } from "./simulator/simulator-inputs-panel";
import { SimulatorChartPanel } from "./simulator/simulator-chart-panel";
import { SimulatorAllocationResults } from "./simulator/simulator-allocation-results";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import { numberToCents } from "@/domain/money";
import { storePendingSimulation } from "@/domain/share";
import {
  simulateStrategyAporte,
  STRATEGY_PRESETS,
  type StrategyPresetKey,
} from "@/domain/portfolio";

const SIMULATION_ANNUAL_RATE = 8;
const SIMULATION_MONTHLY_LIVING_COST = 2500;
const SIMULATION_HORIZON_YEARS = 25;

export function MinimalWealthSimulator() {
  const { trialUrl } = useLandingCta();
  const [strategy, setStrategy] = useState<StrategyPresetKey>("dividendos");
  const [patrimonyBase, setPatrimonyBase] = useState<number>(25000);
  const [aporteAmount, setAporteAmount] = useState<number>(3000);
  const [activeTab, setActiveTab] = useState<"alocacao" | "fire">("alocacao");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const currentStrategy = STRATEGY_PRESETS[strategy];

  const rebalanceData = useMemo(() => {
    const simulation = simulateStrategyAporte({
      patrimonyBase,
      aporteAmount,
      classes: currentStrategy.classes,
    });

    const donutSlices: AllocationSlice[] = simulation.allocations.map((cls) => ({
      key: cls.key,
      label: cls.name,
      valueCents: Math.round(cls.finalValue * 100),
      subtitle: `Pós-aporte ${formatPercent(cls.finalPct)}% · Meta ${formatPercent(cls.targetPercent)}%`,
    }));

    const annualYieldPct =
      simulation.newTotalPatrimony > 0
        ? (simulation.allocations.reduce((acc, cls) => acc + cls.finalValue * cls.yieldRate, 0) /
            simulation.newTotalPatrimony) *
          100
        : 0;

    return {
      newTotalPatrimony: simulation.newTotalPatrimony,
      allocations: simulation.allocations,
      donutSlices,
      monthlyPassive: simulation.monthlyPassive,
      annualYieldPct,
    };
  }, [currentStrategy, patrimonyBase, aporteAmount]);

  const animatedMonthlyPassive = useAnimatedNumber(rebalanceData.monthlyPassive, { duration: 300 });
  const totalPatrimonyLabel = formatCentsAsBRL(numberToCents(rebalanceData.newTotalPatrimony), {
    hideCents: true,
  });

  return (
    <section
      id="simulador"
      className="py-14 md:py-32 bg-surface-raised/30 border-t border-border/60 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <PieChart className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Rebalanceamento sem vender ativos</span>
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Simulador de Carteira & Aportes Inteligentes
          </h2>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Selecione seu patrimônio, estratégia e valor de aporte. Veja o algoritmo identificar as
            classes defasadas e direcionar 100% dos recursos sem precisar vender ativos.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100} className="mt-10 sm:mt-16 max-w-6xl mx-auto">
          <Card className="border-border/80 bg-surface shadow-xl sm:shadow-2xl p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8 rounded-2xl sm:rounded-3xl">
            <SimulatorInputsPanel
              strategy={strategy}
              onStrategyChange={setStrategy}
              patrimonyBase={patrimonyBase}
              onPatrimonyBaseChange={setPatrimonyBase}
              aporteAmount={aporteAmount}
              onAporteAmountChange={setAporteAmount}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
              <SimulatorChartPanel
                activeTab={activeTab}
                onTabChange={setActiveTab}
                donutSlices={rebalanceData.donutSlices}
                totalPatrimonyLabel={totalPatrimonyLabel}
                selectedClass={selectedClass}
                onSelectClass={setSelectedClass}
                patrimonyBase={patrimonyBase}
                aporteAmount={aporteAmount}
                annualYieldPct={rebalanceData.annualYieldPct}
                annualRate={SIMULATION_ANNUAL_RATE}
                monthlyLivingCost={SIMULATION_MONTHLY_LIVING_COST}
                horizonYears={SIMULATION_HORIZON_YEARS}
              />

              <SimulatorAllocationResults
                aporteAmount={aporteAmount}
                allocations={rebalanceData.allocations}
                selectedClass={selectedClass}
                onSelectClass={setSelectedClass}
                annualYieldPct={rebalanceData.annualYieldPct}
                monthlyPassive={rebalanceData.monthlyPassive}
                animatedMonthlyPassive={animatedMonthlyPassive}
              />
            </div>

            <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-border/60">
              <span className="text-[11px] text-muted-foreground text-center sm:text-left leading-relaxed">
                Simulação ilustrativa, sem recomendação de investimento (Resoluções CVM 19/20).
              </span>
              <Link
                to={trialUrl}
                onClick={() =>
                  storePendingSimulation({
                    type: "rebalance_simulator",
                    classes: currentStrategy.classes.map((cls) => ({
                      name: cls.name,
                      targetPercent: cls.targetPercent,
                    })),
                    patrimonyBaseCents: numberToCents(patrimonyBase),
                    aporteAmountCents: numberToCents(aporteAmount),
                    selectedPreset: strategy,
                  })
                }
                aria-label="Organizar investimentos e começar teste gratuito de 30 dias"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "w-full sm:w-auto px-6 font-semibold inline-flex items-center justify-center gap-2 group shadow-xs rounded-xl shrink-0",
                )}
              >
                <span>Organizar Meus Investimentos</span>
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
