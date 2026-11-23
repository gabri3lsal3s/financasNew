import { AlertCircle, Link2, Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { STRATEGY_PRESETS_LIST } from "@/domain/portfolio";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { ToolsHeader } from "../components/tools-header";
import { ToolsFooterCta } from "../components/tools-footer-cta";
import { ShareSimulationButton } from "../components/share-simulation-button";
import { RebalanceKpiGrid } from "../components/rebalance/rebalance-kpi-grid";
import { RebalanceClassCard } from "../components/rebalance/rebalance-class-card";
import { RebalanceTradePlanCard } from "../components/rebalance/rebalance-trade-plan-card";
import { useRebalanceSimulator } from "../hooks/use-rebalance-simulator";

export function RebalanceSimulatorPage() {
  const sim = useRebalanceSimulator();

  useDocumentMeta({
    title: "Simulador de Rebalanceamento Inteligente de Carteira — Axir",
    description:
      "Calcule a distribuição exata do próximo aporte usando Classes (%) e Notas (0 a 10) para reequilibrar sua carteira sem vender ativos.",
    canonicalPath: "/ferramentas/rebalanceamento",
  });

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
                Rebalanceamento sem Venda de Ativos
              </Badge>
              {sim.sharedState ? (
                <Badge variant="warning" size="sm" className="gap-1">
                  <Link2 className="size-3 shrink-0" aria-hidden="true" />
                  <span>Simulação Compartilhada</span>
                </Badge>
              ) : null}
            </div>
            <ShareSimulationButton
              getShareUrl={sim.getShareUrl}
              simulationTitle="Rebalanceamento de Carteira"
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Simulador de Rebalanceamento Inteligente de Carteira
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Descubra a distribuição ideal do seu próximo aporte para aproximar seus investimentos
            da sua estratégia-alvo sem vender ativos e sem gerar DARF desnecessário.
          </p>
        </section>

        <section className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">
            Modelos de Estratégia:
          </span>
          {STRATEGY_PRESETS_LIST.map((preset) => (
            <Button
              key={preset.id}
              variant={sim.selectedPreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => sim.handleApplyPreset(preset.id)}
              className="text-xs"
            >
              {preset.name}
            </Button>
          ))}
          {sim.selectedPreset === "custom" ? (
            <Badge variant="muted" size="sm">
              Personalizada
            </Badge>
          ) : null}
        </section>

        <RebalanceKpiGrid
          patrimonyBaseCents={sim.patrimonyBaseCents}
          onPatrimonyBaseChange={sim.setPatrimonyBaseCents}
          aporteAmountCents={sim.aporteAmountCents}
          onAporteAmountChange={sim.setAporteAmountCents}
          newTotalPatrimonyBRL={sim.simulation.newTotalPatrimony}
          monthlyPassiveBRL={sim.simulation.monthlyPassive}
          annualDividendsBRL={sim.simulation.annualDividends}
        />

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between border-b border-border/80 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">
                    Distribuição por Classes de Ativos
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Defina a alocação atual e a porcentagem alvo que você deseja atingir.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sim.handleAddClass}
                  className="gap-1.5 self-start sm:self-auto text-xs"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Adicionar Classe</span>
                </Button>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {!sim.isTarget100 ? (
                  <div className="p-3 rounded-lg border border-warning/40 bg-warning/10 text-xs text-warning-strong flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      A soma das metas percentuais é de <strong>{sim.totalTargetPercent}%</strong>.
                      O ideal é que perfaça exatamente 100%.
                    </span>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {sim.classes.map((cls, idx) => (
                    <RebalanceClassCard
                      key={cls.key}
                      cls={cls}
                      index={idx}
                      onUpdateClass={sim.handleUpdateClass}
                      onRemoveClass={sim.handleRemoveClass}
                      onAddAsset={sim.handleAddClassAsset}
                      onUpdateAsset={sim.handleUpdateClassAsset}
                      onRemoveAsset={sim.handleRemoveClassAsset}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <RebalanceTradePlanCard
              donutSlices={sim.donutSlices}
              newTotalPatrimonyBRL={sim.simulation.newTotalPatrimony}
              allocations={sim.simulation.allocations}
              classes={sim.classes}
            />
          </div>
        </section>
      </main>

      <ToolsFooterCta
        title="Deseja monitorar suas finanças e metas com automação diária?"
        description="O motor de investimentos do Axir integra suas notas de corretagem, calcula o preço médio automaticamente e aponta os ativos mais descontados da sua carteira."
        simulationPayload={sim.simulationPayload}
      />
    </div>
  );
}
