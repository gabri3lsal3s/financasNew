import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  Flame,
  Calendar,
  Zap,
  Link2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  MoneyInput,
  PercentInput,
  NumericInput,
  MoneyText,
} from "@/components/ui";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import { calculateCompoundInterest, calculateCriticalCapital } from "@/domain/portfolio";
import {
  buildStatefulUrl,
  decodeCompoundInterestState,
  type CompoundInterestShareState,
  type PendingCompoundInterestSimulation,
} from "@/domain/share";
import { getPublicAppUrl } from "@/services/app-url";
import { useDocumentMeta } from "@/hooks/use-document-meta";

export function CompoundInterestPage() {
  const [searchParams] = useSearchParams();

  // Carrega parâmetros a partir de stateful URL se presente
  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeCompoundInterestState(param) : null;
  }, [searchParams]);

  const [initialAmountCents, setInitialAmountCents] = useState<number>(
    () => sharedState?.initialAmountCents ?? 1000000, // R$ 10.000,00
  );
  const [monthlyContributionCents, setMonthlyContributionCents] = useState<number>(
    () => sharedState?.monthlyContributionCents ?? 150000, // R$ 1.500,00
  );
  const [annualRatePercent, setAnnualRatePercent] = useState<number>(
    () => sharedState?.annualRatePercent ?? 10.0, // 10% a.a.
  );
  const [periodYears, setPeriodYears] = useState<number>(
    () => sharedState?.periodYears ?? 20, // 20 anos
  );
  const [monthlyLivingCostCents, setMonthlyLivingCostCents] = useState<number>(
    () => sharedState?.monthlyLivingCostCents ?? 500000, // R$ 5.000,00/mês
  );

  useDocumentMeta({
    title: "Simulador de Juros Compostos e Independência Financeira — Axir",
    description:
      "Projete seu patrimônio com juros compostos, aportes mensais e inflação, e descubra o ano em que a renda passiva cobre seu custo de vida.",
    canonicalPath: "/ferramentas/juros-compostos",
  });

  const result = useMemo(() => {
    return calculateCompoundInterest({
      initialAmountCents,
      monthlyContributionCents,
      annualRatePercent,
      periodYears,
      monthlyLivingCostCents,
    });
  }, [
    initialAmountCents,
    monthlyContributionCents,
    annualRatePercent,
    periodYears,
    monthlyLivingCostCents,
  ]);

  const interestPercentage = useMemo(() => {
    if (result.finalBalanceCents <= 0) return 0;
    return Math.round((result.totalInterestCents / result.finalBalanceCents) * 100);
  }, [result]);

  const criticalCapitalCents = useMemo(
    () => calculateCriticalCapital({ monthlyLivingCostCents }),
    [monthlyLivingCostCents],
  );

  const getShareUrl = () => {
    const state: CompoundInterestShareState = {
      initialAmountCents,
      monthlyContributionCents,
      annualRatePercent,
      periodYears,
      monthlyLivingCostCents,
    };
    return buildStatefulUrl(getPublicAppUrl("ferramentas/juros-compostos"), state);
  };

  const simulationPayload: PendingCompoundInterestSimulation = useMemo(
    () => ({
      type: "compound_interest",
      initialAmountCents,
      monthlyContributionCents,
      annualRatePercent,
      periodYears,
      monthlyLivingCostCents,
    }),
    [
      initialAmountCents,
      monthlyContributionCents,
      annualRatePercent,
      periodYears,
      monthlyLivingCostCents,
    ],
  );

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between">
      <ToolsHeader />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Cabeçalho Editorial */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" size="sm">
                Ferramenta Gratuita
              </Badge>
              <Badge variant="positive" size="sm">
                Planejamento FIRE & Independência Financeira
              </Badge>
              {sharedState && (
                <Badge variant="warning" size="sm" className="gap-1">
                  <Link2 className="size-3 shrink-0" aria-hidden="true" />
                  <span>Simulação Compartilhada</span>
                </Badge>
              )}
            </div>
            <ShareSimulationButton
              getShareUrl={getShareUrl}
              simulationTitle="Juros Compostos & FIRE"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Juros Compostos & Independência Financeira
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Projete o efeito exponencial do tempo e dos aportes sobre seu patrimônio.
            Descubra quando o retorno dos seus investimentos ultrapassará o esforço do seu próprio trabalho.
          </p>
        </section>

        {/* Parâmetros de Entrada */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Patrimônio Inicial
              </span>
              <div className="pt-1">
                <MoneyInput
                  cents={initialAmountCents}
                  onCentsChange={setInitialAmountCents}
                  size="md"
                  aria-label="Patrimônio inicial"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Aporte Mensal
              </span>
              <div className="pt-1">
                <MoneyInput
                  cents={monthlyContributionCents}
                  onCentsChange={setMonthlyContributionCents}
                  size="md"
                  aria-label="Aporte mensal"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Rentabilidade (% a.a.)
              </span>
              <div className="pt-1">
                <PercentInput
                  value={annualRatePercent}
                  onValueChange={setAnnualRatePercent}
                  size="md"
                  aria-label="Taxa de juros anual estimada"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Período (Anos)
              </span>
              <div className="pt-1">
                <NumericInput
                  value={periodYears}
                  onValueChange={(val) => setPeriodYears(Math.max(1, Math.min(50, Number(val) || 1)))}
                  size="md"
                  aria-label="Período em anos"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Custo de Vida Alvo
              </span>
              <div className="pt-1">
                <MoneyInput
                  cents={monthlyLivingCostCents}
                  onCentsChange={setMonthlyLivingCostCents}
                  size="md"
                  aria-label="Custo de vida mensal almejado na aposentadoria"
                />
              </div>
            </CardHeader>
          </Card>
        </section>

        {/* KPIs de Resultados */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 bg-surface shadow-xs bg-primary/5">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-primary">
                Patrimônio Final Projetado
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                <MoneyText
                  cents={result.finalBalanceCents}
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Em {periodYears} anos de acumulação
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Renda Passiva Mensal Estimada
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
                <MoneyText
                  cents={result.monthlyPassiveIncomeCents}
                  tone="positive"
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Sem consumir o patrimônio principal
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Total em Juros Acumulados
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
                <MoneyText
                  cents={result.totalInterestCents}
                  tone="positive"
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {interestPercentage}% do patrimônio gerado por juros
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Total Aportado por Você
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                <MoneyText
                  cents={result.totalContributedCents}
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Capital saído diretamente do seu bolso
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Marcos e Pontos de Inflexão FIRE */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Zap className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-foreground">Ponto de Inflexão</h4>
              {result.interestExceedsContributionAt ? (
                <p className="text-muted-foreground">
                  No <strong className="text-foreground">Ano {result.interestExceedsContributionAt.year} (Mês {result.interestExceedsContributionAt.month})</strong>,
                  o rendimento mensal dos juros superará o seu aporte mensal.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Ainda não atingido no período simulado. Aumente o prazo ou a taxa.
                </p>
              )}
            </div>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-positive/10 text-positive-strong shrink-0">
              <Flame className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-foreground">Independência Financeira (FIRE)</h4>
                {criticalCapitalCents > 0 && (
                  <span className="text-[11px] font-mono font-medium text-muted-foreground">
                    Meta: <MoneyText cents={criticalCapitalCents} className="inline text-foreground font-semibold" />
                  </span>
                )}
              </div>
              {result.fireReachedAt ? (
                <p className="text-muted-foreground">
                  No <strong className="text-positive-strong">Ano {result.fireReachedAt.year} (Mês {result.fireReachedAt.month})</strong>,
                  sua renda passiva cobrirá seu custo de vida de{" "}
                  <MoneyText cents={monthlyLivingCostCents} className="inline font-bold" />
                  /mês.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Custo de vida não coberto no período de {periodYears} anos.
                </p>
              )}
            </div>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-surface-hover text-muted-foreground shrink-0">
              <Calendar className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-foreground">Regra dos 72</h4>
              <p className="text-muted-foreground">
                Com rentabilidade de {annualRatePercent}% ao ano, seu capital dobra aproximadamente a cada{" "}
                <strong className="text-foreground">{result.doublingTimeYears ?? "--"} anos</strong> apenas com os juros.
              </p>
            </div>
          </Card>
        </section>

        {/* Tabela de Evolução Anual */}
        <section className="space-y-4">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="border-b border-border/80 pb-3">
              <CardTitle className="text-base font-bold">Evolução Anual do Patrimônio</CardTitle>
              <p className="text-xs text-muted-foreground">
                Acompanhe o crescimento ano a ano do patrimônio, aportes acumulados e juros.
              </p>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto no-scrollbar scroll-smooth">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">Ano</th>
                    <th className="py-2.5 px-3 font-semibold">Total Aportado</th>
                    <th className="py-2.5 px-3 font-semibold">Juros no Ano</th>
                    <th className="py-2.5 px-3 font-semibold">Juros Acumulados</th>
                    <th className="py-2.5 px-3 font-semibold">Patrimônio Total</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Renda Passiva Mensal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {result.yearsTimeline.map((item) => (
                    <tr key={item.year} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="py-2 px-3 font-bold text-foreground">
                        {item.year === 0 ? "Inicial" : `Ano ${item.year}`}
                      </td>
                      <td className="py-2 px-3">
                        <MoneyText cents={item.contributedCents} className="tabular-nums" />
                      </td>
                      <td className="py-2 px-3 text-positive-strong">
                        <MoneyText cents={item.interestEarnedThisYearCents} tone="positive" className="tabular-nums" />
                      </td>
                      <td className="py-2 px-3 text-positive-strong font-medium">
                        <MoneyText cents={item.totalInterestCents} tone="positive" className="tabular-nums" />
                      </td>
                      <td className="py-2 px-3 font-bold text-foreground">
                        <MoneyText cents={item.balanceCents} className="tabular-nums font-bold" />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-positive-strong">
                        <MoneyText cents={item.monthlyPassiveIncomeCents} tone="positive" className="tabular-nums font-bold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>

      <ToolsFooterCta
        title="Deseja monitorar suas finanças e metas com automação diária?"
        description="Acompanhe sua carteira de investimentos dia a dia, receba notificações de proventos recebidos e trace metas financeiras guiadas no Axir."
        simulationPayload={simulationPayload}
      />
    </div>
  );
}
