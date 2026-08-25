import {
  Palette,
  Check,
  Moon,
  Sun,
  Smartphone,
  Layers,
  EyeOff,
  Zap,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  LivePulseBeacon,
  Checkbox,
} from "@/components/ui";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import { useDensity, setDensity } from "@/hooks/use-density";
import { usePrivacyMask, togglePrivacyMask } from "@/hooks/use-privacy-mask";
import {
  useVisualCustomization,
  type AccentTheme,
  type SurfaceStyle,
  type MotionLevel,
} from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { useUpdateCustomSettings } from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

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
  { id: "elevated", label: "Elevado 3D", desc: "Sombras em camadas com relevo sutil" },
];

const MOTION_OPTIONS: { id: MotionLevel; label: string; desc: string }[] = [
  { id: "fluid", label: "Cinemática / Fluida", desc: "Física spring, tickers animados e ripple tátil" },
  { id: "eco", label: "Econômica", desc: "Transições suaves em fade com menor consumo" },
  { id: "reduced", label: "Reduzida / A11y", desc: "Movimento mínimo para conforto visual e acessibilidade" },
];

export function AppearanceTab() {
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const density = useDensity();
  const privacyMasked = usePrivacyMask();
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

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

  const handleSelectDensity = (densityVal: "comfortable" | "compact", label: string) => {
    triggerSensory("selection");
    setDensity(densityVal);
    updateCustomSettingsMutation.mutate({ density: densityVal });
    pushToast({
      title: "Preferências salvas",
      description: `Densidade da interface alterada para ${label}.`,
      duration: 2200,
    });
  };

  const handleSelectMotionLevel = (id: MotionLevel, label: string) => {
    triggerSensory("selection");
    visual.setMotionLevel(id);
    updateCustomSettingsMutation.mutate({ motionLevel: id });
    pushToast({
      title: "Preferências salvas",
      description: `Animações alteradas para ${label}.`,
      duration: 2200,
    });
  };

  const handleToggleNumberTicker = (nextChecked: boolean) => {
    triggerSensory("toggle");
    visual.setNumberTickerEnabled(nextChecked);
    updateCustomSettingsMutation.mutate({ numberTickerEnabled: nextChecked });
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? "Contagem numérica animada ativada."
        : "Contagem numérica animada desativada.",
      duration: 2200,
    });
  };

  const handleTogglePrivacy = () => {
    triggerSensory("action");
    togglePrivacyMask();
    const nextMasked = !privacyMasked;
    pushToast({
      title: "Preferências salvas",
      description: nextMasked
        ? "Valores monetários ocultados (modo privacidade)."
        : "Valores monetários visíveis.",
      duration: 2200,
    });
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Temas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Tema Visual</span>
            </span>
            <Badge variant="muted" className="text-xs font-normal">
              4 Modos
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEME_OPTIONS.map((t) => {
              const Icon = t.icon;
              const isSelected = themePref === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTheme(t.id, t.label)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                      : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <Icon className={`size-5 ${isSelected ? "text-primary-strong" : "text-muted-foreground"}`} />
                    {isSelected && <Check className="size-4 text-primary-strong" />}
                  </div>
                  <span className="font-semibold text-sm text-foreground">{t.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Paleta de Acento / Accent Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Cor de Destaque (Accent)</span>
            </span>
            <div className="flex items-center gap-1.5">
              <LivePulseBeacon variant="primary" size="sm" />
              <span className="text-xs text-muted-foreground">Tempo Real</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACCENT_OPTIONS.map((a, idx) => {
              const isSelected = visual.accent === a.id;
              const isLastOdd = idx === ACCENT_OPTIONS.length - 1 && ACCENT_OPTIONS.length % 2 !== 0;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAccent(a.id, a.label)}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all select-none cursor-pointer min-w-0",
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                      : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                    isLastOdd && "col-span-2 sm:col-span-1",
                  )}
                >
                  <span
                    className={`size-6 rounded-full shrink-0 shadow-sm ${a.bgClass} flex items-center justify-center border border-border/60`}
                  >
                    {isSelected && (
                      <Check
                        className={`size-3.5 ${a.id === "mono" ? "text-background" : "text-white"}`}
                      />
                    )}
                  </span>
                  <span className="font-medium text-sm text-foreground leading-tight truncate">
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Estilo de Superfície */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Estilo de Superfícies & Cards</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SURFACE_OPTIONS.map((s) => {
              const isSelected = visual.surfaceStyle === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSurfaceStyle(s.id, s.label)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                      : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-sm text-foreground">{s.label}</span>
                    {isSelected && <Check className="size-4 text-primary-strong" />}
                  </div>
                  <span className="text-xs text-muted-foreground">{s.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Densidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Densidade da Interface</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleSelectDensity("comfortable", "Confortável")}
            className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              density === "comfortable"
                ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-foreground">Confortável (Padrão)</span>
              {density === "comfortable" && <Check className="size-4 text-primary-strong" />}
            </div>
            <span className="text-xs text-muted-foreground">
              Espaçamento relaxado, botões mais amplos e excelente legibilidade.
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectDensity("compact", "Compacta")}
            className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              density === "compact"
                ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-foreground">Compacta</span>
              {density === "compact" && <Check className="size-4 text-primary-strong" />}
            </div>
            <span className="text-xs text-muted-foreground">
              Maior quantidade de informações e lançamentos visíveis por tela.
            </span>
          </button>
        </CardContent>
      </Card>

      {/* Nível de Fluidez & Animações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Nível de Fluidez & Animações</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOTION_OPTIONS.map((m) => {
              const isSelected = visual.motionLevel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMotionLevel(m.id, m.label)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                      : "border-border bg-surface hover:bg-surface-hover"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm text-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                  </div>
                  {isSelected && <Check className="size-4 text-primary-strong shrink-0 ml-3" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Efeitos Individuais</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleNumberTicker(!visual.numberTickerEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleNumberTicker(!visual.numberTickerEnabled);
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              visual.numberTickerEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground">
                Contagem Numérica Animada (Number Ticker)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Anima números e saldos ao carregar ou atualizar valores
              </div>
            </div>
            <Checkbox
              checked={visual.numberTickerEnabled}
              onCheckedChange={(checked) => handleToggleNumberTicker(Boolean(checked))}
              aria-label="Contagem Numérica Animada (Number Ticker)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Modo de Privacidade</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onClick={handleTogglePrivacy}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTogglePrivacy();
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              privacyMasked
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground">
                Ocultar Valores Monetários (Blur)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Ofusca valores de saldos e lançamentos na tela para proteção em público.
              </div>
            </div>
            <Checkbox
              checked={privacyMasked}
              onCheckedChange={handleTogglePrivacy}
              aria-label="Ocultar Valores Monetários (Blur)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
