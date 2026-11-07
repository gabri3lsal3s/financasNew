import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { useAppMode } from "@/state";

export interface InvestorModeSurplusBannerProps {
  surplusCents: number;
  className?: string;
  onActivate?: () => void;
}

/**
 * Banner de Transição Comportamental ("Subida de Nível") para a Home (§Plano 07).
 *
 * Apresentado dentro do DashboardAlertsCarousel quando o usuário está no Modo Essencial
 * e acumula sobra de caixa no mês vigente, convidando-o amigavelmente a habilitar
 * a carteira de ativos com 1 clique reativo.
 *
 * Em conformidade estrita com as Regras 13 (Ícones Nível 2) e 19 (Carrossel Unificado).
 */
export function InvestorModeSurplusBanner({
  surplusCents,
  className,
  onActivate,
}: InvestorModeSurplusBannerProps) {
  const { setAppMode, isUpdating } = useAppMode();

  if (surplusCents <= 0) return null;

  const handleAction = async () => {
    triggerSensory("action");
    if (onActivate) {
      onActivate();
    } else {
      await setAppMode("investor");
    }
  };

  return (
    <div
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all hover:border-border",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio"
          aria-hidden="true"
        >
          <Sparkles className="size-4.5" />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground break-words truncate">
              Capacidade de Aporte Identificada
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            Você organizou suas contas e tem sobra mensal. Que tal ativar os investimentos?
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-t-0 shrink-0 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <div className="flex flex-col sm:items-end">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Sobra do mês
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
          disabled={isUpdating}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer"
        >
          <span>{isUpdating ? "Ativando..." : "Ativar Modo Investidor"}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
