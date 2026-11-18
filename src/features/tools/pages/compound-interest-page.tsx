import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { calculateCompoundInterest, calculateCriticalCapital } from "@/domain/portfolio";
import {
  buildStatefulUrl,
  decodeCompoundInterestState,
  type CompoundInterestShareState,
  type PendingCompoundInterestSimulation,
} from "@/domain/share";
import { getPublicAppUrl } from "@/services/app-url";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import { CompoundParametersGrid } from "../components/compound/compound-parameters-grid";
import { CompoundKpiAndMilestones } from "../components/compound/compound-kpi-and-milestones";
import { CompoundTimelineTable } from "../components/compound/compound-timeline-table";

export function CompoundInterestPage() {
  const [searchParams] = useSearchParams();

  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeCompoundInterestState(param) : null;
  }, [searchParams]);

  const [initialAmountCents, setInitialAmountCents] = useState<number>(
    () => sharedState?.initialAmountCents ?? 1000000,
  );
  const [monthlyContributionCents, setMonthlyContributionCents] = useState<number>(
    () => sharedState?.monthlyContributionCents ?? 150000,
  );
  const [annualRatePercent, setAnnualRatePercent] = useState<number>(
    () => sharedState?.annualRatePercent ?? 10.0,
  );
  const [periodYears, setPeriodYears] = useState<number>(() => sharedState?.periodYears ?? 20);
  const [monthlyLivingCostCents, setMonthlyLivingCostCents] = useState<number>(
    () => sharedState?.monthlyLivingCostCents ?? 500000,
  );

  useDocumentMeta({
    title: "Simulador de Juros Compostos e Independência Financeira — Axir",
    description:
      "Projete seu patrimônio com juros compostos, aportes mensais e inflação, e descubra o ano em que a renda passiva cobre seu custo de vida.",
    canonicalPath: "/ferramentas/juros-compostos",
  });

  const result = useMemo(
    () =>
      calculateCompoundInterest({
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
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" size="sm">
                Ferramenta Gratuita
              </Badge>
              <Badge variant="positive" size="sm">
                Planejamento FIRE & Independência Financeira
              </Badge>
              {sharedState ? (
                <Badge variant="warning" size="sm" className="gap-1">
                  <Link2 className="size-3 shrink-0" aria-hidden="true" />
                  <span>Simulação Compartilhada</span>
                </Badge>
              ) : null}
            </div>
            <ShareSimulationButton
              getShareUrl={getShareUrl}
              simulationTitle="Juros Compostos & FIRE"
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Juros Compostos & Independência Financeira
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Projete o efeito exponencial do tempo e dos aportes sobre seu patrimônio. Descubra
            quando o retorno dos seus investimentos ultrapassará o esforço do seu próprio trabalho.
          </p>
        </section>

        <CompoundParametersGrid
          initialAmountCents={initialAmountCents}
          onInitialAmountChange={setInitialAmountCents}
          monthlyContributionCents={monthlyContributionCents}
          onMonthlyContributionChange={setMonthlyContributionCents}
          annualRatePercent={annualRatePercent}
          onAnnualRateChange={setAnnualRatePercent}
          periodYears={periodYears}
          onPeriodYearsChange={setPeriodYears}
          monthlyLivingCostCents={monthlyLivingCostCents}
          onMonthlyLivingCostChange={setMonthlyLivingCostCents}
        />

        <CompoundKpiAndMilestones
          result={result}
          periodYears={periodYears}
          annualRatePercent={annualRatePercent}
          monthlyLivingCostCents={monthlyLivingCostCents}
          criticalCapitalCents={criticalCapitalCents}
          interestPercentage={interestPercentage}
        />

        <CompoundTimelineTable timeline={result.yearsTimeline} />
      </main>

      <ToolsFooterCta
        title="Deseja monitorar suas finanças e metas com automação diária?"
        description="Acompanhe sua carteira de investimentos dia a dia, receba notificações de proventos recebidos e trace metas financeiras guiadas no Axir."
        simulationPayload={simulationPayload}
      />
    </div>
  );
}
