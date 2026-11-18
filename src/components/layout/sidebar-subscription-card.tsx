import { AlertTriangle, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

export interface SidebarSubscriptionCardProps {
  subscription: SubscriptionStatus;
  expanded: boolean;
  isPaymentPending: boolean;
  onNavigateBilling: () => void;
  onOpenUpgrade: () => void;
}

export function SidebarSubscriptionCard({
  subscription,
  expanded,
  isPaymentPending,
  onNavigateBilling,
  onOpenUpgrade,
}: SidebarSubscriptionCardProps) {
  return (
    <>
      {isPaymentPending && !subscription.isReadOnly && expanded && (
        <div className="shrink-0 mx-2.5 mb-2 rounded-xl border border-warning/30 bg-warning/10 p-2.5 flex items-center justify-between text-xs animate-fade-slide-in select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-warning/20 border border-warning/30 text-warning-strong">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground text-[11px] truncate">
                Pagamento Pendente
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                Regularize sua assinatura
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            onClick={onNavigateBilling}
            title="Regularizar assinatura nas configurações"
            className="text-[11px] font-medium text-warning-strong hover:text-warning-strong shrink-0 ml-2 px-1.5"
          >
            Regularizar
          </Button>
        </div>
      )}

      {isPaymentPending && !subscription.isReadOnly && !expanded && (
        <div className="shrink-0 flex justify-center mb-2">
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              onNavigateBilling();
            }}
            title="Pagamento Pendente - Clique para regularizar"
            aria-label="Pagamento Pendente"
            className="flex size-9 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning-strong hover:bg-warning/20 transition-colors cursor-pointer"
          >
            <AlertTriangle className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {subscription.isTrial && subscription.trialDaysRemaining !== null && expanded && (
        subscription.hasAutoRenew ? (
          <div className="shrink-0 mx-2.5 mb-2 rounded-xl border border-positive/30 bg-positive/5 p-3 space-y-2 animate-fade-slide-in select-none">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-positive-strong">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Plano Pro Configurado
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Cobrança automática ativa no cartão. Degustação de {subscription.trialDaysRemaining}d restantes.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              onClick={onNavigateBilling}
              className="w-full"
            >
              Gerenciar Assinatura
            </Button>
          </div>
        ) : (
          <div className="shrink-0 mx-2.5 mb-2 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 animate-fade-slide-in select-none">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-primary-strong">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Teste Pro Ativo
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {subscription.trialDaysRemaining}d restantes
              </span>
            </div>
            <Progress
              value={Math.min(100, Math.max(0, ((30 - subscription.trialDaysRemaining) / 30) * 100))}
              tone="auto"
              className="h-1.5"
              aria-label={`Progresso do teste: ${30 - subscription.trialDaysRemaining} de 30 dias`}
            />
            <Button type="button" variant="default" size="sm" onClick={onOpenUpgrade} className="w-full">
              Garantir Plano Pro
            </Button>
          </div>
        )
      )}

      {subscription.isTrial && subscription.trialDaysRemaining !== null && !expanded && (
        <div className="shrink-0 flex justify-center mb-2">
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              if (subscription.hasAutoRenew) {
                onNavigateBilling();
              } else {
                onOpenUpgrade();
              }
            }}
            title={
              subscription.hasAutoRenew
                ? "Plano Pro ativo com cobrança automática"
                : `Teste Pro ativo: restam ${subscription.trialDaysRemaining} dias. Clique para garantir o Pro.`
            }
            aria-label={
              subscription.hasAutoRenew
                ? "Plano Pro ativo com cobrança automática"
                : `Teste Pro ativo: restam ${subscription.trialDaysRemaining} dias`
            }
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border transition-colors cursor-pointer",
              subscription.hasAutoRenew
                ? "border-positive/30 bg-positive/10 text-positive-strong hover:bg-positive/20"
                : "border-primary/25 bg-primary/10 text-primary-strong hover:bg-primary/20",
            )}
          >
            {subscription.hasAutoRenew ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {subscription.isReadOnly && expanded && (
        <div className="shrink-0 mx-2.5 mb-2 rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-2 animate-fade-slide-in select-none">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-warning-strong">
              <BookOpen className="size-3.5" aria-hidden="true" />
              Modo Leitura
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Seus dados estão salvos. Ative o Pro para voltar a lançar.
          </p>
          <Button type="button" variant="default" size="sm" onClick={onOpenUpgrade} className="w-full gap-1.5">
            <Sparkles className="size-3" aria-hidden="true" />
            <span>Reativar Pro</span>
          </Button>
        </div>
      )}

      {subscription.isReadOnly && !expanded && (
        <div className="shrink-0 flex justify-center mb-2">
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              onOpenUpgrade();
            }}
            title="Modo somente-leitura ativo. Clique para reativar o Pro."
            aria-label="Modo somente-leitura ativo"
            className="flex size-9 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning-strong hover:bg-warning/20 transition-colors cursor-pointer"
          >
            <BookOpen className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
