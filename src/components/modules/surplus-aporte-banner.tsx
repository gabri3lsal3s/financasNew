import { useNavigate } from "react-router";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface SurplusAporteBannerProps {
  surplusCents: number;
  className?: string;
  onSimulate?: () => void;
  onDismiss?: () => void;
}

/**
 * Banner proativo de Sobra de Caixa → Aporte Inteligente (§F50).
 *
 * Conecta o resultado positivo do fluxo mensal à Calculadora de Rebalanceamento
 * com injeção automática do valor disponível em 1 clique.
 */
export function SurplusAporteBanner({
  surplusCents,
  className,
  onSimulate,
  onDismiss,
}: SurplusAporteBannerProps) {
  const navigate = useNavigate();

  if (surplusCents <= 0) return null;

  const handleAction = () => {
    if (onSimulate) {
      onSimulate();
    } else {
      navigate(`/carteira?tab=aporte&valor=${surplusCents}`);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerSensory("action");
    onDismiss?.();
  };

  return (
      <div
        className={cn(
          "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all hover:border-border",
          className,
        )}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio"
            aria-hidden="true"
          >
            <Sparkles className="size-4.5" />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground break-words truncate">
                Capacidade de Aporte Estimada
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed truncate">
              Sobra de caixa calculada disponível para aporte na carteira.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-t-0 shrink-0 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
          <div className="flex flex-col sm:items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Disponível
            </span>
            <MoneyText
              cents={surplusCents}
              tone="portfolio"
              animated
              className="text-base sm:text-lg font-bold tracking-tight"
            />
          </div>

          <Button
            type="button"
            variant="portfolio"
            size="sm"
            onClick={handleAction}
            className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer"
          >
            <span>Simular Aporte</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>

          {onDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3 right-3 sm:static flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0"
              aria-label="Dispensar aviso de capacidade de aporte"
              title="Dispensar aviso"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
  );
}
