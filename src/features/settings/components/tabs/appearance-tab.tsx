import {
  Palette,
  Check,
  Moon,
  Sun,
  Smartphone,
  Layers,
  Sliders,
  Sparkles,
  Zap,
  VolumeX,
  RotateCcw,
  PanelTop,
  Image as ImageIcon,
  Calculator,
  Monitor,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  LivePulseBeacon,
  Checkbox,
} from "@/components/ui";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import {
  useVisualCustomization,
  type AccentTheme,
  type SurfaceStyle,
  type ExperiencePreset,
  type HeaderButtonsConfig,
} from "@/hooks/use-visual-customization";
import {
  PRESET_METADATA_LIST,
  EXPERIENCE_PRESETS,
} from "@/domain/preferences";
import { triggerSensory } from "@/services/sensory";
import {
  useUpdateCustomSettings,
} from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import { isNativePlatform } from "@/services/native";
import { InstallAppButton } from "@/components/modules";

const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
  { id: "gold", label: "Ouro Âmbar", bgClass: "bg-[#DDA726]", hex: "#DDA726" },
  { id: "sapphire", label: "Safira Petróleo", bgClass: "bg-[#0284C7]", hex: "#0284C7" },
  { id: "violet", label: "Violeta Íris", bgClass: "bg-[#7C3AED]", hex: "#7C3AED" },
  { id: "rose", label: "Coral Rosé", bgClass: "bg-[#E11D48]", hex: "#E11D48" },
  { id: "mono", label: "Monocromático (P&B)", bgClass: "bg-foreground", hex: "#000000" },
];

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun; desc: string }[] = [
  { id: "light", label: "Claro", icon: Sun, desc: "Vital Petróleo & Ouro" },
  { id: "dark", label: "Escuro", icon: Moon, desc: "Abissal Teal" },
  { id: "oled", label: "OLED", icon: Smartphone, desc: "True Black + Alto Contraste P&B" },
  { id: "system", label: "Automático", icon: Sliders, desc: "Sincronizado ao sistema" },
];

const SURFACE_OPTIONS: { id: SurfaceStyle; label: string; desc: string }[] = [
  { id: "glass", label: "Glassmorphism", desc: "Translúcido com desfoque e reflexo de borda" },
  { id: "flat", label: "Minimalista Flat", desc: "Bordas nítidas sem sombras ou gradientes" },
];

export function AppearanceTab() {
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const activePreset = visual.experiencePreset;

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

  const handleSelectSurfaceStyle = (id: SurfaceStyle, label: string) => {
    triggerSensory("selection");
    visual.setSurfaceStyle(id);
    updateCustomSettingsMutation.mutate({ surfaceStyle: id });
    pushToast({
      title: "Preferências salvas",
      description: `Estilo de superfícies alterado para ${label}.`,
      duration: 2200,
    });
  };

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

  const handleResetDefaults = () => {
    triggerSensory("action");
    handleSelectPreset("dynamic");
    handleSelectTheme("system", "Automático");
    handleSelectAccent("teal", "Teal Vital (Oficial)");
    handleSelectSurfaceStyle("glass", "Glassmorphism");
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Modo de Experiência do Aplicativo</span>
            </span>
            <Badge
              variant={activePreset === "custom" ? "warning" : "positive"}
              size="sm"
            >
              {activePreset === "custom" ? "Modo: Personalizado" : "Preset Ativo"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Escolha como o aplicativo se comporta em animações, sons, vibrações e densidade em um único toque.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {PRESET_METADATA_LIST.map((preset) => {
              const isSelected = activePreset === preset.id;
              const Icon =
                preset.id === "dynamic" ? Sparkles : preset.id === "minimal" ? Zap : VolumeX;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border text-left transition-all select-none cursor-pointer relative",
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                      : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("size-4.5", isSelected ? "text-primary-strong" : "text-muted-foreground")} />
                      <span className="font-semibold text-sm text-foreground">{preset.title}</span>
                    </div>
                    {isSelected ? (
                      <Badge variant="positive" size="xs">
                        <Check className="size-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="xs">
                        {preset.badgeLabel}
                      </Badge>
                    )}
                  </div>

                  <span className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {preset.description}
                  </span>

                  <div className="mt-auto space-y-1.5 pt-2 border-t border-border/50 w-full">
                    {preset.highlights.map((h, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-primary/60 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {activePreset === "custom" && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-warning-strong/30 bg-warning/5 text-xs text-foreground flex-wrap gap-2">
              <span>
                Você possui ajustes finos personalizados ativos.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectPreset("dynamic")}
                className="h-7 text-xs gap-1.5"
              >
                <RotateCcw className="size-3" />
                Restaurar Modo Padrão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- CARD 2: IDENTIDADE VISUAL & TEMA --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Aparência &amp; Identidade Visual</span>
            </span>
            <div className="flex items-center gap-1.5">
              <LivePulseBeacon variant="primary" size="sm" />
              <span className="text-xs text-muted-foreground">Tempo Real</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Seletor de Temas */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-foreground">Tema da Interface</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {THEME_OPTIONS.map((t) => {
                const Icon = t.icon;
                const isSelected = themePref === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t.id, t.label)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-left transition-all select-none cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                        : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Icon className={`size-4.5 ${isSelected ? "text-primary-strong" : "text-muted-foreground"}`} />
                      {isSelected && <Check className="size-3.5 text-primary-strong" />}
                    </div>
                    <span className="font-semibold text-xs text-foreground">{t.label}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta de Acento / Accent Theme */}
          <div className="space-y-2.5 pt-2 border-t border-border/60">
            <div className="text-xs font-semibold text-foreground">Cor de Destaque (Accent)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {ACCENT_OPTIONS.map((a) => {
                const isSelected = visual.accent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectAccent(a.id, a.label)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all select-none cursor-pointer min-w-0",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                        : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                    )}
                  >
                    <span
                      className={`size-5 rounded-full shrink-0 shadow-xs ${a.bgClass} flex items-center justify-center border border-border/60`}
                    >
                      {isSelected && (
                        <Check
                          className={`size-3 ${a.id === "mono" ? "text-background" : "text-white"}`}
                        />
                      )}
                    </span>
                    <span className="font-medium text-xs text-foreground leading-tight truncate">
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estilo de Superfície */}
          <div className="space-y-2.5 pt-2 border-t border-border/60">
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Layers className="size-3.5 text-muted-foreground" />
              <span>Estilo de Superfícies &amp; Cards</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SURFACE_OPTIONS.map((s) => {
                const isSelected = visual.surfaceStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSurfaceStyle(s.id, s.label)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border text-left transition-all select-none cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                        : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-xs text-foreground">{s.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary-strong" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- CARD 3: INTERFACE, HEADER & WIDGETS --- */}
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
                      onCheckedChange={(checked) => handleToggleHeaderButton("logo", "Logo no Header", Boolean(checked))}
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
                        if (!isDisabled) handleToggleHeaderButton(item.key, item.label, Boolean(checked));
                      }}
                      aria-label={item.label}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>



      {/* --- CARD 4: INSTALAÇÃO DO APLICATIVO (PWA) --- */}
      {!isNativePlatform() && (
        <InstallAppButton variant="card" />
      )}

      {/* --- CARD 5: REDEFINIÇÃO DE PADRÕES --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Restaurar Padrões de Personalização</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
            <div>
              <div className="font-semibold text-sm text-foreground">Redefinir tudo aos valores de fábrica</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Restaura o modo de experiência Dinâmico, tema oficial, paleta Teal e disposição padrão de widgets.
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" />
              <span>Redefinir</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
