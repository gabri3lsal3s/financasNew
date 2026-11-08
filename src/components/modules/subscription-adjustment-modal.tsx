import { Calendar, History, TrendingUp } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { AuditedSubscription } from "@/domain/subscriptions";

export interface SubscriptionAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: AuditedSubscription | null;
  onSilence?: (serviceKey: string) => void;
}

export function SubscriptionAdjustmentModal({
  open,
  onOpenChange,
  subscription,
  onSilence,
}: SubscriptionAdjustmentModalProps) {
  if (!subscription) return null;

  const handleSilence = () => {
    triggerSensory("action");
    if (onSilence) {
      onSilence(subscription.serviceKey);
    }
    pushToast({
      title: "Alerta silenciado",
      description: `O aviso de reajuste para ${subscription.displayName} foi arquivado.`,
      variant: "default",
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Reajuste em ${subscription.displayName}`}
      description="Auditoria automática de aumentos contratuais e planos recorrentes."
      size="md"
    >
      <div className="flex flex-col gap-4 p-4 text-xs">
        {/* Card Destaque do Impacto */}
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-warning-strong uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              <span>Aumento de Preço Detectado</span>
            </span>
            <Badge variant="warning" size="xs" className="font-bold">
              +{subscription.deltaPercent}%
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-warning/20">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Valor Anterior</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 line-through opacity-70">
                <MoneyText cents={subscription.previousCents} tone="default" />
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Novo Valor Mensal</p>
              <p className="text-base font-bold text-foreground mt-0.5 text-warning-strong">
                <MoneyText cents={subscription.currentCents} tone="default" />
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface/80 p-3 border border-border/70 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-foreground">
              Impacto Anualizado no Orçamento
            </span>
            <p className="text-xs text-muted-foreground">
              Este aumento representa um custo adicional de{" "}
              <strong className="text-foreground font-semibold">
                +<MoneyText cents={subscription.annualizedImpactCents} tone="default" />
              </strong>{" "}
              ao longo de 12 meses caso o serviço seja mantido.
            </p>
          </div>
        </div>

        {/* Histórico das Cobranças */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Histórico Recente de Pagamentos</span>
          </span>

          <div className="rounded-xl border border-border/80 divide-y divide-border/60 overflow-hidden bg-surface">
            {subscription.history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 hover:bg-surface-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground text-[11px]">{formatDateBR(item.date)}</span>
                </div>
                <span className="font-semibold text-foreground">
                  <MoneyText cents={item.amountCents} tone="default" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSilence}
        >
          Silenciar Aviso
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Entendido
        </Button>
      </ModalFooter>
    </Modal>
  );
}
