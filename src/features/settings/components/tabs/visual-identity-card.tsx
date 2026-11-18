import { Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type {
  DarkThemeVariant,
  ThemePreference,
  ThemeScheduleConfig,
} from "@/app/theme-provider";
import type { AccentTheme } from "@/hooks/use-visual-customization";
import { ThemeModeSelector } from "./theme-mode-selector";
import { AccentPaletteSelector } from "./accent-palette-selector";

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
  return (
    <Card data-tour="settings-visual-identity">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Aparência &amp; Identidade Visual</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ThemeModeSelector
          themePref={themePref}
          onSelectTheme={onSelectTheme}
          darkThemeVariant={darkThemeVariant}
          onSelectDarkThemeVariant={onSelectDarkThemeVariant}
          scheduleConfig={scheduleConfig}
          onUpdateScheduleConfig={onUpdateScheduleConfig}
        />
        <AccentPaletteSelector accent={accent} onSelectAccent={onSelectAccent} />
      </CardContent>
    </Card>
  );
}
