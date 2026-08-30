import { useState, useMemo } from "react";
import { Link } from "react-router";
import { PieChart, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, Badge, buttonVariants } from "@/components/ui";
import { AllocationDonut, type AllocationSlice } from "@/components/modules/allocation-donut";
import { cn } from "@/lib/utils";
import { useLandingCta, useAnimatedNumber } from "@/features/landing/hooks";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { FireProjectionCurve } from "./fire-projection-curve";
import { triggerSensory } from "@/services/sensory";

type StrategyKey = "dividendos" | "multimercado" | "crescimento";

interface ClassTarget {
  key: string;
  name: string;
  targetPercent: number;
  /** Proporção atual defasada da carteira antes do aporte (para simular o desbalanceamento real de mercado) */
  currentProportion: number;
  yieldRate: number; // taxa anual de dividendos/proventos
}

interface StrategyConfig {
  label: string;
  buttonLabel: string;
  tag: string;
  description: string;
  classes: ClassTarget[];
}

const STRATEGIES: Record<StrategyKey, StrategyConfig> = {
  dividendos: {
    label: "Foco em Dividendos",
    buttonLabel: "Dividendos",
    tag: "Geração de Renda",
    description: "Prioridade para proventos mensais recorrentes com Fundos Imobiliários e Ações de dividendos.",
    classes: [
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 40, currentProportion: 0.28, yieldRate: 0.10 },
      { key: "acoes", name: "Ações de Dividendos", targetPercent: 30, currentProportion: 0.23, yieldRate: 0.085 },
      { key: "rf", name: "Renda Fixa CDI", targetPercent: 20, currentProportion: 0.37, yieldRate: 0.06 },
      { key: "global", name: "REITs Globais", targetPercent: 10, currentProportion: 0.12, yieldRate: 0.05 },
    ],
  },
  multimercado: {
    label: "Multi-Mercado Global",
    buttonLabel: "Global",
    tag: "Diversificação Ampla",
    description: "Equilíbrio entre Bolsa Brasil, Renda Fixa e Exposição Internacional em Dólar.",
    classes: [
      { key: "global", name: "Ativos Globais / Dólar", targetPercent: 25, currentProportion: 0.15, yieldRate: 0.035 },
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 20, currentProportion: 0.14, yieldRate: 0.095 },
      { key: "acoes", name: "Ações Brasil", targetPercent: 25, currentProportion: 0.29, yieldRate: 0.07 },
      { key: "rf", name: "Renda Fixa IPCA+", targetPercent: 30, currentProportion: 0.42, yieldRate: 0.065 },
    ],
  },
  crescimento: {
    label: "Crescimento & Ações",
    buttonLabel: "Crescimento",
    tag: "Multiplicação de Capital",
    description: "Maior exposição à valorização de empresas e tecnologia com horizonte de longo prazo.",
    classes: [
      { key: "acoes", name: "Ações Brasil Growth", targetPercent: 40, currentProportion: 0.26, yieldRate: 0.045 },
      { key: "global", name: "Tech Global / Nasdaq", targetPercent: 30, currentProportion: 0.20, yieldRate: 0.02 },
      { key: "fiis", name: "FIIs de Tijolo", targetPercent: 15, currentProportion: 0.21, yieldRate: 0.085 },
      { key: "rf", name: "Reserva de Oportunidade", targetPercent: 15, currentProportion: 0.33, yieldRate: 0.06 },
    ],
  },
};

