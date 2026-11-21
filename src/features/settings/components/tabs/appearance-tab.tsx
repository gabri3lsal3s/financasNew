import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import { useIsPro } from "@/hooks/use-is-pro";
import type {
  ThemePreference,
  DarkThemeVariant,
  ThemeScheduleConfig,
} from "@/app/theme-provider";
import { DEFAULT_THEME_SCHEDULE } from "@/domain/theme";
import {
  useVisualCustomization,
  DEFAULT_HEADER_BUTTONS,
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
  const isPro = useIsPro();
  const {
    preference: themePref,
    setPreference: setThemePref,
    darkThemeVariant,
    setDarkThemeVariant,
    scheduleConfig,
    setScheduleConfig,
  } = useTheme();

  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSelectPreset = (preset: ExperiencePreset) => {
    // Persiste o preset ANTES do feedback sensorial para que "Discreto" silencie de imediato (DESIGN_RULES §5.2)
    visual.setExperiencePreset(preset);
    triggerSensory("selection");

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
  };

  const handleToggleSound = (enabled: boolean) => {
    const clearMuted = enabled && visual.disabledSensoryIntents.length >= 7;
    visual.setSoundEnabled(enabled);
    updateCustomSettingsMutation.mutate({
      soundEnabled: enabled,
      ...(clearMuted ? { disabledSensoryIntents: [] } : {}),
    });
  };

  const handleToggleHaptic = (enabled: boolean) => {
    const clearMuted = enabled && visual.disabledSensoryIntents.length >= 7;
    visual.setHapticEnabled(enabled);
    updateCustomSettingsMutation.mutate({
      hapticEnabled: enabled,
      ...(clearMuted ? { disabledSensoryIntents: [] } : {}),
    });
  };

  const handleSelectTheme = (id: ThemePreference) => {
    triggerSensory("selection");
    setThemePref(id);
    updateCustomSettingsMutation.mutate({
      themePreference: id,
    });
  };

  const handleSelectDarkThemeVariant = (variant: DarkThemeVariant) => {
    triggerSensory("selection");
    setDarkThemeVariant(variant);
    const nextSchedule = {
      ...scheduleConfig,
      nightTheme: variant,
    };
    setScheduleConfig(nextSchedule);
    updateCustomSettingsMutation.mutate({
      darkThemeVariant: variant,
      themeSchedule: nextSchedule,
    });
  };

  const handleUpdateScheduleConfig = (patch: Partial<ThemeScheduleConfig>) => {
    triggerSensory("selection");
    const nextSchedule = {
      ...scheduleConfig,
      ...patch,
    };
    setScheduleConfig(nextSchedule);
    updateCustomSettingsMutation.mutate({
      themeSchedule: nextSchedule,
    });
  };

  const handleSelectAccent = (id: AccentTheme) => {
    triggerSensory("selection");
    visual.setAccent(id);
    updateCustomSettingsMutation.mutate({
      accent: id,
    });
  };

  const handleToggleHeaderButton = (
    key: keyof HeaderButtonsConfig,
    _label: string,
    nextChecked: boolean,
  ) => {
    visual.setHeaderButton(key, nextChecked);
    updateCustomSettingsMutation.mutate({
      headerButtons: { [key]: nextChecked },
    });
  };

  const handleResetDefaults = () => {
    const dynamic = EXPERIENCE_PRESETS.dynamic;
    visual.resetToDefaults();
    setThemePref("system");
    setDarkThemeVariant("dark");
    setScheduleConfig(DEFAULT_THEME_SCHEDULE);
    triggerSensory("action");
    updateCustomSettingsMutation.mutate({
      experiencePreset: "dynamic",
      accent: "teal",
      surfaceStyle: "glass",
      motionLevel: dynamic.motionLevel,
      density: dynamic.density,
      soundEnabled: dynamic.soundEnabled,
      hapticEnabled: dynamic.hapticEnabled,
      numberTickerEnabled: dynamic.numberTickerEnabled,
      disabledSensoryIntents: dynamic.disabledSensoryIntents,
      headerButtons: DEFAULT_HEADER_BUTTONS,
      themePreference: "system",
      darkThemeVariant: "dark",
      themeSchedule: DEFAULT_THEME_SCHEDULE,
      showCalculationMemory: true,
    });
    pushToast({
      title: "Personalização redefinida",
      description: "Padrões de experiência, visual e interface restaurados com sucesso.",
      duration: 2500,
    });
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      {/* --- CARD 1: MODO DE EXPERIÊNCIA & SENSORIAL --- */}
      <ExperiencePresetsCard
        activePreset={visual.experiencePreset}
        onSelectPreset={handleSelectPreset}
        soundEnabled={visual.soundEnabled}
        onToggleSound={handleToggleSound}
        hapticEnabled={visual.hapticEnabled}
        onToggleHaptic={handleToggleHaptic}
      />

      {/* --- CARD 2: IDENTIDADE VISUAL & TEMA --- */}
      <VisualIdentityCard
        themePref={themePref}
        onSelectTheme={handleSelectTheme}
        darkThemeVariant={darkThemeVariant}
        onSelectDarkThemeVariant={handleSelectDarkThemeVariant}
        scheduleConfig={scheduleConfig}
        onUpdateScheduleConfig={handleUpdateScheduleConfig}
        accent={visual.accent}
        onSelectAccent={handleSelectAccent}
        isPro={isPro}
      />

      {/* --- CARD 3: INTERFACE, HEADER & COMPOSIÇÃO --- */}
      <InterfaceShortcutsCard
        headerButtons={visual.headerButtons}
        onToggleHeaderButton={handleToggleHeaderButton}
      />

      {/* --- AÇÃO DE RODAPÉ: REDEFINIÇÃO DE PADRÕES --- */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5">
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
          className="shrink-0 gap-1.5"
        >
          <RotateCcw className="size-3.5 text-muted-foreground" aria-hidden="true" />
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
