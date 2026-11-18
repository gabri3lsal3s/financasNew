import { CreditCard, QrCode, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionPlan } from "@/types";
import type { CheckoutPaymentMethod } from "../utils/checkout-validation";

export interface CheckoutPaymentMethodSelectorProps {
  plan: SubscriptionPlan;
  activeMethod: CheckoutPaymentMethod;
  onSelectCreditCard: () => void;
  onSelectPix: () => void;
}

export function CheckoutPaymentMethodSelector({
  plan,
  activeMethod,
  onSelectCreditCard,
  onSelectPix,
}: CheckoutPaymentMethodSelectorProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-foreground block">Método de Pagamento</span>
      {plan === "annual" ? (
        <div className="grid grid-cols-2 gap-2">
          <MethodButton
            active={activeMethod === "credit_card"}
            icon={CreditCard}
            label="Cartão de Crédito"
            onClick={onSelectCreditCard}
          />
          <MethodButton
            active={activeMethod === "pix"}
            icon={QrCode}
            label="PIX Instantâneo"
            onClick={onSelectPix}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CreditCard className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span>Cartão de Crédito (Recorrência Mensal)</span>
          </div>
          <Badge variant="muted" size="xs">
            Automático
          </Badge>
        </div>
      )}
    </div>
  );
}

interface MethodButtonProps {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function MethodButton({ active, icon: Icon, label, onClick }: MethodButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        triggerSensory("selection");
        onClick();
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 min-h-[44px] text-xs font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/10 text-primary-strong shadow-xs"
          : "border-border/80 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
