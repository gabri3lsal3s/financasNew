import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Flame,
  Snowflake,
  Plus,
  Trash2,
  Info,
  Link2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  MoneyInput,
  PercentInput,
  MoneyText,
} from "@/components/ui";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import {
  compareDebtStrategies,
  type SimulatorDebtInput,
  type DebtPayoffStrategy,
} from "@/domain/debts";
import {
  buildStatefulUrl,
  decodeDebtSimulatorState,
  type DebtSimulatorShareState,
  type PendingDebtSimulation,
} from "@/domain/share";
import { getPublicAppUrl } from "@/services/app-url";

const INITIAL_SAMPLE_DEBTS: SimulatorDebtInput[] = [
  {
    id: "debt-1",
    name: "Cartão de Crédito",
    balanceCents: 450000, // R$ 4.500,00
    monthlyRatePercent: 12.0, // 12% a.m.
    minPaymentCents: 45000, // R$ 450,00
  },
  {
    id: "debt-2",
    name: "Cheque Especial",
    balanceCents: 120000, // R$ 1.200,00
    monthlyRatePercent: 8.0, // 8% a.m.
    minPaymentCents: 15000, // R$ 150,00
  },
  {
    id: "debt-3",
    name: "Empréstimo Pessoal",
    balanceCents: 800000, // R$ 8.000,00
    monthlyRatePercent: 3.5, // 3,5% a.m.
    minPaymentCents: 35000, // R$ 350,00
  },
];

