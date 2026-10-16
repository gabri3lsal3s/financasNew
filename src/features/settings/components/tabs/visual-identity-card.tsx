import {
  Palette,
  Check,
  Moon,
  Sun,
  Smartphone,
  Sliders,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  LivePulseBeacon,
} from "@/components/ui";
import type { ThemePreference } from "@/app/theme-provider";
import type { AccentTheme } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";

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

export interface VisualIdentityCardProps {
  themePref: ThemePreference;
  onSelectTheme: (id: ThemePreference, label: string) => void;
  accent: AccentTheme;
  onSelectAccent: (id: AccentTheme, label: string) => void;
}

export function VisualIdentityCard({
  themePref,
  onSelectTheme,
  accent,
  onSelectAccent,
}: VisualIdentityCardProps) {
  return (
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

        {/* Paleta de Acento / Accent Theme */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="text-xs font-semibold text-foreground">Cor de Destaque (Accent)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
