import { useNavigate } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

export interface SurplusAporteBannerProps {
  surplusCents: number;
  className?: string;
  onSimulate?: () => void;
  onDismiss?: (days: 7 | 30) => void;
}

/**
 * Banner proativo de Sobra de Caixa -> Aporte Inteligente (§F50).
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
    if (onSimulate) onSimulate();
    else navigate(`/investments?tab=aporte&valor=${surplusCents}`);
  };

  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
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
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
              Capacidade de Aporte Estimada
            </h2>
            <Badge variant="portfolio" size="xs">
              Disponível
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-1 break-words">
            Sobra calculada de{" "}
            <MoneyText cents={surplusCents} tone="portfolio" className="font-semibold text-foreground" />{" "}
            disponível para aporte na carteira.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant="portfolio"
          size="sm"
          onClick={handleAction}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer flex-1 sm:flex-initial justify-center"
        >
          <span>Simular Aporte</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover onDismiss={onDismiss} label="Dispensar aviso de capacidade de aporte" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
