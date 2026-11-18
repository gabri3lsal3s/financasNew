import { useNavigate } from "react-router";
import { Download, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shouldOfferAndroidApk } from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";

export interface AndroidProBannerProps {
  onDismiss: () => void;
  className?: string;
}

/**
 * Sugestão contextual para instalação do aplicativo Android Pro em dispositivos Android Web.
 */
export function AndroidProBanner({ onDismiss, className }: AndroidProBannerProps) {
  const navigate = useNavigate();

  if (!shouldOfferAndroidApk()) {
    return null;
  }

  const handleDismiss = () => {
    triggerSensory("action");
    onDismiss();
  };

  return (
    <div
      role="region"
      aria-label="Sugestão do Aplicativo Android Pro"
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 text-primary-strong">
          <Zap className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              Instale o Aplicativo Android Pro
            </h2>
            <Badge variant="default" size="xs">
              App Android Pro
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            Biometria física de hardware, escudo de privacidade e navegação fluida em tela cheia.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          size="sm"
          variant="default"
          onClick={() => navigate("/configuracoes?tab=devices")}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span>Baixar App Pro</span>
        </Button>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 sm:static flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
          aria-label="Dispensar sugestão"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
