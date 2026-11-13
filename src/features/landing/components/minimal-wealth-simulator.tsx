import { useState, useMemo } from "react";
import { Link } from "react-router";
import { PieChart, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, Info } from "lucide-react";
import {
  Badge,
  Card,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  buttonVariants,
} from "@/components/ui";
import { AllocationDonut, type AllocationSlice } from "@/components/modules/allocation-donut";
import { cn } from "@/lib/utils";
import { useLandingCta, useAnimatedNumber } from "@/features/landing/hooks";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { FireProjectionCurve } from "./fire-projection-curve";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import { numberToCents } from "@/domain/money";
import { storePendingSimulation } from "@/domain/share";
import {
  annualRateToMonthlyRate,
  resolveAllocationStatus,
  simulateStrategyAporte,
  STRATEGY_PRESETS,
  type StrategyPresetKey,
} from "@/domain/portfolio";

/** Parâmetros ilustrativos do simulador (explícitos — nunca escondidos no cálculo). */
const SIMULATION_ANNUAL_RATE = 8; // % a.a. de rentabilidade esperada
const SIMULATION_MONTHLY_LIVING_COST = 2500; // R$/mês de custo de vida desejado
const SIMULATION_HORIZON_YEARS = 25;

export function MinimalWealthSimulator() {
  const { trialUrl } = useLandingCta();
  const [strategy, setStrategy] = useState<StrategyPresetKey>("dividendos");
  const [patrimonyBase, setPatrimonyBase] = useState<number>(25000);
  const [aporteAmount, setAporteAmount] = useState<number>(3000);
  const [activeTab, setActiveTab] = useState<"alocacao" | "fire">("alocacao");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const currentStrategy = STRATEGY_PRESETS[strategy];

  // Cálculo do Rebalanceamento Determinístico via motor puro de domínio
  const rebalanceData = useMemo(() => {
    const simulation = simulateStrategyAporte({
      patrimonyBase,
      aporteAmount,
      classes: currentStrategy.classes,
    });

    // Fatias para o AllocationDonut oficial
    const donutSlices: AllocationSlice[] = simulation.allocations.map((cls) => ({
      key: cls.key,
      label: cls.name,
      valueCents: Math.round(cls.finalValue * 100),
      // "Pós-aporte" qualifica o percentual exibido (não é a posição atual)
      subtitle: `Pós-aporte ${formatPercent(cls.finalPct)}% · Meta ${formatPercent(cls.targetPercent)}%`,
    }));

    // Yield médio ponderado da carteira pós-aporte — fonte única da renda passiva
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
      weightedYield: simulation.allocations.reduce(
        (acc, cls) => acc + cls.finalValue * cls.yieldRate,
        0,
      ),
    };
  }, [currentStrategy, patrimonyBase, aporteAmount]);


  const animatedMonthlyPassive = useAnimatedNumber(rebalanceData.monthlyPassive, { duration: 300 });

  const formatBRL = (val: number) => {
    return formatCentsAsBRL(numberToCents(val), { hideCents: true });
  };

  const dimWhenUnselected = (key: string) =>
    selectedClass !== null && selectedClass !== key ? "opacity-50" : "";

  return (
    <section id="simulador" className="py-14 md:py-32 bg-surface/30 border-t border-border/60 scroll-mt-20">
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
            Selecione seu patrimônio, estratégia e valor de aporte. Veja o algoritmo identificar as classes defasadas e direcionar 100% dos recursos sem precisar vender ativos.
          </p>
        </ScrollReveal>

        {/* Card do Simulador com Gráfico Donut Real */}
        <ScrollReveal delay={100} className="mt-10 sm:mt-16 max-w-6xl mx-auto">
          <Card className="border-border/80 bg-surface/95 shadow-xl sm:shadow-2xl p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8 rounded-2xl sm:rounded-3xl backdrop-blur-2xl">
            {/* Controles Enxutos e Espaçosos de 3 Opções Claras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 border-b border-border/60 pb-5 sm:pb-8">
              {/* Controle 1: Patrimônio Atual */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-foreground">Patrimônio Atual:</span>
                  <span className="font-mono font-bold text-primary-strong dark:text-primary text-sm">{formatBRL(patrimonyBase)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[25000, 100000, 300000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        triggerSensory("selection", { skipSound: true });
                        setPatrimonyBase(val);
                      }}
                      className={cn(
                        "py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border text-center",
                        patrimonyBase === val
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                          : "bg-surface border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {`R$ ${val / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controle 2: Estratégia de Carteira */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-foreground">Perfil de Alocação:</span>
                  <span className="text-primary-strong dark:text-primary font-bold">{currentStrategy.buttonLabel}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STRATEGY_PRESETS) as StrategyPresetKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        triggerSensory("selection", { skipSound: true });
                        setStrategy(key);
                      }}
                      className={cn(
                        "py-2 sm:py-2.5 px-1 sm:px-1.5 rounded-lg sm:rounded-xl text-xs font-semibold transition-all cursor-pointer border text-center truncate",
                        strategy === key
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                          : "bg-surface border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {STRATEGY_PRESETS[key].buttonLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controle 3: Valor do Aporte a Simular */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-foreground">Aporte Mensal:</span>
                  <span className="font-mono font-bold text-primary-strong dark:text-primary text-sm">{formatBRL(aporteAmount)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1500, 3000, 6000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        triggerSensory("selection", { skipSound: true });
                        setAporteAmount(val);
                      }}
                      className={cn(
                        "py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border text-center",
                        aporteAmount === val
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                          : "bg-surface border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {`R$ ${val / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid Principal: Gráfico (Donut ou Curva Patrimonial) na Esquerda + Direcionamento na Direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
              {/* Coluna 1: Donut ou Curva Patrimonial em Abas */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-background/50 border border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full mb-3 sm:mb-4 gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {activeTab === "alocacao" ? "Composição da Carteira" : "Projeção Patrimonial"}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <Tabs
                      value={activeTab}
                      onValueChange={(value) => setActiveTab(value as "alocacao" | "fire")}
                      variant="pills"
                      ariaLabel="Modo de visualização gráfica"
                      className="shrink-0"
                      items={[
                        { value: "alocacao", label: "Aporte" },
                        { value: "fire", label: "Curva Patrimonial", shortLabel: "Curva" },
                      ]}
                    />
                    {activeTab === "alocacao" ? (
                      <Badge variant="muted" size="xs">
                        Pós-aporte
                      </Badge>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="cursor-pointer"
                            aria-label="Como calculamos a rentabilidade da projeção"
                          >
                            <Badge variant="default" size="xs" className="font-mono">
                              Retorno {formatPercent(SIMULATION_ANNUAL_RATE)}% a.a.
                            </Badge>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                          <p className="text-xs font-bold text-foreground">Rentabilidade da projeção</p>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            {formatPercent(SIMULATION_ANNUAL_RATE)}% ao ano equivalem a{" "}
                            {formatPercent(
                              annualRateToMonthlyRate(SIMULATION_ANNUAL_RATE) * 100,
                            )}
                            % ao mês, compostos com o aporte lançado ao fim de cada mês.
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                            A renda passiva usa o yield da carteira pós-aporte ({" "}
                            {formatPercent(rebalanceData.annualYieldPct)}% a.a.), não a rentabilidade
                            da projeção.
                          </p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>

                {activeTab === "alocacao" ? (
                  <AllocationDonut
                    slices={rebalanceData.donutSlices}
                    centerValue={formatBRL(rebalanceData.newTotalPatrimony)}
                    centerCaption="Pós-aporte"
                    selectedKey={selectedClass}
                    onSelectKey={setSelectedClass}
                    layout="side-by-side"
                    donutSize="sm"
                    className="w-full"
                  />
                ) : (
                  <div className="w-full">
                    <FireProjectionCurve
                      initialPatrimony={patrimonyBase}
                      monthlyAporte={aporteAmount}
                      monthlyExpenses={SIMULATION_MONTHLY_LIVING_COST}
                      annualRate={SIMULATION_ANNUAL_RATE / 100}
                      annualPassiveYield={rebalanceData.annualYieldPct / 100}
                      years={SIMULATION_HORIZON_YEARS}
                    />
                  </div>
                )}
              </div>

              {/* Coluna 2: Ação Calculada pelo Algoritmo */}
              <div className="lg:col-span-6 space-y-4 sm:space-y-5">
                <h3 className="flex items-center gap-2 text-base sm:text-xl font-bold text-foreground">
                  <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Seu próximo aporte de {formatBRL(aporteAmount)}</span>
                </h3>

                {/* Cards Dinâmicos de Ação por Classe */}
                <div className="space-y-2 sm:space-y-2.5">
                  {rebalanceData.allocations.map((cls) => {
                    if (cls.isReceivingAporte) {
                      const shareOfAporte = Math.round((cls.allocatedAmount / aporteAmount) * 100);
                      return (
                        <button
                          key={cls.key}
                          type="button"
                          onClick={() => setSelectedClass(selectedClass === cls.key ? null : cls.key)}
                          aria-pressed={selectedClass === cls.key}
                          className={cn(
                            "w-full text-left p-3 sm:p-3.5 rounded-xl border border-positive/40 bg-positive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 transition-all cursor-pointer hover:border-positive/60",
                            dimWhenUnselected(cls.key),
                          )}
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <CheckCircle2 className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-foreground">{cls.name}</div>
                              <div className="text-[11px] text-positive-strong dark:text-positive font-medium">
                                Hoje {formatPercent(cls.currentPct)}% · meta {formatPercent(cls.targetPercent)}% — abaixo da meta
                              </div>
                            </div>
                          </div>
                          <Badge variant="positive" size="xs" className="font-mono font-bold shrink-0 self-start sm:self-center">
                            +{formatBRL(cls.allocatedAmount)} ({shareOfAporte}%)
                          </Badge>
                        </button>
                      );
                    }

                    const status = resolveAllocationStatus(cls.finalPct, cls.targetPercent);

                    return (
                      <button
                        key={cls.key}
                        type="button"
                        onClick={() => setSelectedClass(selectedClass === cls.key ? null : cls.key)}
                        aria-pressed={selectedClass === cls.key}
                        className={cn(
                          "w-full text-left p-3 sm:p-3.5 rounded-xl border border-border/80 bg-background/40 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-border",
                          dimWhenUnselected(cls.key),
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-foreground">{cls.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {status === "above_target" ? "Acima da meta" : "Na meta"}: {formatPercent(cls.finalPct)}% · meta{" "}
                              {formatPercent(cls.targetPercent)}%
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">Sem aporte</span>
                      </button>
                    );
                  })}
                </div>

                {/* Métricas de Renda Passiva Estimada */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/20 text-primary-strong dark:text-primary">
                      <TrendingUp className="size-3.5 sm:size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-primary-strong dark:text-primary block">
                        Renda Passiva Mensal Estimada:
                      </span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Info className="size-3 shrink-0" aria-hidden="true" />
                            <span>
                              Yield ponderado de {formatPercent(rebalanceData.annualYieldPct)}% a.a.
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))]">
                          <p className="text-xs font-bold text-foreground">Como calculamos a renda passiva</p>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            Rendimento anual de cada classe dividido por 12 meses, somado sobre o
                            patrimônio pós-aporte.
                          </p>
                          <ul className="mt-2.5 space-y-1.5">
                            {rebalanceData.allocations.map((cls) => (
                              <li
                                key={cls.key}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="text-muted-foreground">
                                  {cls.name} · {formatPercent(cls.yieldRate * 100)}% a.a.
                                </span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {formatBRL((cls.finalValue * cls.yieldRate) / 12)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2.5 pt-2 border-t border-border/70 flex items-center justify-between text-[11px] font-semibold text-foreground">
                            <span>Total mensal</span>
                            <span className="font-mono tabular-nums">
                              {formatBRL(rebalanceData.monthlyPassive)}
                            </span>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <span className="font-mono text-lg sm:text-2xl font-extrabold text-foreground tabular-nums whitespace-nowrap self-end sm:self-center">
                    {formatBRL(animatedMonthlyPassive)} <span className="text-xs font-normal text-muted-foreground">/ mês</span>
                  </span>
                </div>
              </div>
            </div>

            {/* CTA Rodapé do Simulador */}
            <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-border/50">
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
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}

