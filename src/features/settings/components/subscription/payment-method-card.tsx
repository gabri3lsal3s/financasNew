import { CreditCard } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { SubscriptionStatus } from "@/types";

export interface PaymentMethodCardProps {
  subscription: SubscriptionStatus;
  isCancelingPlanChange: boolean;
  onOpenUpdateCard: () => void;
  onCancelScheduledPlanChange: () => void;
}

export function PaymentMethodCard({
  subscription,
  isCancelingPlanChange,
  onOpenUpdateCard,
  onCancelScheduledPlanChange,
}: PaymentMethodCardProps) {
  return (
    <>
      {(subscription.isPro || subscription.hasAutoRenew) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Forma de Pagamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Cartão de Crédito Recorrente
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cobrança processada com segurança pelo gateway Asaas.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenUpdateCard}
              className="gap-2 shrink-0 self-start sm:self-auto"
            >
              <CreditCard className="size-3.5" aria-hidden="true" />
              <span>Alterar Cartão</span>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {subscription.pendingPlanId && subscription.pendingPlanEffectiveAt ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="warning" size="xs">
                  Mudança Agendada
                </Badge>
                <span className="text-xs font-semibold text-foreground">
                  Migração para{" "}
                  {subscription.pendingPlanId === "pro_annual"
                    ? "Plano Pro Anual"
                    : "Plano Pro Mensal"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sua migração está programada para entrar em vigor em{" "}
                <span className="font-semibold text-foreground">
                  {new Date(subscription.pendingPlanEffectiveAt).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </span>
                . Até lá, seu plano atual continuará funcionando normalmente.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancelingPlanChange}
              onClick={onCancelScheduledPlanChange}
              className="shrink-0 self-start sm:self-auto"
            >
              Cancelar Mudança
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
