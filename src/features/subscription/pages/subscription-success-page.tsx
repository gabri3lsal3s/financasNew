import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Button, buttonVariants, MoneyText } from "@/components/ui";
import { addCivilMonths, PLAN_CONFIGS, resolvePlanFromQuery } from "@/domain/subscription";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionPlan } from "@/types";
import { CheckoutHeader } from "../components/checkout-header";
import { SuccessReceiptCard } from "../components/success-receipt-card";

export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");
  const faseParam = searchParams.get("fase");
  const primeiraCobrancaParam = searchParams.get("primeira_cobranca");

  const isTrialScheduled = faseParam === "trial_scheduled";
  const isPlanChangeScheduled = faseParam === "plan_change_scheduled";
  const isDeferredCharge = isTrialScheduled || isPlanChangeScheduled;
  const plan: SubscriptionPlan = resolvePlanFromQuery(planoParam);
  const planConfig = PLAN_CONFIGS[plan];
  const isAnnual = plan === "annual";
  const isPix = metodoParam === "pix";

  const scheduledChargeFormatted = primeiraCobrancaParam
    ? new Date(primeiraCobrancaParam).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const nextRenewalDate = addCivilMonths(new Date(), isAnnual ? 12 : 1);
  const formattedRenewal =
    isDeferredCharge && scheduledChargeFormatted
      ? scheduledChargeFormatted
      : nextRenewalDate.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  useEffect(() => {
    triggerSensory("success");
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <CheckoutHeader
        rightAction={
          <Link
            to="/configuracoes?tab=subscription"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-xs text-muted-foreground hover:text-foreground",
            )}
          >
            Minha Conta
          </Link>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-14 pb-[calc(2.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] flex flex-col items-center animate-route-in">
        <div className="w-full max-w-2xl text-center space-y-4">
          <div className="inline-flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-positive/10 border border-positive/20 text-positive-strong shadow-xs">
            <CheckCircle2 className="size-6 sm:size-7" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary-strong">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>
                {isPlanChangeScheduled
                  ? "Mudança de Plano Agendada"
                  : isTrialScheduled
                    ? "Período de Teste Ativo"
                    : "Assinatura Ativa"}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              {isPlanChangeScheduled
                ? "Mudança Agendada com Sucesso!"
                : isTrialScheduled
                  ? "Cartão Cadastrado com Sucesso!"
                  : "Pagamento Confirmado!"}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {isDeferredCharge ? (
                <>
                  {isPlanChangeScheduled
                    ? "Seu período atual continua ativo normalmente. Nenhuma cobrança foi realizada hoje. Sua primeira cobrança de "
                    : "Seu período de teste de 30 dias está ativo. Nenhuma cobrança foi realizada hoje. Sua primeira cobrança de "}
                  <strong className="text-foreground">
                    <MoneyText cents={planConfig.priceCents} variant="value" tone="default" deemphasizeCents={false} />
                    /{isAnnual ? "ano" : "mês"}
                  </strong>{" "}
                  ocorrerá apenas em{" "}
                  <strong className="text-foreground">{scheduledChargeFormatted || "30 dias"}</strong>.
                </>
              ) : (
                <>
                  Sua conta foi promovida com sucesso ao{" "}
                  <strong className="text-foreground">{planConfig.title}</strong>. Todos os recursos avançados de engenharia financeira já estão liberados.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 w-full max-w-3xl">
          <SuccessReceiptCard
            planTitle={planConfig.title}
            priceCents={planConfig.priceCents}
            isAnnual={isAnnual}
            isPix={isPix}
            isTrialScheduled={isDeferredCharge}
            todayFormatted={today}
            renewalFormatted={formattedRenewal}
          />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <Button
            type="button"
            variant="solid"
            size="lg"
            onClick={() => void navigate("/")}
            className="w-full font-semibold shadow-sm gap-2"
          >
            <span>Acessar Painel Financeiro</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void navigate("/configuracoes?tab=subscription")}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Ver Assinatura
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          <span>Comprovante registrado e criptografado com segurança</span>
        </div>
      </main>
    </div>
  );
}
