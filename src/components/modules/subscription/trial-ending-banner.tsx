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
        "flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-strong">
          <Clock className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-foreground">{titleText}</p>
            <Badge variant="warning" size="xs">
              {daysRemaining === 0 ? "Último dia" : `${daysRemaining}d restantes`}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="size-3.5 shrink-0 text-positive-strong" aria-hidden="true" />
            <span>
              Seus dados, cartões e relatórios ficam 100% seguros e nunca serão excluídos.
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 sm:self-center">
        <Button
          size="sm"
          onClick={handleActivate}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Ativar Plano Pro
        </Button>
      </div>
    </div>
  );
}
