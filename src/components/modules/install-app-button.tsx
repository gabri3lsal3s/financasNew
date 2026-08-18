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
    <section aria-label="Instalação do aplicativo" className="pt-2">
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Instalar app"
        className="group flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-strong transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Download className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">
              Instalar app
            </div>
            <p className="text-xs text-muted-foreground">
              Adicione à tela inicial para acesso rápido e em tela cheia
            </p>
          </div>
        </div>
      </button>
    </section>
  );
}

