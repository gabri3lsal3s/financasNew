import { useNavigate } from "react-router";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TrialEndingBannerProps {
  daysRemaining: number;
  className?: string;
  onActivatePro?: () => void;
}

/**
 * Banner contextual para o carrossel de alertas da Home (DashboardAlertsCarousel).
 *
 * Exibido nos últimos 5 dias do período de teste Pro (Trial).
 * Informa o prazo restante, reforça que os dados nunca serão apagados e oferece
 * atalho para ativação do Plano Pro.
 *
 * Regras: zero emojis, zero controles nativos, hierarquia de ícones balanceada (AGENTS.md).
 */
export function TrialEndingBanner({
  daysRemaining,
  className,
  onActivatePro,
}: TrialEndingBannerProps) {
  const navigate = useNavigate();

  const handleActivate = () => {
    if (onActivatePro) {
      onActivatePro();
    } else {
      navigate("/assinatura?plano=pro-anual");
    }
  };

  const titleText =
    daysRemaining === 0
      ? "Seu período de teste Pro encerra hoje"
      : daysRemaining === 1
        ? "Seu período de teste Pro encerra amanhã"
        : `Seu período de teste Pro encerra em ${daysRemaining} dias`;

  return (
    <div
      role="region"
      aria-label="Aviso de Término do Teste Pro"
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-3.5 sm:p-4 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 border border-warning/20 text-warning-strong">
          <Clock className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">{titleText}</h2>
            <Badge variant="warning" size="xs">
              {daysRemaining === 0 ? "Último dia" : `${daysRemaining}d restantes`}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground leading-relaxed truncate">
            <ShieldCheck className="size-3.5 shrink-0 text-positive-strong" aria-hidden="true" />
            <span className="truncate">
              Seus dados ficam 100% salvos. Ative o Pro para manter automações e relatórios.
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          size="sm"
          onClick={handleActivate}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Ativar Plano Pro
        </Button>
      </div>
    </div>
  );
}
