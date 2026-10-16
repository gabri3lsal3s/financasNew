import { useEffect, useState } from "react";
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
  Bell,
  PanelTop,
  Image as ImageIcon,
  Calculator,
  Monitor,
  Eye,
  CreditCard,
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
  Select,
  type SelectOption,
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
  useUserPreferences,
  useUpdateReminderPreferences,
  useUserAccess,
} from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  isDailyReminderEnabled,
  setDailyReminderEnabled,
  getDailyReminderTime,
  setDailyReminderTime,
  scheduleDailyReminder,
  cancelDailyReminder,
  requestNotificationPermissions,
  useBankAssistantPreferences,
  resetBankAssistantPreferences,
  isNotificationListenerGranted,
  requestNotificationListenerPermission,
} from "@/services/native";
import { HOMOLOGATED_BANKS } from "@/domain/notifications";

const DAILY_REMINDER_TIME_OPTIONS: SelectOption[] = [
  { value: "19:00", label: "19:00 (Início da noite)" },
  { value: "20:00", label: "20:00 (Padrão sugerido)" },
  { value: "21:00", label: "21:00" },
  { value: "22:00", label: "22:00 (Final da noite)" },
];

const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
  { id: "emerald", label: "Esmeralda Fintech", bgClass: "bg-[#10B981]", hex: "#10B981" },
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

const REMINDER_DAYS_OPTIONS: SelectOption[] = [
  { value: "0", label: "No dia do vencimento" },
  { value: "1", label: "1 dia antes" },
  { value: "2", label: "2 dias antes" },
  { value: "3", label: "3 dias antes (recomendado)" },
  { value: "5", label: "5 dias antes" },
  { value: "7", label: "7 dias antes (1 semana)" },
  { value: "10", label: "10 dias antes" },
  { value: "15", label: "15 dias antes" },
  { value: "30", label: "30 dias antes (1 mês)" },
];

