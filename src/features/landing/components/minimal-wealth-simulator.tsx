import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import type { AllocationSlice } from "@/components/modules/allocation-donut";
import { cn } from "@/lib/utils";
import { useAnimatedNumber } from "@/features/landing/hooks/use-animated-number";
import { useLandingCta } from "@/features/landing/hooks/use-landing-cta";
import { SimulatorInputsPanel } from "./simulator/simulator-inputs-panel";
import { SimulatorChartPanel } from "./simulator/simulator-chart-panel";
import { SimulatorAllocationResults } from "./simulator/simulator-allocation-results";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import { numberToCents } from "@/domain/money/parse";
import { storePendingSimulation } from "@/domain/share/simulation-transport";
import { setStoredInitialGoal } from "@/state/demo-mode/demo-storage";
import { simulateStrategyAporte } from "@/domain/portfolio/simulation";
import { STRATEGY_PRESETS, type StrategyPresetKey } from "@/domain/portfolio/simulation-presets";

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
    <Card className="border-border/80 bg-surface shadow-sm p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 rounded-2xl sm:rounded-3xl">
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
          onClick={() => {
            setStoredInitialGoal("investments");
            storePendingSimulation({
              type: "rebalance_simulator",
              classes: currentStrategy.classes.map((cls) => ({
                name: cls.name,
                targetPercent: cls.targetPercent,
              })),
              patrimonyBaseCents: numberToCents(patrimonyBase),
              aporteAmountCents: numberToCents(aporteAmount),
              selectedPreset: strategy,
            });
          }}
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
  );
}