export function MinimalWealthSimulator() {
  const { trialUrl } = useLandingCta();
  const [strategy, setStrategy] = useState<StrategyKey>("dividendos");
  const [patrimonyBase, setPatrimonyBase] = useState<number>(25000);
  const [aporteAmount, setAporteAmount] = useState<number>(3000);
  const [activeTab, setActiveTab] = useState<"alocacao" | "fire">("alocacao");

  const currentStrategy = STRATEGIES[strategy];

  // Cálculo do Rebalanceamento Determinístico
  const rebalanceData = useMemo(() => {
    // 1. Valores atuais de cada classe antes do aporte
    const currentValues = currentStrategy.classes.map((cls) => ({
      ...cls,
      currentValue: patrimonyBase * cls.currentProportion,
    }));

    // 2. Novo patrimônio total após o aporte
    const newTotalPatrimony = patrimonyBase + aporteAmount;

    // 3. Valor ideal de cada classe com base na meta percentual
    const idealValues = currentValues.map((cls) => ({
      ...cls,
      targetValue: newTotalPatrimony * (cls.targetPercent / 100),
    }));

    // 4. Déficit de cada classe (quanto falta para atingir o alvo ideal)
    const deficits = idealValues.map((cls) => ({
      ...cls,
      deficit: Math.max(0, cls.targetValue - cls.currentValue),
    }));

    const totalDeficit = deficits.reduce((sum, cls) => sum + cls.deficit, 0);

    // 5. Distribuição proporcional do aporte entre as classes deficitárias
    const allocations = deficits.map((cls) => {
      let allocated = 0;
      if (totalDeficit > 0 && cls.deficit > 0) {
        allocated = Math.round((cls.deficit / totalDeficit) * aporteAmount);
      }
      const finalValue = cls.currentValue + allocated;
      const currentPct = Math.round((cls.currentValue / patrimonyBase) * 100);
      const finalPct = Math.round((finalValue / newTotalPatrimony) * 100);

      return {
        ...cls,
        allocatedAmount: allocated,
        finalValue,
        currentPct,
        finalPct,
        isReceivingAporte: allocated > 0,
      };
    });

    // Ajuste de resíduo de centavos/arredondamento no maior aporte
    const allocatedSum = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const diff = aporteAmount - allocatedSum;
    if (diff !== 0) {
      const highest = allocations.reduce((prev, curr) => (curr.allocatedAmount > prev.allocatedAmount ? curr : prev));
      highest.allocatedAmount += diff;
      highest.finalValue += diff;
    }

    // Fatias para o AllocationDonut oficial
    const donutSlices: AllocationSlice[] = allocations.map((cls) => ({
      key: cls.key,
      label: cls.name,
      valueCents: Math.round(cls.finalValue * 100),
      subtitle: `Meta: ${cls.targetPercent}% · Atual: ${cls.finalPct}%`,
    }));

    // Estimativa de renda passiva mensal pós-aporte
    const annualDividends = allocations.reduce(
      (sum, cls) => sum + cls.finalValue * cls.yieldRate,
      0,
    );
    const monthlyPassive = Math.round(annualDividends / 12);

    return {
      newTotalPatrimony,
      allocations,
      donutSlices,
      monthlyPassive,
    };
  }, [currentStrategy, patrimonyBase, aporteAmount]);

  const animatedMonthlyPassive = useAnimatedNumber(rebalanceData.monthlyPassive, { duration: 300 });

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  return (
    <section id="simulador" className="py-14 md:py-32 bg-surface/30 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <PieChart className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Motor de Rebalanceamento Determinístico</span>
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
                  <span className="font-mono font-bold text-primary text-sm">{formatBRL(patrimonyBase)}</span>
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
                <span className="text-[11px] text-muted-foreground block">Posição atual acumulada</span>
              </div>

              {/* Controle 2: Estratégia de Carteira */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-foreground">Perfil de Alocação:</span>
                  <span className="text-primary font-bold">{currentStrategy.buttonLabel}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STRATEGIES) as StrategyKey[]).map((key) => (
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
                      {STRATEGIES[key].buttonLabel}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground block truncate">{currentStrategy.tag}</span>
              </div>

              {/* Controle 3: Valor do Aporte a Simular */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-foreground">Aporte Mensal:</span>
                  <span className="font-mono font-bold text-primary text-sm">{formatBRL(aporteAmount)}</span>
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
                <span className="text-[11px] text-muted-foreground block">Novo capital a aportar</span>
              </div>
            </div>

            {/* Grid Principal: Gráfico (Donut ou Curva FIRE) na Esquerda + Direcionamento na Direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
              {/* Coluna 1: Donut ou Curva FIRE em Abas */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-background/50 border border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full mb-3 sm:mb-4 gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {activeTab === "alocacao" ? "Composição da Carteira" : "Projeção FIRE"}
                  </span>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5" role="tablist" aria-label="Modo de visualização gráfica">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "alocacao"}
                        onClick={() => {
                          triggerSensory("selection", { skipSound: true });
                          setActiveTab("alocacao");
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          activeTab === "alocacao"
                            ? "bg-surface text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Aporte
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "fire"}
                        onClick={() => {
                          triggerSensory("selection", { skipSound: true });
                          setActiveTab("fire");
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          activeTab === "fire"
                            ? "bg-surface text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Curva FIRE
                      </button>
                    </div>
                    <Badge variant="positive" size="xs" className="font-mono">
                      {activeTab === "alocacao" ? "Pós-Aporte" : "Rentabilidade: 8% a.a."}
                    </Badge>
                  </div>
                </div>

                {activeTab === "alocacao" ? (
                  <AllocationDonut
                    slices={rebalanceData.donutSlices}
                    centerValue={formatBRL(rebalanceData.newTotalPatrimony)}
                    layout="side-by-side"
                    donutSize="sm"
                    className="w-full"
                  />
                ) : (
                  <div className="w-full">
                    <FireProjectionCurve
                      initialPatrimony={patrimonyBase}
                      monthlyAporte={aporteAmount}
                      monthlyExpenses={Math.max(2500, Math.round((patrimonyBase * 0.04) / 12))}
                      annualRate={0.08}
                      years={25}
                    />
                  </div>
                )}
              </div>

              {/* Coluna 2: Ação Calculada pelo Algoritmo */}
              <div className="lg:col-span-6 space-y-4 sm:space-y-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    <span>Cálculo de Aporte em Tempo Real</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-foreground mt-1">
                    Direcionamento Recomendado para {formatBRL(aporteAmount)}:
                  </h3>
                </div>

                {/* Cards Dinâmicos de Ação por Classe */}
                <div className="space-y-2 sm:space-y-2.5">
                  {rebalanceData.allocations.map((cls) => {
                    if (cls.isReceivingAporte) {
                      const shareOfAporte = Math.round((cls.allocatedAmount / aporteAmount) * 100);
                      return (
                        <div
                          key={cls.key}
                          className="p-3 sm:p-3.5 rounded-xl border border-positive/40 bg-positive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 transition-all"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <CheckCircle2 className="size-4 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-foreground">{cls.name}</div>
                              <div className="text-[11px] text-positive-strong dark:text-positive font-medium">
                                Atual: {cls.currentPct}% · Meta: {cls.targetPercent}% (Comprando na defasagem)
                              </div>
                            </div>
                          </div>
                          <Badge variant="positive" size="xs" className="font-mono font-bold shrink-0 self-start sm:self-center">
                            +{formatBRL(cls.allocatedAmount)} ({shareOfAporte}%)
                          </Badge>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={cls.key}
                        className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/40 flex items-center justify-between gap-2 opacity-75"
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-foreground">{cls.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Alocação balanceada ({cls.currentPct}% / Meta: {cls.targetPercent}%)
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">Aguardar</span>
                      </div>
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
                      <span className="text-[11px] text-muted-foreground">Proventos & Dividendos recorrentes</span>
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
              <span className="text-xs text-muted-foreground text-center sm:text-left">
                Zero giro de carteira e zero DARF: o algoritmo equilibra seu patrimônio apenas direcionando novos aportes.
              </span>
              <Link
                to={trialUrl}
                className={cn(
                  buttonVariants({ size: "default" }),
                  "w-full sm:w-auto px-6 font-semibold inline-flex items-center justify-center gap-2 group shadow-xs rounded-xl",
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

