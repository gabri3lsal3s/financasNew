import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router";
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  CreditCard,
  QrCode,
  ChevronRight,
  Loader2,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useUserSubscription } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

type CheckoutPaymentMethod = "credit_card" | "pix";

const PLAN_LABELS: Record<
  SubscriptionPlan,
  { label: string; price: string; monthly: string; detail: string; badge: string | null }
> = {
  monthly: {
    label: "Plano Pro Mensal",
    price: "R$\u00a019,90",
    monthly: "R$\u00a019,90/mês",
    detail: "Cobrado mensalmente. Cancelamento a qualquer momento em 1 clique.",
    badge: null,
  },
  annual: {
    label: "Plano Pro Anual",
    price: "R$\u00a0178,80",
    monthly: "R$\u00a014,90/mês",
    detail: "Cobrado anualmente. Você economiza R$\u00a060,00 em relação ao mensal.",
    badge: "25% OFF",
  },
};

const BENEFITS = [
  "Lançamentos e escritas ilimitados",
  "Histórico vitalício preservado",
  "Multi-Cartões + Parcelamentos em até 60x",
  "Motor de Rebalanceamento de Aportes",
  "Radar Fiscal IR e DARF",
  "Dossiê Executivo Excel (.xlsx)",
] as const;

/**
 * Página dedicada de checkout de assinatura Pro.
 *
 * Rota pública (requer sessão ativa mas sem shell do app).
 * Acessível via:
 * - Landing Page → "Assinar Plano Pro" → /cadastro?plano=pro-anual → /assinatura?plano=pro-anual
 * - Usuário logado → Settings > Plano → UpgradeDialog → /assinatura?plano=...
 * - Direto via URL /assinatura?plano=pro-mensal|pro-anual
 *
 * Regras: zero emojis, zero controles nativos, moeda whitespace-nowrap (AGENTS.md §7,§8,§11).
 */
export function SubscriptionCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const subscription = useUserSubscription();

  const [method, setMethod] = useState<CheckoutPaymentMethod>("credit_card");
  const [isPending, setIsPending] = useState(false);

  // Resolve o plano da URL: pro-anual (default) ou pro-mensal
  const planoParam = searchParams.get("plano");
  const plan: SubscriptionPlan = planoParam === "pro-mensal" ? "monthly" : "annual";
  const planInfo = PLAN_LABELS[plan];

  // Aguardar autenticação
  if (authLoading) return null;

  // Sem sessão → redirecionar para cadastro preservando o plano
  if (!session) {
    return <Navigate to={`/cadastro?plano=${planoParam ?? "pro-anual"}`} replace />;
  }

  // Já é Pro → redirecionar para o app
  if (subscription.isPro) {
    return <Navigate to="/" replace />;
  }

  const handleConfirm = async () => {
    setIsPending(true);
    // TODO: integrar com SDK do gateway de pagamento (Stripe / Pagar.me / Asaas)
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    setIsPending(false);
    triggerSensory("success");
    pushToast({
      title: "Plano Pro ativado!",
      description: "Bem-vindo ao Guia Financeiro Pro. Aproveite sem limites.",
      variant: "default",
    });
    void navigate("/");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Header mínimo */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandLogo markClassName="size-7" />
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Voltar
          </button>
        </div>
      </header>

      {/* Corpo */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 items-start">

          {/* Coluna esquerda — Resumo do plano + benefícios */}
          <aside className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-5 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Plano Pro
                </span>
                {planInfo.badge && (
                  <Badge variant="positive" size="xs">
                    {planInfo.badge}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {planInfo.label}
              </h1>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
                  {planInfo.monthly}
                </span>
              </div>
              {plan === "annual" && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {planInfo.price} cobrados agora.{" "}
                  <span className="font-semibold text-positive-strong">Economize R$\u00a060,00/ano.</span>
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">{planInfo.detail}</p>
            </div>

            {/* Benefícios */}
            <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                O que você recebe
              </p>
              <ul className="space-y-2.5">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-positive-strong"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Garantia */}
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Garantia incondicional de 30 dias. Se não ficar satisfeito, devolvemos 100% do valor,
                sem perguntas. Cancelamento em 1 clique — nenhum dado é excluído.
              </p>
            </div>
          </aside>

          {/* Coluna direita — Formulário de pagamento */}
          <section className="rounded-2xl border border-border/80 bg-surface shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Forma de Pagamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ambiente seguro com criptografia SSL de ponta.
              </p>
            </div>

            {/* Alternador de método */}
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

            {/* Formulário do método */}
            {method === "credit_card" ? (
              <CreditCardForm />
            ) : (
              <PixPanel plan={plan} />
            )}

            {/* Resumo de cobrança */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{planInfo.label}</span>
                <span className="font-semibold text-foreground whitespace-nowrap tabular-nums">
                  {planInfo.price}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between text-sm font-bold">
                <span>Total hoje</span>
                <span className="whitespace-nowrap tabular-nums text-foreground">{planInfo.price}</span>
              </div>
            </div>

            {/* Selos de segurança */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <SecuritySeal icon={Lock} label="SSL 256-bit" />
              <SecuritySeal icon={ShieldCheck} label="Dados protegidos" />
              <SecuritySeal icon={CheckCircle2} label="Garantia 30 dias" />
            </div>

            {/* CTA */}
            <Button
              type="button"
              className="w-full gap-2 py-6 text-base font-semibold rounded-xl"
              disabled={isPending}
              onClick={() => { void handleConfirm(); }}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  Processando pagamento...
                </>
              ) : (
                <>
                  <ChevronRight className="size-5" aria-hidden="true" />
                  Confirmar Assinatura Pro
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Ao confirmar, você concorda com os Termos de Uso e a Política de Privacidade.
              Cancelamento imediato disponível a qualquer momento.
            </p>
          </section>
        </div>
      </main>
    </div>
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
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Número do Cartão</label>
        <Input placeholder="0000  0000  0000  0000" autoComplete="cc-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Validade</label>
          <Input placeholder="MM / AA" autoComplete="cc-exp" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">CVV</label>
          <Input placeholder="123" autoComplete="cc-csc" maxLength={4} />
        </div>
      </div>
      <div className="space-y-1.5">
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
      <div className="size-32 rounded-xl bg-foreground/8 flex items-center justify-center border border-border/60">
        <QrCode className="size-16 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          PIX de{" "}
          <span className="whitespace-nowrap tabular-nums font-extrabold">{amount}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground leading-snug max-w-xs">
          O QR Code e a chave copia e cola serão gerados ao confirmar. Pagamento
          processado instantaneamente.
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
