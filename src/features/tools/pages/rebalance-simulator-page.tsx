import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  Plus,
  Trash2,
  AlertCircle,
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
import { AllocationDonut, type AllocationSlice } from "@/components/modules/allocation-donut";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import {
  simulateStrategyAporte,
  type StrategyClassItem,
} from "@/domain/portfolio";
import {
  buildStatefulUrl,
  decodeRebalanceSimulatorState,
  type RebalanceSimulatorShareState,
  type PendingRebalanceSimulation,
} from "@/domain/share";

interface PresetConfig {
  id: string;
  name: string;
  description: string;
  classes: StrategyClassItem[];
}

const PRESETS: PresetConfig[] = [
  {
    id: "dividendos",
    name: "Foco em Proventos & Dividendos",
    description: "Carteira voltada para fluxo de renda mensal com FIIs e ações pagadoras.",
    classes: [
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 40, currentProportion: 0.30, yieldRate: 0.10 },
      { key: "acoes_div", name: "Ações de Dividendos", targetPercent: 30, currentProportion: 0.25, yieldRate: 0.085 },
      { key: "rf_cdi", name: "Renda Fixa CDI", targetPercent: 20, currentProportion: 0.35, yieldRate: 0.06 },
      { key: "global", name: "REITs / Ativos Globais", targetPercent: 10, currentProportion: 0.10, yieldRate: 0.05 },
    ],
  },
  {
    id: "multimercado",
    name: "Global Multi-Mercado",
    description: "Equilíbrio entre Bolsa Brasil, Renda Fixa IPCA+ e Exposição Global em Dólar.",
    classes: [
      { key: "global", name: "Ativos Globais / Dólar", targetPercent: 30, currentProportion: 0.20, yieldRate: 0.035 },
      { key: "rf_ipca", name: "Renda Fixa IPCA+", targetPercent: 30, currentProportion: 0.40, yieldRate: 0.065 },
      { key: "acoes_br", name: "Ações Brasil", targetPercent: 25, currentProportion: 0.25, yieldRate: 0.07 },
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 15, currentProportion: 0.15, yieldRate: 0.095 },
    ],
  },
  {
    id: "crescimento",
    name: "Crescimento & Longo Prazo",
    description: "Foco em valorização exponencial de empresas e tecnologia global.",
    classes: [
      { key: "acoes_growth", name: "Ações Brasil Growth", targetPercent: 40, currentProportion: 0.25, yieldRate: 0.04 },
      { key: "tech_global", name: "Tech Global / Nasdaq", targetPercent: 35, currentProportion: 0.25, yieldRate: 0.02 },
      { key: "fiis_tijolo", name: "FIIs de Tijolo", targetPercent: 15, currentProportion: 0.20, yieldRate: 0.085 },
      { key: "rf_caixa", name: "Reserva de Oportunidade", targetPercent: 10, currentProportion: 0.30, yieldRate: 0.06 },
    ],
  },
];

