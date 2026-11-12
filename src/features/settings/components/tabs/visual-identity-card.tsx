import { useState, useEffect } from "react";
import {
  Palette,
  Check,
  Moon,
  Sun,
  Smartphone,
  Sliders,
  Clock,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  LivePulseBeacon,
  Badge,
  Select,
  type SelectOption,
} from "@/components/ui";
import type {
  ThemePreference,
  DarkThemeVariant,
  ThemeScheduleConfig,
} from "@/app/theme-provider";
import type { AccentTheme } from "@/hooks/use-visual-customization";
import { isDaytime } from "@/domain/theme";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
  { id: "mono", label: "Monocromático (Recomendado para OLED)", bgClass: "bg-foreground", hex: "#000000" },
  { id: "gold", label: "Ouro Âmbar", bgClass: "bg-[#DDA726]", hex: "#DDA726" },
  { id: "sapphire", label: "Safira Petróleo", bgClass: "bg-[#0284C7]", hex: "#0284C7" },
  { id: "violet", label: "Violeta Íris", bgClass: "bg-[#7C3AED]", hex: "#7C3AED" },
  { id: "rose", label: "Coral Rosé", bgClass: "bg-[#E11D48]", hex: "#E11D48" },
];

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun; desc: string }[] = [
  { id: "system", label: "Automático", icon: Sliders, desc: "Sincronizado ao dispositivo" },
  { id: "schedule", label: "Por Horário", icon: Clock, desc: "Dia e noite programados" },
  { id: "light", label: "Claro", icon: Sun, desc: "Vital Petróleo & Ouro" },
  { id: "dark", label: "Escuro", icon: Moon, desc: "Abissal Teal (Padrão)" },
  { id: "oled", label: "OLED", icon: Smartphone, desc: "True Black (Preto Absoluto)" },
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

export interface VisualIdentityCardProps {
  themePref: ThemePreference;
  onSelectTheme: (id: ThemePreference, label: string) => void;
  accent: AccentTheme;
  onSelectAccent: (id: AccentTheme, label: string) => void;
  darkThemeVariant?: DarkThemeVariant;
  onSelectDarkThemeVariant?: (variant: DarkThemeVariant, label: string) => void;
  scheduleConfig?: ThemeScheduleConfig;
  onUpdateScheduleConfig?: (patch: Partial<ThemeScheduleConfig>) => void;
}

export function VisualIdentityCard({
  themePref,
  onSelectTheme,
  accent,
  onSelectAccent,
  darkThemeVariant = "dark",
  onSelectDarkThemeVariant,
  scheduleConfig,
  onUpdateScheduleConfig,
}: VisualIdentityCardProps) {
  const [currentIsDay, setCurrentIsDay] = useState(() => {
    return isDaytime(new Date(), scheduleConfig?.dayStart, scheduleConfig?.nightStart);
  });

  useEffect(() => {
    const update = () => {
      setCurrentIsDay(isDaytime(new Date(), scheduleConfig?.dayStart, scheduleConfig?.nightStart));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [scheduleConfig?.dayStart, scheduleConfig?.nightStart]);

  const effectiveNightTheme = scheduleConfig?.nightTheme ?? darkThemeVariant;

  return (
    <Card data-tour="settings-visual-identity">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {THEME_OPTIONS.map((t) => {
              const Icon = t.icon;
              const isSelected = themePref === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id, t.label)}
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

        {/* Bloco de Preferência de Tema Escuro (para Automático e Programado) */}
        {(themePref === "system" || themePref === "schedule") && onSelectDarkThemeVariant && (
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Tema Escuro Preferido
                </span>
                <Badge size="xs" variant="muted">
                  Modos Escuros
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Escolha qual tema escuro ativar quando o sistema operacional ou o período noturno estiver em modo escuro.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Opção 1: Escuro (Abissal Teal) */}
              <button
                type="button"
                onClick={() => {
                  onSelectDarkThemeVariant("dark", "Escuro (Abissal Teal)");
                  if (onUpdateScheduleConfig) {
                    onUpdateScheduleConfig({ nightTheme: "dark" });
                  }
                }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all select-none cursor-pointer",
                  effectiveNightTheme === "dark"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                    : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                )}
              >
                <div className="p-2 rounded-lg bg-surface border border-border/60 shrink-0">
                  <Moon className="size-4 text-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-xs text-foreground">Escuro (Abissal Teal)</span>
                    {effectiveNightTheme === "dark" && (
                      <Check className="size-3.5 text-primary-strong" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Fundo ardósia atenuado (#0C1923). Padrão recomendado e suave para qualquer tela.
                  </span>
                </div>
              </button>

              {/* Opção 2: OLED (True Black) */}
              <button
                type="button"
                onClick={() => {
                  onSelectDarkThemeVariant("oled", "OLED (Preto Absoluto)");
                  if (onUpdateScheduleConfig) {
                    onUpdateScheduleConfig({ nightTheme: "oled" });
                  }
                }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all select-none cursor-pointer",
                  effectiveNightTheme === "oled"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                    : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                )}
              >
                <div className="p-2 rounded-lg bg-black border border-border/60 shrink-0">
                  <Smartphone className="size-4 text-white" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-xs text-foreground">OLED (True Black)</span>
                    {effectiveNightTheme === "oled" && (
                      <Check className="size-3.5 text-primary-strong" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Preto absoluto (#000000). Alto contraste e máxima economia de bateria em telas OLED.
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Bloco de Configuração de Horários (quando Por Horário está ativo) */}
        {themePref === "schedule" && scheduleConfig && onUpdateScheduleConfig && (
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">
                    Janelas de Horário do Dia
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Defina o início do período diurno (Claro) e noturno ({effectiveNightTheme === "oled" ? "OLED" : "Escuro"}).
                </p>
              </div>
              <Badge
                size="sm"
                variant={currentIsDay ? "positive" : "portfolio"}
                className="self-start sm:self-center shrink-0"
              >
                {currentIsDay ? "Agora: Período Diurno (Claro)" : `Agora: Período Noturno (${effectiveNightTheme === "oled" ? "OLED" : "Escuro"})`}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Início do Período Diurno */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Sun className="size-3.5 text-amber-500" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">
                    Início do Dia (Tema Claro)
                  </span>
                </div>
                <Select
                  value={scheduleConfig.dayStart}
                  onValueChange={(val) => onUpdateScheduleConfig({ dayStart: val })}
                  options={DAY_START_OPTIONS}
                  ariaLabel="Selecione o horário de início do período diurno"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Ativa o tema Claro todos os dias a partir deste horário.
                </span>
              </div>

              {/* Início do Período Noturno */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Moon className="size-3.5 text-indigo-400" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">
                    Início da Noite (Tema {effectiveNightTheme === "oled" ? "OLED" : "Escuro"})
                  </span>
                </div>
                <Select
                  value={scheduleConfig.nightStart}
                  onValueChange={(val) => onUpdateScheduleConfig({ nightStart: val })}
                  options={NIGHT_START_OPTIONS}
                  ariaLabel="Selecione o horário de início do período noturno"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Ativa o tema {effectiveNightTheme === "oled" ? "OLED" : "Escuro"} todos os dias a partir deste horário.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Paleta de Acento / Accent Theme */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="text-xs font-semibold text-foreground">Cor de Destaque (Accent)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {ACCENT_OPTIONS.map((a) => {
              const isSelected = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAccent(a.id, a.label)}
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
      </CardContent>
    </Card>
  );
}
