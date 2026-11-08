import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import {
  useVisualCustomization,
  type AccentTheme,
  type ExperiencePreset,
  type HeaderButtonsConfig,
} from "@/hooks/use-visual-customization";
import { EXPERIENCE_PRESETS } from "@/domain/preferences";
import { triggerSensory } from "@/services/sensory";
import { useUpdateCustomSettings } from "@/state";
import { pushToast } from "@/services/toast";
import { Button, Card, ConfirmDialog } from "@/components/ui";
import { ExperiencePresetsCard } from "./experience-presets-card";
import { VisualIdentityCard } from "./visual-identity-card";
import { InterfaceShortcutsCard } from "./interface-shortcuts-card";

export function AppearanceTab() {
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSelectPreset = (preset: ExperiencePreset) => {
    triggerSensory("action");
    visual.setExperiencePreset(preset);

    if (preset !== "custom") {
      const applied = EXPERIENCE_PRESETS[preset];
      updateCustomSettingsMutation.mutate({
        experiencePreset: preset,
        motionLevel: applied.motionLevel,
        density: applied.density,
        soundEnabled: applied.soundEnabled,
        hapticEnabled: applied.hapticEnabled,
        numberTickerEnabled: applied.numberTickerEnabled,
        disabledSensoryIntents: applied.disabledSensoryIntents,
      });
    }

    const titles: Record<ExperiencePreset, string> = {
      dynamic: "Dinâmico",
      minimal: "Foco (Minimalista)",
      discreet: "Discreto (Silencioso)",
      custom: "Personalizado",
    };

    pushToast({
      title: "Modo de Experiência aplicado",
      description: `Perfil alterado para ${titles[preset]}.`,
      duration: 2200,
    });
  };

  const handleSelectTheme = (id: ThemePreference, label: string) => {
    triggerSensory("selection");
    setThemePref(id);
    pushToast({
      title: "Preferências salvas",
      description: `Tema alterado para ${label}.`,
      duration: 2200,
    });
  };

  const handleSelectAccent = (id: AccentTheme, label: string) => {
    triggerSensory("selection");
    visual.setAccent(id);
    pushToast({
      title: "Preferências salvas",
      description: `Cor de destaque alterada para ${label}.`,
      duration: 2200,
    });
  };

  const handleToggleHeaderButton = (
    key: keyof HeaderButtonsConfig,
    label: string,
    nextChecked: boolean,
  ) => {
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

  const handleResetDefaults = () => {
    triggerSensory("action");
    handleSelectPreset("dynamic");
    handleSelectTheme("system", "Automático");
    handleSelectAccent("teal", "Teal Vital (Oficial)");
    updateCustomSettingsMutation.mutate({
      headerButtons: {
        logo: true,
        calculatorButton: true,
        themeToggle: false,
        privacyToggle: false,
      },
    });
    pushToast({
      title: "Personalização redefinida",
      description: "Padrões de experiência, visual e interface restaurados com sucesso.",
      duration: 2500,
    });
  };

  return (
    <div className="space-y-6">
      {/* --- CARD 1: MODO DE EXPERIÊNCIA & SENSORIAL --- */}
      <ExperiencePresetsCard
        activePreset={visual.experiencePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* --- CARD 2: IDENTIDADE VISUAL & TEMA --- */}
      <VisualIdentityCard
        themePref={themePref}
        onSelectTheme={handleSelectTheme}
        accent={visual.accent}
        onSelectAccent={handleSelectAccent}
      />

      {/* --- CARD 3: INTERFACE, HEADER & COMPOSIÇÃO --- */}
      <InterfaceShortcutsCard
        headerButtons={visual.headerButtons}
        onToggleHeaderButton={handleToggleHeaderButton}
      />

      {/* --- AÇÃO DE RODAPÉ: REDEFINIÇÃO DE PADRÕES --- */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-foreground block">
            Restaurar Padrões de Personalização
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Restaura o modo de experiência Dinâmico, tema oficial Teal Vital e disposição padrão do cabeçalho.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsResetConfirmOpen(true)}
          className="h-8 px-3 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5"
        >
          <RotateCcw className="size-3 text-muted-foreground" aria-hidden="true" />
          <span>Restaurar Padrões</span>
        </Button>
      </Card>

      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title="Restaurar padrões de personalização?"
        description="Isso restaurará o tema oficial Teal Vital, o modo Dinâmico e as configurações padrão do cabeçalho. Seus dados e transações não serão alterados."
        confirmLabel="Confirmar Restauração"
        onConfirm={handleResetDefaults}
      />
    </div>
  );
}