export function RebalanceSimulatorPage() {
  const [searchParams] = useSearchParams();

  // Carrega parâmetros a partir de stateful URL se presente
  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeRebalanceSimulatorState(param) : null;
  }, [searchParams]);

  const [patrimonyBaseCents, setPatrimonyBaseCents] = useState<number>(
    () => sharedState?.patrimonyBaseCents ?? 5000000, // R$ 50.000,00
  );
  const [aporteAmountCents, setAporteAmountCents] = useState<number>(
    () => sharedState?.aporteAmountCents ?? 300000, // R$ 3.000,00
  );
  const [classes, setClasses] = useState<StrategyClassItem[]>(
    () =>
      sharedState?.classes.map((c) => ({
        key: c.key,
        name: c.name,
        targetPercent: c.targetPercent,
        currentProportion: c.currentProportion,
        yieldRate: c.yieldRate ?? 0.06,
      })) ?? PRESETS[0]!.classes,
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(
    () => sharedState?.selectedPreset ?? (sharedState ? "custom" : "dividendos"),
  );

  const handleApplyPreset = (presetId: string) => {
    const found = PRESETS.find((p) => p.id === presetId);
    if (found) {
      setSelectedPreset(found.id);
      setClasses(found.classes);
    }
  };

  const handleAddClass = () => {
    setSelectedPreset("custom");
    const newClass: StrategyClassItem = {
      key: `cls_${Date.now()}`,
      name: `Classe ${classes.length + 1}`,
      targetPercent: 10,
      currentProportion: 0,
      yieldRate: 0.06,
    };
    setClasses((prev) => [...prev, newClass]);
  };

  const handleRemoveClass = (key: string) => {
    setSelectedPreset("custom");
    setClasses((prev) => prev.filter((c) => c.key !== key));
  };

  const handleUpdateClass = (key: string, updates: Partial<StrategyClassItem>) => {
    setSelectedPreset("custom");
    setClasses((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...updates } : c)),
    );
  };

  const totalTargetPercent = useMemo(
    () => classes.reduce((sum, c) => sum + c.targetPercent, 0),
    [classes],
  );

  // Execução do cálculo de rebalanceamento puro em centavos
  const simulation = useMemo(() => {
    const patrimonyReais = patrimonyBaseCents / 100;
    const aporteReais = aporteAmountCents / 100;

    return simulateStrategyAporte({
      patrimonyBase: patrimonyReais,
      aporteAmount: aporteReais,
      classes,
    });
  }, [patrimonyBaseCents, aporteAmountCents, classes]);

  const donutSlices: AllocationSlice[] = useMemo(() => {
    return simulation.allocations.map((cls) => ({
      key: cls.key,
      label: cls.name,
      valueCents: Math.round(cls.finalValue * 100),
      subtitle: `Meta: ${cls.targetPercent}% · Pós-Aporte: ${cls.finalPct}%`,
    }));
  }, [simulation.allocations]);

  const isTarget100 = Math.abs(totalTargetPercent - 100) < 0.1;

  const getShareUrl = () => {
    const state: RebalanceSimulatorShareState = {
      patrimonyBaseCents,
      aporteAmountCents,
      classes,
      selectedPreset,
    };
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return buildStatefulUrl(`${origin}/ferramentas/rebalanceamento`, state);
  };

  const simulationPayload: PendingRebalanceSimulation = useMemo(
    () => ({
      type: "rebalance_simulator",
      classes: classes.map((c) => ({
        name: c.name,
        targetPercent: c.targetPercent,
      })),
      patrimonyBaseCents,
      aporteAmountCents,
      selectedPreset,
    }),
    [classes, patrimonyBaseCents, aporteAmountCents, selectedPreset],
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
                Rebalanceamento sem Venda de Ativos
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
              simulationTitle="Rebalanceamento de Carteira"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Rebalanceamento Inteligente de Carteira
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Descubra a distribuição ideal do seu próximo aporte para aproximar seus investimentos
            da sua estratégia-alvo sem vender ativos e sem gerar DARF desnecessário.
          </p>
        </section>

        {/* Seleção Rápida de Estratégias Modelo */}
        <section className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">
            Modelos de Estratégia:
          </span>
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant={selectedPreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleApplyPreset(preset.id)}
              className="text-xs"
            >
              {preset.name}
            </Button>
          ))}
          {selectedPreset === "custom" && (
            <Badge variant="muted" size="sm" className="text-xs">
              Personalizada
            </Badge>
          )}
        </section>

        {/* Configuração de Patrimônio e Aporte */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Patrimônio Atual
              </span>
              <div className="pt-1">
                <MoneyInput
                  cents={patrimonyBaseCents}
                  onCentsChange={setPatrimonyBaseCents}
                  size="md"
                  aria-label="Patrimônio atual investido"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Valor do Próximo Aporte
              </span>
              <div className="pt-1">
                <MoneyInput
                  cents={aporteAmountCents}
                  onCentsChange={setAporteAmountCents}
                  size="md"
                  aria-label="Valor do próximo aporte"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Novo Patrimônio Projetado
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold pt-2">
                <MoneyText
                  cents={Math.round(simulation.newTotalPatrimony * 100)}
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Base + Novo Aporte</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs bg-positive/5">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-positive-strong">
                Renda Passiva Mensal Estimada
              </span>
              <CardTitle className="text-xl sm:text-2xl font-bold text-positive-strong pt-2">
                <MoneyText
                  cents={Math.round(simulation.monthlyPassive * 100)}
                  tone="positive"
                  className="tabular-nums font-bold"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                ~<MoneyText cents={Math.round(simulation.annualDividends * 100)} className="inline font-medium" /> ao ano
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Seção Central: Configuração das Classes & Resultado Donut */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Tabela de Classes (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between border-b border-border/80 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">Distribuição por Classes de Ativos</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Defina a alocação atual e a porcentagem alvo que você deseja atingir.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddClass}
                  className="gap-1.5 self-start sm:self-auto text-xs"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Adicionar Classe</span>
                </Button>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {!isTarget100 && (
                  <div className="p-3 rounded-lg border border-warning/40 bg-warning/10 text-xs text-warning-strong flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      A soma das metas percentuais é de <strong>{totalTargetPercent}%</strong>. O ideal é que perfaça exatamente 100%.
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  {classes.map((cls, idx) => (
                    <div
                      key={cls.key}
                      className="p-3 rounded-xl border border-border/70 bg-background/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={cls.name}
                          onChange={(e) => handleUpdateClass(cls.key, { name: e.target.value })}
                          className="h-8 text-xs font-semibold max-w-xs"
                          aria-label={`Nome da classe ${idx + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveClass(cls.key)}
                          className="size-8 text-muted-foreground hover:text-critical-strong"
                          aria-label={`Remover classe ${cls.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Proporção Atual ({Math.round(cls.currentProportion * 100)}%)
                          </label>
                          <PercentInput
                            value={Math.round(cls.currentProportion * 10000) / 100}
                            onValueChange={(val) => handleUpdateClass(cls.key, { currentProportion: val / 100 })}
                            size="sm"
                            aria-label={`Proporção atual de ${cls.name}`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Meta Desejada (%)
                          </label>
                          <PercentInput
                            value={cls.targetPercent}
                            onValueChange={(val) => handleUpdateClass(cls.key, { targetPercent: val })}
                            size="sm"
                            aria-label={`Meta percentual de ${cls.name}`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Dividend Yield Est. (% a.a.)
                          </label>
                          <PercentInput
                            value={Math.round(cls.yieldRate * 10000) / 100}
                            onValueChange={(val) => handleUpdateClass(cls.key, { yieldRate: val / 100 })}
                            size="sm"
                            aria-label={`Yield anual de ${cls.name}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Donut e Tabela de Aporte Recomendado (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="border-b border-border/80 pb-3">
                <CardTitle className="text-base font-bold">Alocação Pós-Aporte</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Projeção da carteira após a injeção do novo aporte.
                </p>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex justify-center py-2">
                  <AllocationDonut
                    slices={donutSlices}
                    donutSize="md"
                    centerValue={`R$ ${(simulation.newTotalPatrimony).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  />
                </div>

                {/* Tabela de Aporte Recomendado */}
                <div className="space-y-2 pt-2 border-t border-border/70">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Recomendação de Compra do Próximo Aporte
                  </h4>
                  <div className="space-y-2">
                    {simulation.allocations.map((alloc) => (
                      <div
                        key={alloc.key}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-background/60 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{alloc.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Atual: {alloc.currentPct}% → Alvo: {alloc.targetPercent}%
                          </p>
                        </div>
                        <div className="text-right">
                          {alloc.allocatedAmount > 0 ? (
                            <>
                              <MoneyText
                                cents={Math.round(alloc.allocatedAmount * 100)}
                                tone="positive"
                                className="font-bold tabular-nums"
                              />
                              <p className="text-[10px] text-positive-strong font-medium">Aportar aqui</p>
                            </>
                          ) : (
                            <Badge variant="muted" size="xs">
                              Sem aporte
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <ToolsFooterCta
        title="Deseja monitorar suas finanças e metas com automação diária?"
        description="O motor de investimentos do Áxis Finance integra suas notas de corretagem, calcula o preço médio automaticamente e aponta os ativos mais descontados da sua carteira."
        simulationPayload={simulationPayload}
      />
    </div>
  );
}
