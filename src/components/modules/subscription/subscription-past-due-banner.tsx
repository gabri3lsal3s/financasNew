import { useNavigate } from "react-router";
import { ShieldAlert, Sparkles } from "lucide-react";
import { AlertCarouselCard } from "../alert-carousel-card";

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
    <AlertCarouselCard
      id="billing.past_due"
      tone="critical"
      role="alert"
      ariaLabel="Pagamento da assinatura pendente"
      className={className}
      icon={<ShieldAlert className="size-4.5" />}
      title="Pagamento da assinatura pendente"
      badge={{ label: "Crítico", variant: "critical" }}
      description="Regularize a forma de pagamento para manter os recursos Pro ativos sem interrupção."
      primaryAction={{
        label: "Regularizar assinatura",
        onClick: handleAction,
        variant: "default",
        icon: <Sparkles className="size-3.5" aria-hidden="true" />,
      }}
    />
  );
}
