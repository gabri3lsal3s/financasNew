import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

/**
 * Botão "Instalar app" — aparece no menu "Mais" apenas quando o navegador
 * permite instalação (beforeinstallprompt) e o app não roda em standalone.
 * Nunca popup intrusivo (PWA_GUIDELINES §6 — após interação, no menu/rodapé).
 */
export function InstallAppButton() {
  const { canInstall, install } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
    >
      <Download className="size-4 text-muted-foreground" aria-hidden="true" />
      Instalar app
    </button>
  );
}
