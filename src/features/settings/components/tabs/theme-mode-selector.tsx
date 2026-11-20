import { useEffect, useState } from "react";
import { Check, Clock, Moon, Sliders, Smartphone, Sun } from "lucide-react";
import { Badge, Select, type SelectOption } from "@/components/ui";
import type {
  DarkThemeVariant,
  ThemePreference,
  ThemeScheduleConfig,
} from "@/app/theme-provider";
import { isDaytime } from "@/domain/theme";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun; desc: string }[] = [
  { id: "system", label: "Automático", icon: Sliders, desc: "Sincronizado ao dispositivo" },
  { id: "schedule", label: "Por Horário", icon: Clock, desc: "Dia e noite programados" },
  { id: "light", label: "Claro", icon: Sun, desc: "Vital Petróleo & Ouro" },
  { id: "dark", label: "Escuro", icon: Moon, desc: "Abissal Teal (Padrão)" },
  { id: "oled", label: "OLED", icon: Smartphone, desc: "True Black (Preto Absoluto)" },
];

const DARK_VARIANT_OPTIONS: {
  id: DarkThemeVariant;
  title: string;
  toastLabel: string;
  desc: string;
  icon: typeof Moon;
}[] = [
  {
    id: "dark",
    title: "Escuro (Abissal Teal)",
    toastLabel: "Escuro (Abissal Teal)",
    desc: "Fundo ardósia atenuado (#0C1923). Padrão recomendado e suave para qualquer tela.",
    icon: Moon,
  },
  {
    id: "oled",
    title: "OLED (True Black)",
    toastLabel: "OLED (Preto Absoluto)",
    desc: "Preto absoluto (#000000). Alto contraste e máxima economia de bateria em telas OLED.",
    icon: Smartphone,
  },
];

const DAY_START_OPTIONS: SelectOption[] = [
  { value: "05:00", label: "05:00 (Madrugada)" },
  { value: "06:00", label: "06:00 (Padrão sugerido)" },
  { value: "07:00", label: "07:00 (Manhã cedo)" },
  { value: "08:00", label: "08:00" },
  { value: "09:00", label: "09:00" },
  { value: "10:00", label: "10:00" },
];

const NIGHT_START_OPTIONS: SelectOption[] = [
  { value: "17:00", label: "17:00 (Fim de tarde)" },
  { value: "18:00", label: "18:00 (Padrão sugerido)" },
  { value: "19:00", label: "19:00" },
  { value: "20:00", label: "20:00 (Início da noite)" },
  { value: "21:00", label: "21:00" },
  { value: "22:00", label: "22:00" },
  { value: "23:00", label: "23:00" },
];

export interface ThemeModeSelectorProps {
  themePref: ThemePreference;
  onSelectTheme: (id: ThemePreference, label: string) => void;
  darkThemeVariant?: DarkThemeVariant;
  onSelectDarkThemeVariant?: (variant: DarkThemeVariant, label: string) => void;
  scheduleConfig?: ThemeScheduleConfig;
  onUpdateScheduleConfig?: (patch: Partial<ThemeScheduleConfig>) => void;
}

export function ThemeModeSelector({
  themePref,
  onSelectTheme,
  darkThemeVariant = "dark",
  onSelectDarkThemeVariant,
  scheduleConfig,
  onUpdateScheduleConfig,
}: ThemeModeSelectorProps) {
  const [currentIsDay, setCurrentIsDay] = useState(() =>
    isDaytime(new Date(), scheduleConfig?.dayStart, scheduleConfig?.nightStart),
  );

  useEffect(() => {
    const update = () => {
      setCurrentIsDay(isDaytime(new Date(), scheduleConfig?.dayStart, scheduleConfig?.nightStart));
    };
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [scheduleConfig?.dayStart, scheduleConfig?.nightStart]);

  const effectiveNightTheme = scheduleConfig?.nightTheme ?? darkThemeVariant;
  const nightLabel = effectiveNightTheme === "oled" ? "OLED" : "Escuro";

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-foreground">Tema da Interface</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {THEME_OPTIONS.map((t) => {
            const Icon = t.icon;
            const isSelected = themePref === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectTheme(t.id, t.label)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-xl border text-left transition-colors duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                    : "border-border/80 bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Icon
                    className={cn("size-4.5", isSelected ? "text-primary-strong" : "text-muted-foreground")}
                    aria-hidden="true"
                  />
                  {isSelected && <Check className="size-3.5 text-primary-strong" aria-hidden="true" />}
                </div>
                <span className="font-semibold text-xs text-foreground">{t.label}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(themePref === "system" || themePref === "schedule") && onSelectDarkThemeVariant && (
        <div className="p-3.5 rounded-xl bg-surface-raised space-y-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">Tema Escuro Preferido</span>
              <Badge size="xs" variant="muted">Modos Escuros</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Escolha qual tema escuro ativar quando o sistema operacional ou o período noturno estiver em modo escuro.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DARK_VARIANT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = effectiveNightTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectDarkThemeVariant(opt.id, opt.toastLabel)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border text-left transition-colors duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isActive
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                      : "border-border/80 bg-surface hover:bg-surface-hover",
                  )}
                >
                  <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <span className="font-semibold text-xs text-foreground">{opt.title}</span>
                      {isActive && <Check className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">{opt.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {themePref === "schedule" && scheduleConfig && onUpdateScheduleConfig && (
        <div className="p-3.5 rounded-xl bg-surface-raised space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">Janelas de Horário do Dia</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Defina o início do período diurno (Claro) e noturno ({nightLabel}).
              </p>
            </div>
            <Badge size="sm" variant="default" className="self-start sm:self-center shrink-0">
              {currentIsDay ? "Agora: Período Diurno (Claro)" : `Agora: Período Noturno (${nightLabel})`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sun className="size-3.5 text-warning-strong" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">Início do Dia (Tema Claro)</span>
              </div>
              <Select
                value={scheduleConfig.dayStart}
                onValueChange={(val) => onUpdateScheduleConfig({ dayStart: val })}
                options={DAY_START_OPTIONS}
                ariaLabel="Selecione o horário de início do período diurno"
              />
              <span className="text-[11px] text-muted-foreground block">Ativa o tema Claro todos os dias a partir deste horário.</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Moon className="size-3.5 text-portfolio-strong" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">Início da Noite (Tema {nightLabel})</span>
              </div>
              <Select
                value={scheduleConfig.nightStart}
                onValueChange={(val) => onUpdateScheduleConfig({ nightStart: val })}
                options={NIGHT_START_OPTIONS}
                ariaLabel="Selecione o horário de início do período noturno"
              />
              <span className="text-[11px] text-muted-foreground block">Ativa o tema {nightLabel} todos os dias a partir deste horário.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
