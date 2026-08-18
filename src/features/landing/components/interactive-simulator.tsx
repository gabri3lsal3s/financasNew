import { useState, useMemo } from "react";
import { Flame, Calculator, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

export function InteractiveSimulator() {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1500);
  const [years, setYears] = useState<number>(15);
  const [annualRate, setAnnualRate] = useState<number>(10); // 10% a.a. nominal
  const [initialCapital, setInitialCapital] = useState<number>(20000);

  // Cálculo determinístico de juros compostos
  const simulation = useMemo(() => {
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const totalMonths = years * 12;

    let accumulated = initialCapital;
    let totalInvested = initialCapital;

    for (let m = 1; m <= totalMonths; m++) {
      accumulated = accumulated * (1 + monthlyRate) + monthlyContribution;
      totalInvested += monthlyContribution;
    }

    const totalInterest = accumulated - totalInvested;
    // Renda passiva mensal estimada pela regra dos 4% (0.33% ao mês segura)
    const monthlyPassiveIncome = (accumulated * 0.04) / 12;

    return {
      accumulated: Math.round(accumulated),
      totalInvested: Math.round(totalInvested),
      totalInterest: Math.round(totalInterest),
      monthlyPassiveIncome: Math.round(monthlyPassiveIncome),
    };
  }, [monthlyContribution, years, annualRate, initialCapital]);

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  return (
    <section id="simulador" className="py-16 md:py-24 relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-500">
            <Flame className="size-3.5" aria-hidden="true" />
            <span>Simulador de Independência FIRE</span>
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            Descubra o poder dos aportes consistentes no seu futuro
          </h2>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Ajuste os valores abaixo e veja em tempo real o patrimônio acumulado e a renda passiva mensal
            que você poderá gerar através do método FIRE.
          </p>
        </div>

        {/* Interactive Controls & Results Grid */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          {/* Controls Box (Left) */}
          <Card className="lg:col-span-6 border-border/80 bg-surface/90 shadow-md">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calculator className="size-5 text-primary" aria-hidden="true" />
                Parâmetros da Sua Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-6">
              {/* Patrimônio Inicial */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">Patrimônio Inicial:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatBRL(initialCapital)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 20000, 50000, 100000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setInitialCapital(val)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        initialCapital === val
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-surface border border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {val === 0 ? "R$ 0" : `R$ ${val / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aporte Mensal */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">Aporte Mensal:</span>
                  <span className="font-mono font-bold text-primary text-base">
                    {formatBRL(monthlyContribution)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1500, 3000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMonthlyContribution(val)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        monthlyContribution === val
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-surface border border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {val < 1000 ? `R$ ${val}` : `R$ ${(val / 1000).toFixed(1)}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prazo em Anos */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">Horizonte de Tempo:</span>
                  <span className="font-mono font-bold text-foreground">{years} anos</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setYears(val)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        years === val
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-surface border border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {val} anos
                    </button>
                  ))}
                </div>
              </div>

              {/* Taxa de Rentabilidade Anual */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">Rentabilidade Média Estimada:</span>
                  <span className="font-mono font-bold text-emerald-500">{annualRate}% a.a.</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[8, 10, 12].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAnnualRate(val)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        annualRate === val
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-surface border border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {val}% ao ano
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Box (Right) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <Card className="border-primary/40 bg-gradient-to-br from-surface to-primary/5 p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Resultado Estimado em {years} anos
                </span>
                <Badge variant="default" className="border border-primary/40 font-mono text-[11px]">
                  Regra 4% FIRE
                </Badge>
              </div>

              {/* Patrimônio Acumulado */}
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Patrimônio Acumulado:</div>
                <div className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold text-foreground">
                  {formatBRL(simulation.accumulated)}
                </div>
              </div>

              {/* Renda Passiva Mensal */}
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-500">
                    Renda Passiva Mensal Vitalícia (FIRE):
                  </span>
                  <Sparkles className="size-4 text-emerald-500" aria-hidden="true" />
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatBRL(simulation.monthlyPassiveIncome)} <span className="text-xs font-normal text-muted-foreground">/ mês</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-border/70 text-xs">
                <div>
                  <span className="text-muted-foreground">Total Investido do Bolso:</span>
                  <div className="mt-0.5 font-mono font-bold text-foreground">
                    {formatBRL(simulation.totalInvested)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Juros Compostos Ganhos:</span>
                  <div className="mt-0.5 font-mono font-bold text-emerald-500">
                    +{formatBRL(simulation.totalInterest)}
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/cadastro"
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:flex-1 font-semibold justify-center")}
              >
                Planejar Minha Liberdade Financeira
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
