import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import { Button } from "@/components/ui/button";

const ORDER: ThemePreference[] = ["light", "dark", "oled", "system"];

const LABELS: Record<ThemePreference, string> = {
  light: "Claro",
  dark: "Escuro",
  oled: "OLED",
  system: "Sistema",
};

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const index = ORDER.indexOf(preference);
  const next = ORDER[(index + 1) % ORDER.length] ?? "light";
  const Icon = preference === "light" ? Sun : preference === "system" ? Monitor : Moon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Tema atual: ${LABELS[preference]}. Alternar tema.`}
      title={`Tema: ${LABELS[preference]}`}
      onClick={() => setPreference(next)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
