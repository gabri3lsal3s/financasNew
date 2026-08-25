import {
  PanelTop,
  Image as ImageIcon,
  Calculator,
  Monitor,
  Eye,
  LayoutGrid,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
} from "@/components/ui";
import {
  useVisualCustomization,
  type HeaderButtonsConfig,
  type DashboardWidgetsConfig,
} from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { useUpdateCustomSettings, useUserAccess } from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

export function WidgetsTab() {
  const visual = useVisualCustomization();
  const { hasFeature } = useUserAccess();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const handleToggleHeaderButton = (key: keyof HeaderButtonsConfig, label: string, nextChecked: boolean) => {
    triggerSensory("toggle");
    visual.setHeaderButton(key, nextChecked);
    updateCustomSettingsMutation.mutate({
      headerButtons: { [key]: nextChecked },
    });
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? `Atalho "${label}" adicionado ao cabeçalho.`
        : `Atalho "${label}" removido do cabeçalho.`,
      duration: 2200,
    });
  };

  const handleToggleDashboardWidget = (key: keyof DashboardWidgetsConfig, label: string, nextChecked: boolean) => {
    const activeWidgetsCount = Object.values(visual.dashboardWidgets).filter(Boolean).length;
    if (!nextChecked && activeWidgetsCount <= 3) {
      triggerSensory("warning");
      pushToast({
        title: "Limite mínimo atingido",
        description: "Mantenha ao menos 3 widgets ativos para que a Visão Geral exiba uma composição equilibrada.",
        duration: 3000,
      });
      return;
    }

    triggerSensory("action");
    visual.setDashboardWidget(key, nextChecked);
    updateCustomSettingsMutation.mutate({
      dashboardWidgets: { [key]: nextChecked },
    });
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? `Widget "${label}" exibido no início.`
        : `Widget "${label}" ocultado do início.`,
      duration: 2200,
    });
  };

  return (
    <div className="space-y-6">
      {/* Atalhos do Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PanelTop className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Atalhos do Header</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* --- Logo (sem limite de slot) --- */}
          {(() => {
            const isChecked = visual.headerButtons.logo;
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleHeaderButton("logo", "Logo no Header", !isChecked)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleHeaderButton("logo", "Logo no Header", !isChecked);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                  isChecked
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-3 pr-4 min-w-0">
                  <ImageIcon
                    className={cn(
                      "size-4 shrink-0",
                      isChecked ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground">Logotipo Oficial</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Exibe o logotipo Guia Financeiro à esquerda do cabeçalho.
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleToggleHeaderButton("logo", "Logo no Header", Boolean(checked))}
                  aria-label="Logotipo Oficial"
                />
              </div>
            );
          })()}

          {/* --- Demais botões (limite de 2 ativos simultâneos) --- */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Atalhos de Ação Rápida (Máximo 2 simultâneos)
            </div>

            {(
              [
                {
                  key: "calculatorButton" as const,
                  label: "Calculadora",
                  desc: "Exibe o botão de calculadora flutuante no cabeçalho.",
                  icon: Calculator,
                },
                {
                  key: "themeToggle" as const,
                  label: "Alternar Tema Rápido",
                  desc: "Adiciona o botão de troca de tema (Claro / Escuro / OLED / Sistema) direto no cabeçalho.",
                  icon: Monitor,
                },
                {
                  key: "privacyToggle" as const,
                  label: "Ocultar Valores (Privacidade)",
                  desc: "Adiciona o botão de ofuscamento de saldos e lançamentos ao cabeçalho. Atalho: tecla P.",
                  icon: Eye,
                },
              ] satisfies {
                key: keyof HeaderButtonsConfig;
                label: string;
                desc: string;
                icon: typeof Monitor;
              }[]
            ).map((item) => {
              const isChecked = visual.headerButtons[item.key];
              const activeSlots = [
                visual.headerButtons.calculatorButton,
                visual.headerButtons.themeToggle,
                visual.headerButtons.privacyToggle,
              ].filter(Boolean).length;
              const isDisabled = !isChecked && activeSlots >= 2;
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  aria-disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    handleToggleHeaderButton(item.key, item.label, !isChecked);
                  }}
                  onKeyDown={(e) => {
                    if (isDisabled) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleHeaderButton(item.key, item.label, !isChecked);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-colors select-none",
                    isDisabled
                      ? "border-border bg-surface opacity-50 cursor-not-allowed"
                      : isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                        : "border-border bg-surface hover:bg-surface-hover cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-3 pr-4 min-w-0">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        isChecked ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isDisabled ? "Limite de 2 atalhos de ação atingido." : item.desc}
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      if (!isDisabled) handleToggleHeaderButton(item.key, item.label, Boolean(checked));
                    }}
                    aria-label={item.label}
                  />
                </div>
              );
            })}
          </div>

          {/* Nota sobre o comportamento das notificações */}
          <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
            O sino de notificações aparece automaticamente quando há lembretes pendentes e ocupa
            1 slot, deslocando temporariamente o botão de menor prioridade.
          </p>
        </CardContent>
      </Card>

      {hasFeature("overview") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Widgets Visíveis na Visão Geral</span>
              </span>
              <span className="text-xs text-muted-foreground font-normal">Personalize seu Início</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const activeWidgetsCount = Object.values(visual.dashboardWidgets).filter(Boolean).length;
              return [
                { key: "kpis" as const, label: "Resumo de Saldo & KPIs (com Sparklines)", desc: "Entradas, Saídas, Investimentos e Saldo Geral" },
                { key: "summary" as const, label: "Saldo Líquido de Contas & Poupança", desc: "A receber, a pagar, faturas abertas e taxa de poupança" },
                { key: "flow" as const, label: "Gráfico de Fluxo Diário", desc: "Curva acumulada de receitas versus despesas no mês" },
                { key: "donut" as const, label: "Distribuição por Categorias", desc: "Gráfico donut com os maiores destinos do seu dinheiro" },
                { key: "budgets" as const, label: "Acompanhamento de Orçamentos", desc: "Barras de consumo e limites por categoria" },
                { key: "contextBanners" as const, label: "Banners Contextuais de Atenção & Ritmo", desc: "Avisos inteligentes quando o ritmo de gastos estiver acelerado ou com risco de déficit" },
              ].map((w) => {
                const isChecked = visual.dashboardWidgets[w.key];
                const isMinThresholdReached = isChecked && activeWidgetsCount <= 3;
                return (
                  <div
                    key={w.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleDashboardWidget(w.key, w.label, !isChecked)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleDashboardWidget(w.key, w.label, !isChecked);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                      isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-surface hover:bg-surface-hover",
                      isMinThresholdReached ? "opacity-90" : "",
                    )}
                  >
                    <div className="pr-4">
                      <div className="font-semibold text-sm text-foreground">{w.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{w.desc}</div>
                    </div>
                    <Checkbox
                      checked={isChecked}
                      disabled={isMinThresholdReached}
                      onCheckedChange={(checked) => handleToggleDashboardWidget(w.key, w.label, Boolean(checked))}
                      aria-label={w.label}
                    />
                  </div>
                );
              });
            })()}
            <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
              Mantenha ao menos 3 widgets ativos para que a tela de Visão Geral exiba uma composição equilibrada de informações.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
