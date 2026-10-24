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
import { ExperiencePresetsCard } from "./experience-presets-card";
import { VisualIdentityCard } from "./visual-identity-card";
import { InterfaceShortcutsCard } from "./interface-shortcuts-card";
import { ResetDefaultsCard } from "./reset-defaults-card";

export function AppearanceTab() {
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

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

  const handleToggleHideDashboardCents = (enabled: boolean) => {
    triggerSensory("toggle");
    visual.setHideDashboardCents(enabled);
    updateCustomSettingsMutation.mutate({
      hideDashboardCents: enabled,
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Valores do Dashboard serão exibidos sem centavos."
        : "Valores do Dashboard serão exibidos com centavos completos.",
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
    visual.setHideDashboardCents(false);
    updateCustomSettingsMutation.mutate({
      hideDashboardCents: false,
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
        hideDashboardCents={visual.hideDashboardCents}
        onToggleHideDashboardCents={handleToggleHideDashboardCents}
      />

      {/* --- CARD 3: INTERFACE, HEADER & COMPOSIÇÃO --- */}
      <InterfaceShortcutsCard
        headerButtons={visual.headerButtons}
        onToggleHeaderButton={handleToggleHeaderButton}
      />

      {/* --- CARD 4: REDEFINIÇÃO DE PADRÕES --- */}
      <ResetDefaultsCard onReset={handleResetDefaults} />
    </div>
  );
}