export function AppearanceTab() {
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const visual = useVisualCustomization();
  const { hasFeature } = useUserAccess();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const preferencesQuery = useUserPreferences();
  const updateReminderPreferencesMutation = useUpdateReminderPreferences();

  const activePreset = visual.experiencePreset;

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;

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

  const handleToggleReminders = (enabled: boolean) => {
    triggerSensory("toggle");
    updateReminderPreferencesMutation.mutate({ remindersEnabled: enabled });
  };

  const handleUpdateBillDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeBill: num });
    }
  };

  const handleUpdateDebtDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeDebt: num });
    }
  };

  const [dailyReminderActive, setDailyReminderActive] = useState(() => isDailyReminderEnabled());
  const [dailyReminderTime, setDailyReminderTimeState] = useState(() => getDailyReminderTime());

  const handleToggleDailyReminder = async (enabled: boolean) => {
    if (enabled) {
      const perm = await requestNotificationPermissions();
      if (!perm.granted) {
        pushToast({
          title: "Permissão de notificação necessária",
          description: "Habilite as notificações nas configurações do seu celular para receber o lembrete.",
          variant: "destructive",
        });
        return;
      }
      const [h, m] = dailyReminderTime.split(":").map(Number);
      const scheduled = await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      if (scheduled) {
        setDailyReminderEnabled(true);
        setDailyReminderActive(true);
        pushToast({
          title: "Lembrete diário ativado",
          description: `Você receberá uma notificação com botões rápidos todos os dias às ${dailyReminderTime}.`,
          variant: "success",
        });
      } else {
        pushToast({
          title: "Falha ao agendar",
          description: "Não foi possível agendar o lembrete diário no dispositivo.",
          variant: "destructive",
        });
      }
    } else {
      await cancelDailyReminder();
      setDailyReminderEnabled(false);
      setDailyReminderActive(false);
      pushToast({
        title: "Lembrete diário desativado",
        variant: "default",
      });
    }
  };

  const handleDailyReminderTimeChange = async (time: string) => {
    setDailyReminderTimeState(time);
    setDailyReminderTime(time);
    if (dailyReminderActive) {
      const [h, m] = time.split(":").map(Number);
      await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      pushToast({
        title: "Horário atualizado",
        description: `Lembrete diário reagendado para às ${time}.`,
        variant: "success",
      });
    }
  };

  const { preferences: bankPrefs, updatePreferences: updateBankPrefs } = useBankAssistantPreferences();
  const [listenerPermissionGranted, setListenerPermissionGranted] = useState(true);

  useEffect(() => {
    void isNotificationListenerGranted().then((granted) => {
      setListenerPermissionGranted(granted);
    });
  }, []);

  const handleTogglePassiveCapture = async (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ passiveCaptureEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { passiveCaptureEnabled: enabled },
    });

    if (enabled) {
      const granted = await isNotificationListenerGranted();
      setListenerPermissionGranted(granted);
      if (!granted) {
        pushToast({
          title: "Permissão de leitura de notificações necessária",
          description: "Habilite o acesso a notificações nas configurações do seu celular.",
          variant: "warning",
        });
      } else {
        pushToast({
          title: "Captura de compras ativada",
          description: "Notificações bancárias serão detectadas e convertidas em sugestões.",
        });
      }
    } else {
      pushToast({
        title: "Captura de compras desativada",
        description: "Nenhuma notificação bancária será processada.",
      });
    }
  };

  const handleRequestPermission = async () => {
    triggerSensory("action");
    await requestNotificationListenerPermission();
    const granted = await isNotificationListenerGranted();
    setListenerPermissionGranted(granted);
  };

  const handleToggleInteractiveNotifications = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ interactiveNotificationsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { interactiveNotificationsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Notificações com botões de ação rápida ativadas."
        : "Notificações silenciosas ativadas (apenas card discreto na tela inicial).",
    });
  };

  const handleToggleAutoInstallments = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoInstallmentsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoInstallmentsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Detecção e desmembramento automático de parcelas ativado."
        : "Cálculo de parcelas desativado (compras tratadas como parcela única).",
    });
  };

  const handleToggleAutoCategoryInference = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoCategoryInferenceEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoCategoryInferenceEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Inferência automática de categorias ativada."
        : "Inferência desativada (seleção manual exigida).",
    });
  };

  const handleToggleBank = (bankName: string, nextChecked: boolean) => {
    triggerSensory("toggle");
    const currentList = bankPrefs.monitoredBanks;
    const nextList = nextChecked
      ? [...new Set([...currentList, bankName])]
      : currentList.filter((b) => b !== bankName);

    updateBankPrefs({ monitoredBanks: nextList });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: nextList },
    });
  };

  const handleSelectAllBanks = () => {
    triggerSensory("action");
    const all = [...HOMOLOGATED_BANKS];
    updateBankPrefs({ monitoredBanks: all });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: all },
    });
    pushToast({
      title: "Todos os bancos selecionados",
      description: "Todos os 17 bancos homologados estão sendo monitorados.",
    });
  };

  const handleDeselectAllBanks = () => {
    triggerSensory("action");
    updateBankPrefs({ monitoredBanks: [] });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: [] },
    });
    pushToast({
      title: "Todos os bancos desmarcados",
      description: "Nenhum banco está selecionado para captura.",
    });
  };

  const handleResetDefaults = () => {
    triggerSensory("action");
    handleSelectPreset("dynamic");
    handleSelectTheme("system", "Automático");
    handleSelectAccent("teal", "Teal Vital (Oficial)");
    handleSelectSurfaceStyle("glass", "Glassmorphism");
    resetBankAssistantPreferences();
    updateCustomSettingsMutation.mutate({
      headerButtons: {
        logo: true,
        calculatorButton: true,
        themeToggle: false,
        privacyToggle: false,
      },
      bankAssistant: {
        passiveCaptureEnabled: true,
        interactiveNotificationsEnabled: true,
        autoInstallmentsEnabled: true,
        autoCategoryInferenceEnabled: true,
        monitoredBanks: [...HOMOLOGATED_BANKS],
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

      {/* --- CARD 4: LEMBRETES & NOTIFICAÇÕES (se feature ativa) --- */}
      {hasFeature("reminders") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Lembretes &amp; Notificações</span>
              </span>
              <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
                {remindersEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggleReminders(!remindersEnabled)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleReminders(!remindersEnabled);
                }
              }}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                remindersEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="pr-4">
                <div className="font-semibold text-sm text-foreground">
                  Habilitar Lembretes Automáticos
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Notifica sobre faturas de cartão e dívidas próximas do vencimento no sino do cabeçalho.
                </div>
              </div>
              <Checkbox
                checked={remindersEnabled}
                onCheckedChange={handleToggleReminders}
                aria-label="Habilitar Lembretes no Aplicativo"
              />
            </div>

            {remindersEnabled && (
              <div className="grid gap-3.5 pt-1 sm:grid-cols-2">
                {/* Antecedência para Faturas */}
                {hasFeature("cards") && (
                  <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2.5">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        Antecedência para Faturas de Cartão
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Momento do alerta antes do fechamento/vencimento.
                      </p>
                    </div>

                    <Select
                      value={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                          ? String(billDaysBefore)
                          : "custom"
                      }
                      onValueChange={(val) => {
                        if (val !== "custom") {
                          handleUpdateBillDays(val);
                        }
                      }}
                      options={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                          ? REMINDER_DAYS_OPTIONS
                          : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${billDaysBefore} dias (Personalizado)` }]
                      }
                      ariaLabel="Seletor de dias de antecedência para faturas"
                    />
                  </div>
                )}

                {/* Antecedência para Dívidas */}
                {hasFeature("debts") && (
                  <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2.5">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        Antecedência para Dívidas
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Momento do alerta antes da data de quitação.
                      </p>
                    </div>

                    <Select
                      value={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                          ? String(debtDaysBefore)
                          : "custom"
                      }
                      onValueChange={(val) => {
                        if (val !== "custom") {
                          handleUpdateDebtDays(val);
                        }
                      }}
                      options={
                        REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                          ? REMINDER_DAYS_OPTIONS
                          : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${debtDaysBefore} dias (Personalizado)` }]
                      }
                      ariaLabel="Seletor de dias de antecedência para dívidas"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Lembrete de Fechamento Diário (Notificação no Celular / Dispositivo) */}
            <div className="pt-3.5 border-t border-border/80 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
                <div className="pr-4 space-y-0.5">
                  <div className="font-semibold text-sm text-foreground">
                    Lembrete de Fechamento Diário
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Receba uma notificação no dispositivo com ações rápidas para registrar despesas e receitas do dia.
                  </div>
                </div>
                <Checkbox
                  checked={dailyReminderActive}
                  onCheckedChange={handleToggleDailyReminder}
                  aria-label="Habilitar Lembrete de Fechamento Diário"
                />
              </div>

              {dailyReminderActive && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Horário do Lembrete
                  </span>
                  <Select
                    value={dailyReminderTime}
                    onValueChange={handleDailyReminderTimeChange}
                    options={DAILY_REMINDER_TIME_OPTIONS}
                    ariaLabel="Selecione o horário para o lembrete diário"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O aplicativo emitirá a notificação programada todos os dias no horário selecionado.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- CARD 5: ASSISTENTE PASSIVO DE COMPRAS & BANCOS (Fase 14 — Tarefa 30) --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Assistente Passivo de Compras &amp; Bancos</span>
            </span>
            <Badge variant={bankPrefs.passiveCaptureEnabled ? "positive" : "muted"} size="xs">
              {bankPrefs.passiveCaptureEnabled ? "Ativado" : "Desativado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle Mestre */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled);
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              bankPrefs.passiveCaptureEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground">
                Captura Passiva de Notificações Bancárias
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Detecta compras no cartão, transferências e Pix recebidos/enviados e gera sugestões inteligentes no aplicativo.
              </div>
            </div>
            <Checkbox
              checked={bankPrefs.passiveCaptureEnabled}
              onCheckedChange={handleTogglePassiveCapture}
              aria-label="Habilitar Captura Passiva de Notificações"
            />
          </div>

          {/* Alerta de permissão do Android se pendente */}
          {bankPrefs.passiveCaptureEnabled && !listenerPermissionGranted && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-warning/40 bg-warning/5 gap-3">
              <div>
                <div className="font-semibold text-xs text-foreground">
                  Acesso a Notificações Pendente no Android
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Para detectar compras em segundo plano, conceda acesso ao leitor de notificações nas configurações do dispositivo.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestPermission}
                className="shrink-0 text-xs gap-1.5"
              >
                <span>Habilitar no Android</span>
              </Button>
            </div>
          )}

          {/* Opções Detalhadas se o Toggle Mestre estiver ativo */}
          {bankPrefs.passiveCaptureEnabled && (
            <div className="space-y-3 pt-1">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Toggle 1: Notificações Interativas */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    bankPrefs.interactiveNotificationsEnabled
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="pr-3">
                    <div className="font-semibold text-xs text-foreground">
                      Notificações com Ação Rápida
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Exibe push rico no celular com botões Adicionar Rápido e Editar.
                    </div>
                  </div>
                  <Checkbox
                    checked={bankPrefs.interactiveNotificationsEnabled}
                    onCheckedChange={handleToggleInteractiveNotifications}
                    aria-label="Habilitar Notificações com Ação Rápida"
                  />
                </div>

                {/* Toggle 2: Parcelamento Automático */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    bankPrefs.autoInstallmentsEnabled
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="pr-3">
                    <div className="font-semibold text-xs text-foreground">
                      Cálculo Automático de Parcelas
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Identifica compras parceladas e divide os valores mensalmente.
                    </div>
                  </div>
                  <Checkbox
                    checked={bankPrefs.autoInstallmentsEnabled}
                    onCheckedChange={handleToggleAutoInstallments}
                    aria-label="Habilitar Cálculo Automático de Parcelas"
                  />
                </div>
              </div>

              {/* Toggle 3: Inferência de Categorias */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                  bankPrefs.autoCategoryInferenceEnabled
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-3">
                  <div className="font-semibold text-xs text-foreground">
                    Inferência Automática de Categorias
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Sugere categorias pelo estabelecimento (alimentação, mercado, transporte, farmácia).
                  </div>
                </div>
                <Checkbox
                  checked={bankPrefs.autoCategoryInferenceEnabled}
                  onCheckedChange={handleToggleAutoCategoryInference}
                  aria-label="Habilitar Inferência Automática de Categorias"
                />
              </div>

              {/* Filtro de Bancos Homologados */}
              <div className="pt-2 border-t border-border/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold text-xs text-foreground">
                      Bancos e Carteiras Monitoradas ({bankPrefs.monitoredBanks.length}/{HOMOLOGATED_BANKS.length})
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Selecione quais instituições financeiras devem gerar sugestões de compras e Pix.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleSelectAllBanks}
                      className="text-[11px] h-7 px-2"
                    >
                      Marcar todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleDeselectAllBanks}
                      className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                    >
                      Desmarcar todos
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                  {HOMOLOGATED_BANKS.map((bank) => {
                    const isChecked = bankPrefs.monitoredBanks.includes(bank);
                    return (
                      <div
                        key={bank}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggleBank(bank, !isChecked)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleBank(bank, !isChecked);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors cursor-pointer select-none",
                          isChecked
                            ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
                            : "border-border bg-surface hover:bg-surface-hover text-muted-foreground",
                        )}
                      >
                        <span className="truncate pr-1.5">{bank}</span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => handleToggleBank(bank, Boolean(checked))}
                          aria-label={`Monitorar ${bank}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- CARD 6: REDEFINIÇÃO DE PADRÕES --- */}
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
