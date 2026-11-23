import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui";
import {
  compareDebtStrategies,
  type DebtPayoffStrategy,
  type SimulatorDebtInput,
} from "@/domain/debts";
import {
  buildStatefulUrl,
  decodeDebtSimulatorState,
  type DebtSimulatorShareState,
  type PendingDebtSimulation,
} from "@/domain/share";
import { getPublicAppUrl } from "@/services/app-url";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import { DebtKpiGrid } from "../components/debt/debt-kpi-grid";
import { DebtItemEditorList } from "../components/debt/debt-item-editor-list";
import { DebtStrategyComparisonCard } from "../components/debt/debt-strategy-comparison-card";

const INITIAL_SAMPLE_DEBTS: SimulatorDebtInput[] = [
  {
    id: "debt-1",
    name: "Cartão de Crédito",
    balanceCents: 450000,
    monthlyRatePercent: 12.0,
    minPaymentCents: 45000,
  },
  {
    id: "debt-2",
    name: "Cheque Especial",
    balanceCents: 120000,
    monthlyRatePercent: 8.0,
    minPaymentCents: 15000,
  },
  {
    id: "debt-3",
    name: "Empréstimo Pessoal",
    balanceCents: 800000,
    monthlyRatePercent: 3.5,
    minPaymentCents: 35000,
  },
];

export function DebtSimulatorPage() {
  const [searchParams] = useSearchParams();

  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeDebtSimulatorState(param) : null;
  }, [searchParams]);

  const [debts, setDebts] = useState<SimulatorDebtInput[]>(
    () => sharedState?.debts ?? INITIAL_SAMPLE_DEBTS,
  );
  const [extraBudgetCents, setExtraBudgetCents] = useState<number>(
    () => sharedState?.extraBudgetCents ?? 50000,
  );
  const [activeTab, setActiveTab] = useState<DebtPayoffStrategy>(
    () => sharedState?.strategy ?? "avalanche",
  );

  useDocumentMeta({
    title: "Simulador de Quitação de Dívidas: Avalanche vs Bola de Neve — Axir",
    description:
      "Compare Avalanche e Bola de Neve e veja quantos meses e quanto de juros você economiza para quitar dívidas. Simulador gratuito, sem cadastro.",
    canonicalPath: "/ferramentas/simulador-dividas",
  });

  const comparison = useMemo(
    () => compareDebtStrategies(debts, extraBudgetCents),
    [debts, extraBudgetCents],
  );

  const totalBalanceCents = useMemo(
    () => debts.reduce((acc, d) => acc + d.balanceCents, 0),
    [debts],
  );

  const totalMinPaymentCents = useMemo(
    () => debts.reduce((acc, d) => acc + d.minPaymentCents, 0),
    [debts],
  );

  const handleAddDebt = () => {
    setDebts((prev) => [
      ...prev,
      {
        id: `debt-${Date.now()}`,
        name: `Nova Dívida ${prev.length + 1}`,
        balanceCents: 200000,
        monthlyRatePercent: 4.0,
        minPaymentCents: 20000,
      },
    ]);
  };

  const handleRemoveDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdateDebt = (id: string, updates: Partial<SimulatorDebtInput>) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const getShareUrl = () => {
    const state: DebtSimulatorShareState = {
      debts,
      extraBudgetCents,
      strategy: activeTab,
    };
    return buildStatefulUrl(getPublicAppUrl("ferramentas/simulador-dividas"), state);
  };

  const simulationPayload: PendingDebtSimulation = useMemo(
    () => ({
      type: "debt_simulator",
      debts: debts.map((d) => ({
        name: d.name,
        balanceCents: d.balanceCents,
        interestRateAnnual: d.monthlyRatePercent * 12,
        minimumPaymentCents: d.minPaymentCents,
      })),
      extraMonthlyCents: extraBudgetCents,
      strategy: activeTab,
    }),
    [debts, extraBudgetCents, activeTab],
  );

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between">
      <ToolsHeader />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1 animate-route-in">
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" size="sm">
                Ferramenta Gratuita
              </Badge>
              <Badge variant="positive" size="sm">
                Processamento 100% no Navegador
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
              simulationTitle="Quitação de Dívidas"
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Quitação: Avalanche vs Bola de Neve
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Compare matematicamente as duas principais estratégias de eliminação de dívidas. O{" "}
            <strong className="text-foreground">Método Avalanche</strong> prioriza as maiores taxas
            de juros economizando dinheiro, enquanto o{" "}
            <strong className="text-foreground">Método Bola de Neve</strong> foca nos menores saldos
            para vitórias psicológicas rápidas.
          </p>
        </section>

        <DebtKpiGrid
          totalBalanceCents={totalBalanceCents}
          debtsCount={debts.length}
          comparison={comparison}
        />

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <DebtItemEditorList
              debts={debts}
              extraBudgetCents={extraBudgetCents}
              totalMinPaymentCents={totalMinPaymentCents}
              onAddDebt={handleAddDebt}
              onUpdateDebt={handleUpdateDebt}
              onRemoveDebt={handleRemoveDebt}
              onExtraBudgetChange={setExtraBudgetCents}
            />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <DebtStrategyComparisonCard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              comparison={comparison}
            />
          </div>
        </section>
      </main>

      <ToolsFooterCta
        title="Deseja monitorar suas finanças e metas com automação diária?"
        description="O Axir automatiza o controle de dívidas, faturas de cartão de crédito e amortizações com avisos inteligentes antes do vencimento."
        simulationPayload={simulationPayload}
      />
    </div>
  );
}