export function DebtSimulatorPage() {
  const [searchParams] = useSearchParams();

  // Carrega parâmetros a partir de stateful URL se presente
  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeDebtSimulatorState(param) : null;
  }, [searchParams]);

  const [debts, setDebts] = useState<SimulatorDebtInput[]>(
    () => sharedState?.debts ?? INITIAL_SAMPLE_DEBTS,
  );
  const [extraBudgetCents, setExtraBudgetCents] = useState<number>(
    () => sharedState?.extraBudgetCents ?? 50000, // R$ 500,00
  );
  const [activeTab, setActiveTab] = useState<DebtPayoffStrategy>(
    () => sharedState?.strategy ?? "avalanche",
  );

  useEffect(() => {
    document.title =
      "Simulador de Quitação de Dívidas: Avalanche vs Bola de Neve — Axir";
  }, []);

  const comparison = useMemo(() => {
    return compareDebtStrategies(debts, extraBudgetCents);
  }, [debts, extraBudgetCents]);

  const totalBalanceCents = useMemo(
    () => debts.reduce((acc, d) => acc + d.balanceCents, 0),
    [debts],
  );

  const totalMinPaymentCents = useMemo(
    () => debts.reduce((acc, d) => acc + d.minPaymentCents, 0),
    [debts],
  );

  const handleAddDebt = () => {
    const newDebt: SimulatorDebtInput = {
      id: `debt-${Date.now()}`,
      name: `Nova Dívida ${debts.length + 1}`,
      balanceCents: 200000,
      monthlyRatePercent: 4.0,
      minPaymentCents: 20000,
    };
    setDebts((prev) => [...prev, newDebt]);
  };

  const handleRemoveDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdateDebt = (id: string, updates: Partial<SimulatorDebtInput>) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  const activeResult = activeTab === "avalanche" ? comparison.avalanche : comparison.snowball;

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

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Cabeçalho Editorial */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" size="sm">
                Ferramenta Gratuita
              </Badge>
              <Badge variant="positive" size="sm">
                Processamento 100% no Navegador
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
              simulationTitle="Quitação de Dívidas"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Quitação: Avalanche vs Bola de Neve
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Compare matematicamente as duas principais estratégias de eliminação de dívidas. O{" "}
            <strong className="text-foreground">Método Avalanche</strong> prioriza as maiores taxas de juros economizando dinheiro,
            enquanto o <strong className="text-foreground">Método Bola de Neve</strong> foca nos menores saldos para vitórias psicológicas rápidas.
          </p>
        </section>

        {/* KPIs Comparativos de Topo */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Saldo Devedor Total
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                <MoneyText cents={totalBalanceCents} className="tabular-nums font-bold" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {debts.length} dívida(s) no plano
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Tempo de Quitação (Avalanche)
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
                {comparison.avalanche.totalMonths} meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                vs {comparison.snowball.totalMonths} meses na Bola de Neve
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Juros Pagos (Avalanche)
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                <MoneyText
                  cents={comparison.avalanche.totalInterestCents}
                  tone="negative"
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Bola de Neve: <MoneyText cents={comparison.snowball.totalInterestCents} className="inline font-medium" />
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs bg-primary/5">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-primary">
                Economia com Avalanche
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong">
                <MoneyText
                  cents={comparison.interestSavedWithAvalancheCents}
                  tone="positive"
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Economia direta em juros bancários
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Seção Principal: Lista de Dívidas & Orçamento Extra */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna Esquerda: Configuração e Tabela de Dívidas (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between border-b border-border/80 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">Suas Dívidas Cadastradas</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Insira cada dívida com saldo devedor atual, taxa mensal e parcela mínima.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDebt}
                  className="gap-1.5 self-start sm:self-auto text-xs"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Adicionar Dívida</span>
                </Button>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {debts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Nenhuma dívida adicionada. Clique em Adicionar Dívida para começar.
                  </div>
                ) : (
                  debts.map((debt, index) => (
                    <div
                      key={debt.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 max-w-xs">
                          <Input
                            value={debt.name}
                            onChange={(e) => handleUpdateDebt(debt.id, { name: e.target.value })}
                            placeholder="Nome da Dívida"
                            className="h-8 text-xs font-semibold"
                            aria-label={`Nome da dívida ${index + 1}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDebt(debt.id)}
                          className="size-8 text-muted-foreground hover:text-critical-strong"
                          aria-label={`Remover dívida ${debt.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Saldo Devedor
                          </label>
                          <MoneyInput
                            cents={debt.balanceCents}
                            onCentsChange={(val) => handleUpdateDebt(debt.id, { balanceCents: val })}
                            size="sm"
                            aria-label={`Saldo da dívida ${debt.name}`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Taxa de Juros (a.m.)
                          </label>
                          <PercentInput
                            value={debt.monthlyRatePercent}
                            onValueChange={(val) => handleUpdateDebt(debt.id, { monthlyRatePercent: val })}
                            size="sm"
                            aria-label={`Taxa de juros da dívida ${debt.name}`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Parcela Mínima
                          </label>
                          <MoneyInput
                            cents={debt.minPaymentCents}
                            onCentsChange={(val) => handleUpdateDebt(debt.id, { minPaymentCents: val })}
                            size="sm"
                            aria-label={`Parcela mínima da dívida ${debt.name}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Bloco de Orçamento Extra */}
                <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">
                        Aporte Extra Mensal para Aceleração
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Valor mensal além da soma das parcelas mínimas (
                        <MoneyText cents={totalMinPaymentCents} className="inline font-medium" />
                        ) dedicado exclusivamente para quitar a dívida prioritária.
                      </p>
                    </div>
                    <div className="w-full sm:w-44">
                      <MoneyInput
                        cents={extraBudgetCents}
                        onCentsChange={setExtraBudgetCents}
                        size="sm"
                        aria-label="Aporte extra mensal para quitação"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Orçamento mensal total do plano:{" "}
                    <strong className="text-foreground">
                      <MoneyText cents={totalMinPaymentCents + extraBudgetCents} className="inline font-bold" />
                      /mês
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Comparativo e Ordem de Quitação (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-3 border-b border-border/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold">Estratégia Selecionada</CardTitle>
                  <div className="inline-flex rounded-lg border border-border/80 bg-background/50 p-0.5">
                    <Button
                      type="button"
                      variant={activeTab === "avalanche" ? "default" : "ghost"}
                      size="xs"
                      onClick={() => setActiveTab("avalanche")}
                      className="gap-1.5 font-semibold text-xs h-7 px-3"
                    >
                      <Flame className="size-3" aria-hidden="true" />
                      <span>Avalanche</span>
                    </Button>
                    <Button
                      type="button"
                      variant={activeTab === "snowball" ? "default" : "ghost"}
                      size="xs"
                      onClick={() => setActiveTab("snowball")}
                      className="gap-1.5 font-semibold text-xs h-7 px-3"
                    >
                      <Snowflake className="size-3" aria-hidden="true" />
                      <span>Bola de Neve</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {activeTab === "avalanche"
                    ? "Elimina primeiro as dívidas com maiores juros para minimizar o custo financeiro."
                    : "Elimina primeiro as menores dívidas para obter vitórias psicológicas consecutivas."}
                </p>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Destaque da Recomendação */}
                <div className="p-3 rounded-lg border border-border/70 bg-surface-hover/50 flex items-start gap-2.5">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-foreground">
                      {comparison.recommendedStrategy === "avalanche"
                        ? "Recomendação Técnica: Método Avalanche"
                        : "Recomendação Prática: Método Bola de Neve"}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {comparison.interestSavedWithAvalancheCents > 0
                        ? `Adotar o método Avalanche economizará `
                        : `Ambos os métodos apresentam custos similares.`}
                      {comparison.interestSavedWithAvalancheCents > 0 && (
                        <strong className="text-positive-strong">
                          <MoneyText cents={comparison.interestSavedWithAvalancheCents} className="inline font-bold" />
                        </strong>
                      )}
                      {comparison.interestSavedWithAvalancheCents > 0 &&
                        ` em juros ao longo de todo o plano.`}
                    </p>
                  </div>
                </div>

                {/* Ordem de Quitação / Marcos */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Cronograma de Eliminação de Dívidas
                  </h4>
                  {activeResult.milestones.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Ajuste o orçamento mensal para viabilizar a quitação.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeResult.milestones.map((m, idx) => (
                        <div
                          key={m.debtId}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-background/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground">{m.debtName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Total pago: <MoneyText cents={m.totalPaidCents} className="inline font-medium" />
                              </p>
                            </div>
                          </div>
                          <Badge variant="muted" size="xs" className="shrink-0">
                            Quitada no Mês {m.paidOffMonth}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumo Consolidado */}
                <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Prazo total de quitação:</span>
                    <strong className="text-foreground">{activeResult.totalMonths} meses</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total de juros desembolsados:</span>
                    <MoneyText cents={activeResult.totalInterestCents} tone="negative" className="font-semibold" />
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo total desembolsado:</span>
                    <MoneyText cents={activeResult.totalPaidCents} className="font-bold text-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
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
