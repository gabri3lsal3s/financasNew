import { Clock, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER: ThemePreference[] = ["light", "dark", "oled", "system", "schedule"];

const LABELS: Record<ThemePreference, string> = {
  light: "Claro",
  dark: "Escuro",
  oled: "OLED",
  system: "Automático (Sistema)",
  schedule: "Programado (Horário)",
};

export function ThemeToggle({ className }: { className?: string } = {}) {
  const { preference, setPreference } = useTheme();
  const index = ORDER.indexOf(preference);
  const next = ORDER[(index + 1) % ORDER.length] ?? "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer", className)}
      aria-label={`Tema atual: ${LABELS[preference]}. Alternar tema.`}
      title={`Tema: ${LABELS[preference]}`}
      onClick={() => setPreference(next)}
    >
      {preference === "light" && <Sun className="size-4" aria-hidden="true" />}
      {preference === "dark" && <Moon className="size-4" aria-hidden="true" />}
      {preference === "oled" && <Smartphone className="size-4" aria-hidden="true" />}
      {preference === "system" && <Monitor className="size-4" aria-hidden="true" />}
      {preference === "schedule" && <Clock className="size-4" aria-hidden="true" />}
    </Button>
  );
}
