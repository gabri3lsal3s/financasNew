import {
  Briefcase,
  PanelTop,
  Calculator,
  Monitor,
  Eye,
  Users,
  Plane,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Checkbox,
  Switch,
} from "@/components/ui";
import { useBusinessMode, useFamilyMode, useTripMode, useUpdateCustomSettings } from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  useVisualCustomization,
  type HeaderButtonsConfig,
} from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface InterfaceShortcutsCardProps {
  headerButtons: HeaderButtonsConfig;
  onToggleHeaderButton: (key: keyof HeaderButtonsConfig, label: string, nextChecked: boolean) => void;
}

export function InterfaceShortcutsCard({
  headerButtons,
  onToggleHeaderButton,
}: InterfaceShortcutsCardProps) {
  const { isFamilyModeEnabled, toggleFamilyMode, isPending: isUpdatingFamilyMode } = useFamilyMode();
  const { isTripModeEnabled, toggleTripMode, isPending: isUpdatingTripMode } = useTripMode();
  const {
    isBusinessModeEnabled,
    toggleBusinessMode,
    isPending: isUpdatingBusinessMode,
  } = useBusinessMode();
  const { guardAction, upgradeModal } = useMutationGuard();
  const { showCalculationMemory, setShowCalculationMemory } = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const activeSlots = [
    headerButtons.calculatorButton,
    headerButtons.themeToggle,
    headerButtons.privacyToggle,
  ].filter(Boolean).length;

  const shortcutItems: {
    key: keyof HeaderButtonsConfig;
    label: string;
    desc: string;
    icon: typeof Monitor;
    isChecked: boolean;
    isDisabled: boolean;
  }[] = [
    {
      key: "calculatorButton",
      label: "Calculadora",
      desc: "Calculadora flutuante rápida",
      icon: Calculator,
      isChecked: headerButtons.calculatorButton,
      isDisabled: !headerButtons.calculatorButton && activeSlots >= 2,
    },
    {
      key: "themeToggle",
      label: "Alternar Tema",
      desc: "Troca rápida de tema no topo",
      icon: Monitor,
      isChecked: headerButtons.themeToggle,
      isDisabled: !headerButtons.themeToggle && activeSlots >= 2,
    },
    {
      key: "privacyToggle",
      label: "Ocultar Valores (Privacidade)",
      desc: "Botão de privacidade (tecla P)",
      icon: Eye,
      isChecked: headerButtons.privacyToggle,
      isDisabled: !headerButtons.privacyToggle && activeSlots >= 2,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PanelTop className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Interface &amp; Composição</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Atalhos do Header */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span>Atalhos Rápidos do Cabeçalho</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Máximo de 2 ativos (o sininho ocupa o slot da direita quando há avisos)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {shortcutItems.map((item) => {
              const Icon = item.icon;
              const fieldId = `header-shortcut-${item.key}`;

              return (
                <label
                  key={item.key}
                  htmlFor={fieldId}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors duration-150 select-none min-h-11",
                    item.isDisabled
                      ? "border-border/80 bg-surface opacity-50 cursor-not-allowed"
                      : item.isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                        : "border-border/80 bg-surface hover:bg-surface-hover cursor-pointer",
                  )}
                >
                  <span className="flex items-center gap-2.5 pr-2 min-w-0">
                    <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="min-w-0 block">
                      <span className="font-semibold text-xs text-foreground block">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground block line-clamp-2 break-words">
                        {item.desc}
                      </span>
                    </span>
                  </span>
                  <Checkbox
                    id={fieldId}
                    checked={item.isChecked}
                    disabled={item.isDisabled}
                    onCheckedChange={(checked) => {
                      if (!item.isDisabled) {
                        onToggleHeaderButton(item.key, item.label, Boolean(checked));
                      }
                    }}
                    aria-label={item.label}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* Divisão: Módulos & Modos de Visualização */}
        <div className="pt-4 border-t border-border/80 space-y-3">
          <div className="text-xs font-semibold text-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span>Módulos de Visão &amp; Lançamento</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Personalização do fluxo
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div
              className={cn(
                "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors duration-150",
                isFamilyModeEnabled ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">Modo Família</div>
                  <div className="text-[11px] text-muted-foreground">
                    {isFamilyModeEnabled
                      ? "Ativo por padrão. Exibe abas de visão e botões para separar gastos pessoais e familiares."
                      : "Desativado. Mantém o visual mais limpo para uso pessoal, sem perder dados."}
                  </div>
                </div>
              </div>
              <Switch
                checked={isFamilyModeEnabled}
                disabled={isUpdatingFamilyMode}
                onCheckedChange={(checked) => {
                  void toggleFamilyMode(checked);
                }}
                aria-label="Modo Família"
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors duration-150",
                isTripModeEnabled ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Plane className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">Modo Viagem</div>
                  <div className="text-[11px] text-muted-foreground">
                    {isTripModeEnabled
                      ? "Ativo. Exibe grupos de viagens compartilhadas, extrato multi-pagadores e liquidação Pix."
                      : "Desativado por padrão. Mantém o foco no dia a dia sem perder o histórico das suas viagens."}
                  </div>
                </div>
              </div>
              <Switch
                checked={isTripModeEnabled}
                disabled={isUpdatingTripMode}
                onCheckedChange={(checked) => {
                  void toggleTripMode(checked);
                }}
                aria-label="Modo Viagem"
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors duration-150",
                isBusinessModeEnabled ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Briefcase className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">
                    Modo Negócio (MEI / Autônomo)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isBusinessModeEnabled
                      ? "Ativo. Separa finanças pessoais (PF) e do negócio (PJ), DRE mensal, Teto MEI e painel /negocio."
                      : "Desativado por padrão. Ative se você é MEI, autônomo ou profissional liberal e deseja separar PF e PJ."}
                  </div>
                </div>
              </div>
              <Switch
                checked={isBusinessModeEnabled}
                disabled={isUpdatingBusinessMode}
                onCheckedChange={(checked) => {
                  if (checked) {
                    guardAction(() => void toggleBusinessMode(true), "Modo Negócio");
                  } else {
                    void toggleBusinessMode(false);
                  }
                }}
                aria-label="Modo Negócio (MEI / Autônomo)"
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors duration-150",
                showCalculationMemory ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calculator className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">
                    Memória de Cálculo e Explicabilidade
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {showCalculationMemory
                      ? "Ativo. Exibe atalhos informativos com a fórmula matemática dos indicadores (no computador, visíveis ao passar o mouse)."
                      : "Oculto. Mantém a interface limpa e minimalista sem os ícones de memória de cálculo."}
                  </div>
                </div>
              </div>
              <Switch
                checked={showCalculationMemory}
                disabled={updateCustomSettingsMutation.isPending}
                onCheckedChange={(checked) => {
                  triggerSensory("toggle");
                  setShowCalculationMemory(checked);
                  updateCustomSettingsMutation.mutate({ showCalculationMemory: checked });
                }}
                aria-label="Memória de Cálculo e Explicabilidade"
              />
            </div>
          </div>
        </div>
      </CardContent>
      {upgradeModal}
    </Card>
  );
}
