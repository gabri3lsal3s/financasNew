import { useNavigate } from "react-router";
import { ArrowUpRight, Calculator, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface SurplusAporteBannerProps {
  surplusCents: number;
  className?: string;
  onSimulate?: () => void;
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

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio mt-0.5"
            aria-hidden="true"
          >
            <Sparkles className="size-4.5" />
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
                Capacidade de Aporte Estimada
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você possui uma sobra líquida calculada no ciclo pronta para rebalancear sua carteira.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t border-border/40 sm:border-t-0">
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
            variant="default"
            size="sm"
            onClick={handleAction}
            className="gap-1.5 text-xs h-9 shrink-0 font-medium"
          >
            <Calculator className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Simular Aporte</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
