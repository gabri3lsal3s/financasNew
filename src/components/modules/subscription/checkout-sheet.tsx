import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionPlan } from "@/types";

export interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan;
  /** Callback chamado após confirmação de pagamento bem-sucedido. */
  onSuccess: () => void;
}

type CheckoutPaymentMethod = "credit_card" | "pix";

const PLAN_LABELS: Record<SubscriptionPlan, { label: string; price: string; detail: string }> = {
  monthly: {
    label: "Plano Pro Mensal",
    price: "R$\u00a019,90",
    detail: "Cobrado mensalmente. Cancele a qualquer momento.",
  },
  annual: {
    label: "Plano Pro Anual",
    price: "R$\u00a0178,80",
    detail: "R$\u00a014,90/mês. Cobrado anualmente. Economize 25%.",
  },
};

/**
 * Painel de checkout para assinatura do Plano Pro.
 *
 * Exibe alternância entre Cartão de Crédito e PIX Instantâneo.
 * Regras: zero emojis, inputs encapsulados, sem controles nativos (AGENTS.md §7, §8).
 *
 * NOTA: Integração real de pagamento (gateway) é responsabilidade do backend.
 * Este componente gerencia apenas a UI do fluxo — os dados sensíveis de cartão
 * nunca trafegam pelo cliente sem tokenização no SDK do gateway.
 */
export function CheckoutSheet({ open, onOpenChange, plan, onSuccess }: CheckoutSheetProps) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>("credit_card");
  const [isPending, setIsPending] = useState(false);

  const planInfo = PLAN_LABELS[plan];

  const handleConfirm = async () => {
    setIsPending(true);
    // TODO: integrar com SDK do gateway de pagamento (Stripe / Pagar.me / Asaas)
    // Por ora, simula o fluxo de checkout para a UI/UX estar pronta.
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    setIsPending(false);
    triggerSensory("success");
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Pagamento Seguro"
      description="Seus dados são protegidos com criptografia SSL."
      size="md"
    >
      {/* Resumo do plano */}
      <div className="mt-4 rounded-xl border border-border/80 bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{planInfo.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{planInfo.detail}</p>
          </div>
          <span className="shrink-0 font-display text-xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
            {planInfo.price}
          </span>
        </div>
      </div>

      {/* Seletor de método de pagamento */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-foreground mb-2">Forma de Pagamento</p>
        <div className="grid grid-cols-2 gap-2">
          <MethodButton
            active={method === "credit_card"}
            icon={CreditCard}
            label="Cartão de Crédito"
            onClick={() => setMethod("credit_card")}
          />
          <MethodButton
            active={method === "pix"}
            icon={QrCode}
            label="PIX Instantâneo"
            onClick={() => setMethod("pix")}
          />
        </div>
      </div>

      {/* Conteúdo do método selecionado */}
      <div className="mt-4">
        {method === "credit_card" ? (
          <CreditCardForm />
        ) : (
          <PixPanel plan={plan} />
        )}
      </div>

      {/* Selos de segurança */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <SecuritySeal icon={Lock} label="Criptografia SSL" />
        <SecuritySeal icon={ShieldCheck} label="Dados protegidos por RLS" />
        <SecuritySeal icon={CheckCircle2} label="Garantia de 30 dias" />
      </div>

      {/* Rodapé */}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={isPending}
          onClick={() => { void handleConfirm(); }}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Processando...
            </>
          ) : (
            <>
              <ChevronRight className="size-4" aria-hidden="true" />
              Confirmar Assinatura
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

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
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all duration-200",
        active
          ? "border-primary bg-primary/8 text-primary"
          : "border-border/80 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}

function CreditCardForm() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Número do Cartão</label>
        <Input placeholder="0000 0000 0000 0000" autoComplete="cc-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Validade</label>
          <Input placeholder="MM / AA" autoComplete="cc-exp" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">CVV</label>
          <Input placeholder="123" autoComplete="cc-csc" maxLength={4} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Nome no Cartão</label>
        <Input placeholder="Nome como impresso no cartão" autoComplete="cc-name" />
      </div>
    </div>
  );
}

function PixPanel({ plan }: { plan: SubscriptionPlan }) {
  const amount = plan === "annual" ? "R$\u00a0178,80" : "R$\u00a019,90";
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border/80 bg-muted/30 p-5">
      {/* Placeholder do QR Code — substituir por QR real do gateway */}
      <div className="size-36 rounded-xl bg-foreground/8 flex items-center justify-center border border-border/60">
        <QrCode className="size-20 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          PIX de{" "}
          <span className="whitespace-nowrap tabular-nums font-extrabold">{amount}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground leading-snug">
          O QR Code e a chave copia e cola serão gerados ao confirmar. Pagamento
          processado em segundos.
        </p>
      </div>
      <Badge variant="positive" size="sm">
        Expira em 30 minutos
      </Badge>
    </div>
  );
}

interface SecuritySealProps {
  icon: LucideIcon;
  label: string;
}

function SecuritySeal({ icon: Icon, label }: SecuritySealProps) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}
