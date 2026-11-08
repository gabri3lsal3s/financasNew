import {
  PanelTop,
  Image as ImageIcon,
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
import { useFamilyMode, useTripMode } from "@/state";
import type { HeaderButtonsConfig } from "@/hooks/use-visual-customization";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PanelTop className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Interface &amp; Composição</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Atalhos do Header */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Atalhos Rápidos do Cabeçalho</span>
            <span className="text-[11px] text-muted-foreground font-normal">Máximo de 2 botões de ação</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Logo Oficial */}
            {(() => {
              const isChecked = headerButtons.logo;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleHeaderButton("logo", "Logo no Header", !isChecked)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleHeaderButton("logo", "Logo no Header", !isChecked);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    isChecked
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="flex items-center gap-2.5 pr-2 min-w-0">
                    <ImageIcon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground">Logotipo Oficial</div>
                      <div className="text-[11px] text-muted-foreground">Exibe o logotipo no topo</div>
                    </div>
                  </div>
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggleHeaderButton("logo", "Logo no Header", Boolean(checked))}
                    aria-label="Logotipo Oficial"
                  />
                </div>
              );
            })()}

            {/* Botões de Ação com limite de 2 */}
            {(
              [
                {
                  key: "calculatorButton" as const,
                  label: "Calculadora",
                  desc: "Calculadora flutuante rápida",
                  icon: Calculator,
                },
                {
                  key: "themeToggle" as const,
                  label: "Alternar Tema",
                  desc: "Troca rápida de tema no topo",
                  icon: Monitor,
                },
                {
                  key: "privacyToggle" as const,
                  label: "Ocultar Valores (Privacidade)",
                  desc: "Botão de privacidade (tecla P)",
                  icon: Eye,
                },
              ] satisfies {
                key: keyof HeaderButtonsConfig;
                label: string;
                desc: string;
                icon: typeof Monitor;
              }[]
            ).map((item) => {
              const isChecked = headerButtons[item.key];
              const activeSlots = [
                headerButtons.calculatorButton,
                headerButtons.themeToggle,
                headerButtons.privacyToggle,
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
                    onToggleHeaderButton(item.key, item.label, !isChecked);
                  }}
                  onKeyDown={(e) => {
                    if (isDisabled) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleHeaderButton(item.key, item.label, !isChecked);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors select-none",
                    isDisabled
                      ? "border-border bg-surface opacity-50 cursor-not-allowed"
                      : isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                        : "border-border bg-surface hover:bg-surface-hover cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-2.5 pr-2 min-w-0">
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                  </div>
                  <Checkbox
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      if (!isDisabled) onToggleHeaderButton(item.key, item.label, Boolean(checked));
                    }}
                    aria-label={item.label}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Divisão: Módulos & Modos de Visualização */}
        <div className="pt-4 border-t border-border/80 space-y-3">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Módulos de Visão &amp; Lançamento</span>
            <span className="text-[11px] text-muted-foreground font-normal">Personalização do fluxo</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Modo Familiar */}
            <div
              role="button"
              tabIndex={isUpdatingFamilyMode ? -1 : 0}
              onClick={() => {
                if (!isUpdatingFamilyMode) {
                  void toggleFamilyMode(!isFamilyModeEnabled);
                }
              }}
              onKeyDown={(e) => {
                if (isUpdatingFamilyMode) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void toggleFamilyMode(!isFamilyModeEnabled);
                }
              }}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors select-none cursor-pointer",
                isFamilyModeEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center gap-3 pr-2 min-w-0">
                <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">Modo Familiar</div>
                  <div className="text-[11px] text-muted-foreground">
                    {isFamilyModeEnabled
                      ? "Ativo. Exibe abas de visão e botões para separar gastos pessoais e familiares."
                      : "Desativado por padrão. Mantém o visual mais limpo para uso pessoal, sem perder dados."}
                  </div>
                </div>
              </div>
              <Switch
                checked={isFamilyModeEnabled}
                disabled={isUpdatingFamilyMode}
                onCheckedChange={(checked) => {
                  void toggleFamilyMode(checked);
                }}
                aria-label="Modo Familiar"
              />
            </div>

            {/* Modo Viagem */}
            <div
              role="button"
              tabIndex={isUpdatingTripMode ? -1 : 0}
              onClick={() => {
                if (!isUpdatingTripMode) {
                  void toggleTripMode(!isTripModeEnabled);
                }
              }}
              onKeyDown={(e) => {
                if (isUpdatingTripMode) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void toggleTripMode(!isTripModeEnabled);
                }
              }}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors select-none cursor-pointer",
                isTripModeEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center gap-3 pr-2 min-w-0">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
