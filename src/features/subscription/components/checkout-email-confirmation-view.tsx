import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock, CreditCard, Loader2, Mail, MailCheck } from "lucide-react";
import { Button, buttonVariants, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface CheckoutEmailConfirmationViewProps {
  planLabel: string;
  planPriceCents: number;
  email: string;
  isCreditCard: boolean;
  cardLast4?: string;
  returnPath?: string;
  onResendConfirmation?: () => Promise<void>;
}

export function CheckoutEmailConfirmationView({
  planLabel,
  planPriceCents,
  email,
  isCreditCard,
  cardLast4,
  returnPath,
  onResendConfirmation,
}: CheckoutEmailConfirmationViewProps) {
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!onResendConfirmation || cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await onResendConfirmation();
      setCooldown(30);
      triggerSensory("success");
      pushToast({
        title: "Link reenviado",
        description: "Enviamos um novo link de confirmação para o seu e-mail.",
        variant: "default",
      });
    } catch (err: unknown) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível reenviar",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const hasSavedCard = isCreditCard && Boolean(cardLast4);
  const loginQuery = new URLSearchParams();
  if (email) loginQuery.set("email", email);
  if (returnPath) loginQuery.set("redirect", returnPath);
  const loginHref = loginQuery.toString() ? `/entrar?${loginQuery.toString()}` : "/entrar";

  return (
    <div className="rounded-2xl border border-positive/30 bg-surface p-6 sm:p-8 shadow-xs flex flex-col items-center text-center space-y-5 max-w-xl mx-auto animate-fade-slide-in">
      <div className="size-14 rounded-2xl bg-positive/10 border border-positive/20 flex items-center justify-center text-positive-strong">
        <MailCheck className="size-7" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Confirme seu endereço de e-mail
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
          {hasSavedCard ? (
            <>
              Enviamos um link de ativação seguro para validar sua conta. Sua assinatura do{" "}
              <strong className="text-foreground">{planLabel}</strong> já está vinculada ao seu cadastro.
            </>
          ) : (
            <>
              Sua conta foi criada e enviamos um link de ativação seguro. Nenhuma cobrança foi realizada
              ainda — ao confirmar seu e-mail, você voltará automaticamente ao checkout do{" "}
              <strong className="text-foreground">{planLabel}</strong> para concluir o pagamento.
            </>
          )}
        </p>
        <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-muted/40 border border-border/80 text-xs font-semibold text-foreground">
          {email}
        </div>
      </div>

      <div className="w-full rounded-xl bg-surface-raised/60 p-4 text-left space-y-2.5">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-border/80">
          <span className="text-muted-foreground">Plano Selecionado</span>
          <span className="font-semibold text-foreground">
            {planLabel} (<MoneyText cents={planPriceCents} variant="caption" tone="default" />)
          </span>
        </div>
        {hasSavedCard ? (
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border/80">
            <span className="text-muted-foreground">Forma de Pagamento</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Cartão com final **** {cardLast4}</span>
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Status da Conta</span>
          <span className="font-semibold text-warning-strong flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            <span>Aguardando confirmação por e-mail</span>
          </span>
        </div>
      </div>

      <div className="w-full rounded-xl bg-surface-raised/60 p-3 text-left space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground">Dicas importantes:</p>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>Verifique sua caixa de entrada e a pasta de spam ou lixo eletrônico.</li>
          <li>O link de ativação enviado é seguro e válido por 24 horas.</li>
          <li>
            Após confirmar no e-mail, você retornará automaticamente para finalizar a contratação com segurança
            (nenhum dado de cartão foi armazenado).
          </li>
        </ul>
      </div>

      <div className="w-full space-y-2.5">
        {onResendConfirmation ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            disabled={cooldown > 0 || isResending}
            onClick={() => {
              void handleResend();
            }}
            className="w-full gap-1.5"
          >
            {isResending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="size-3.5" aria-hidden="true" />
            )}
            <span>
              {isResending
                ? "Reenviando..."
                : cooldown > 0
                  ? `Aguarde ${cooldown}s para reenviar`
                  : "Reenviar link de confirmação"}
            </span>
          </Button>
        ) : null}

        <Link
          to={loginHref}
          className={cn(buttonVariants({ variant: "solid" }), "w-full gap-1.5")}
        >
          <span>Ir para o login</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
