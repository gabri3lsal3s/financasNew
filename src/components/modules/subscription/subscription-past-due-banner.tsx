import { useNavigate } from "react-router";
import { ShieldAlert, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface SubscriptionPastDueBannerProps {
  className?: string;
  onRegularize?: () => void;
}

/**
 * Banner crítico (P0) para falha de cobrança / assinatura `past_due` no carrossel da Home.
 *
 * Regras: Regra 13 (Ícones Nível 2), Regra 19 (altura integral no carrossel),
 * `role="alert"`, sem dispensa ocultável para não silenciar risco de bloqueio de acesso.
 */
export function SubscriptionPastDueBanner({
  className,
  onRegularize,
}: SubscriptionPastDueBannerProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onRegularize) {
      onRegularize();
      return;
    }
    navigate("/configuracoes?tab=subscription");
  };

  return (
    <div
      role="alert"
      aria-label="Pagamento da assinatura pendente"
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-critical/30 bg-critical/5 p-3.5 sm:p-4 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-critical/20 bg-critical/10 text-critical-strong">
          <ShieldAlert className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
              Pagamento da assinatura pendente
            </h2>
            <Badge variant="critical" size="xs">
              Crítico
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
            Regularize a forma de pagamento para manter os recursos Pro ativos sem interrupção.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant="default"
          size="sm"
          sensoryIntent="action"
          onClick={handleAction}
          className="flex-1 sm:flex-initial justify-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Regularizar assinatura
        </Button>
      </div>
    </div>
  );
}
