import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useUserSubscription, USER_SUBSCRIPTION_KEY } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cleanCPF, formatCPF, isValidCPF } from "@/domain/validation";
import { formatCardNumber, formatCardExpiry } from "@/services/masks";
import {
  createCheckoutSession,
  type PixCheckoutResult,
} from "@/data/repositories/billing";
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

export function SubscriptionCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const subscription = useUserSubscription();

  const [method, setMethod] = useState<CheckoutPaymentMethod>("credit_card");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Campos do formulário
  const [cpf, setCpf] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");

  // Estado do PIX gerado
  const [pixResult, setPixResult] = useState<PixCheckoutResult | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Resolve o plano da URL: pro-anual (default) ou pro-mensal
  const planoParam = searchParams.get("plano");
  const plan: SubscriptionPlan = planoParam === "pro-mensal" ? "monthly" : "annual";
  const planInfo = PLAN_LABELS[plan];

  const queryClient = useQueryClient();

  // Polling automático e inteligente quando o PIX estiver gerado e aguardando pagamento
  useEffect(() => {
    if (!pixResult || subscription.isPro) return;

    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 3500);

    return () => clearInterval(intervalId);
  }, [pixResult, subscription.isPro, queryClient]);

  // Celebração sensorial e redirecionamento instantâneo ao detectar ativação do PIX
  useEffect(() => {
    if (pixResult && subscription.isPro) {
      triggerSensory("success");
      pushToast({
        title: "Pagamento PIX confirmado!",
        description: "Seu plano Pro foi ativado com sucesso. Bem-vindo!",
        variant: "default",
      });
      void navigate("/");
    }
  }, [pixResult, subscription.isPro, navigate]);

  // Se estiver no plano mensal, força o método para cartão de crédito
  const activeMethod = plan === "monthly" ? "credit_card" : method;

  // Aguardar autenticação
  if (authLoading) return null;

  // Sem sessão → redirecionar para cadastro preservando o plano
  if (!session) {
    return <Navigate to={`/cadastro?plano=${planoParam ?? "pro-anual"}`} replace />;
  }

  // Já é Pro (e não acabou de ativar via PIX, que já possui efeito dedicado) → redirecionar para o app
  if (subscription.isPro && !pixResult) {
    return <Navigate to="/" replace />;
  }

  const handleCpfChange = (val: string) => {
    setCpf(formatCPF(val));
    if (errorMessage) setErrorMessage(null);
  };

  const handleCardNumberChange = (val: string) => {
    setCardNumber(formatCardNumber(val));
    if (errorMessage) setErrorMessage(null);
  };

  const handleCardExpiryChange = (val: string) => {
    setCardExpiry(formatCardExpiry(val));
    if (errorMessage) setErrorMessage(null);
  };

  const handleCardCcvChange = (val: string) => {
    setCardCcv(val.replace(/\D/g, "").slice(0, 4));
    if (errorMessage) setErrorMessage(null);
  };

  const handleCopyPix = async () => {
    if (!pixResult) return;
    try {
      await navigator.clipboard.writeText(pixResult.copyPasteKey);
      setCopiedPix(true);
      triggerSensory("selection");
      pushToast({
        title: "Chave Copia e Cola copiada",
        description: "Cole no aplicativo do seu banco para concluir o pagamento.",
        variant: "default",
      });
      setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      pushToast({
        title: "Erro ao copiar",
        description: "Selecione o código manualmente para copiar.",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async () => {
    setErrorMessage(null);

    // Validação de CPF
    if (!cpf || !isValidCPF(cpf)) {
      setErrorMessage("Informe um CPF válido para emissão do pagamento.");
      return;
    }

    if (activeMethod === "credit_card") {
      if (!holderName.trim()) {
        setErrorMessage("Informe o nome do titular como impresso no cartão.");
        return;
      }
      const rawNumber = cardNumber.replace(/\D/g, "");
      if (rawNumber.length < 13 || rawNumber.length > 19) {
        setErrorMessage("Número do cartão de crédito inválido.");
        return;
      }
      const [expMonth, expYear] = cardExpiry.split("/");
      if (!expMonth || !expYear || parseInt(expMonth, 10) < 1 || parseInt(expMonth, 10) > 12) {
        setErrorMessage("Validade do cartão inválida (formato MM/AA).");
        return;
      }
      if (cardCcv.length < 3) {
        setErrorMessage("Código de segurança (CVV) inválido.");
        return;
      }

      setIsPending(true);
      try {
        await createCheckoutSession({
          plan,
          method: "credit_card",
          cpf: cleanCPF(cpf),
          card: {
            holderName: holderName.trim().toUpperCase(),
            number: rawNumber,
            expiryMonth: expMonth.padStart(2, "0"),
            expiryYear: expYear,
            ccv: cardCcv,
          },
        });

        triggerSensory("success");
        pushToast({
          title: "Plano Pro ativado com sucesso!",
          description: "Bem-vindo ao Guia Financeiro Pro. Aproveite todos os recursos.",
          variant: "default",
        });
        void navigate("/");
      } catch (err: unknown) {
        triggerSensory("destructive");
        const msg = err instanceof Error ? err.message : "Falha ao processar pagamento.";
        setErrorMessage(msg);
      } finally {
        setIsPending(false);
      }
    } else {
      // PIX (apenas Anual)
      setIsPending(true);
      try {
        const res = await createCheckoutSession({
          plan: "annual",
          method: "pix",
          cpf: cleanCPF(cpf),
        });

        if (res.method === "pix") {
          setPixResult(res);
          triggerSensory("success");
          pushToast({
            title: "QR Code PIX gerado!",
            description: "Pague pelo app do seu banco para ativar sua conta instantaneamente.",
            variant: "default",
          });
        }
      } catch (err: unknown) {
        triggerSensory("destructive");
        const msg = err instanceof Error ? err.message : "Falha ao gerar cobrança PIX.";
        setErrorMessage(msg);
      } finally {
        setIsPending(false);
      }
    }
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
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
            <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-3 shadow-xs">
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
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3 border border-border/60">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Garantia incondicional de 30 dias. Cancelamento a qualquer momento em 1 clique —
                nenhum dado financeiro ou histórico é excluído.
              </p>
            </div>
          </aside>

          {/* Coluna direita — Formulário de pagamento */}
          <section className="rounded-2xl border border-border/80 bg-surface shadow-xs p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Forma de Pagamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ambiente seguro com criptografia e processamento direto via Asaas.
              </p>
            </div>

            {/* Alternador de método */}
            {plan === "annual" ? (
              <div className="grid grid-cols-2 gap-2">
                <MethodButton
                  active={activeMethod === "credit_card"}
                  icon={CreditCard}
                  label="Cartão de Crédito"
                  onClick={() => {
                    setMethod("credit_card");
                    setPixResult(null);
                    setErrorMessage(null);
                  }}
                />
                <MethodButton
                  active={activeMethod === "pix"}
                  icon={QrCode}
                  label="PIX Instantâneo"
                  onClick={() => {
                    setMethod("pix");
                    setErrorMessage(null);
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <CreditCard className="size-4 text-primary" aria-hidden="true" />
                  <span>Cartão de Crédito (Recorrência Mensal)</span>
                </div>
                <Badge variant="muted" size="xs">
                  Automático
                </Badge>
              </div>
            )}

            {/* Alerta de erro se houver */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive-strong"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Campo de CPF universal obrigatório */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                CPF do Titular <span className="text-muted-foreground font-normal">(exigido pelo Banco Central)</span>
              </label>
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                maxLength={14}
                autoComplete="off"
              />
            </div>

            {/* Formulário do método ativo */}
            {activeMethod === "credit_card" ? (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Nome no Cartão</label>
                  <Input
                    placeholder="Nome como impresso no cartão"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    autoComplete="cc-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Número do Cartão</label>
                  <Input
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    autoComplete="cc-number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Validade</label>
                    <Input
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => handleCardExpiryChange(e.target.value)}
                      maxLength={5}
                      autoComplete="cc-exp"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">CVV</label>
                    <Input
                      placeholder="123"
                      value={cardCcv}
                      onChange={(e) => handleCardCcvChange(e.target.value)}
                      maxLength={4}
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>
              </div>
            ) : pixResult ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border/80 bg-muted/30 p-5">
                <div className="rounded-xl bg-surface p-2 border border-border shadow-xs">
                  <img
                    src={`data:image/png;base64,${pixResult.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="size-44 object-contain rounded-lg"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    PIX de <span className="tabular-nums font-extrabold">{planInfo.price}</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug max-w-xs">
                    Escaneie o QR Code no app do seu banco ou copie a chave abaixo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void handleCopyPix(); }}
                  className="w-full gap-2 text-xs font-medium"
                >
                  {copiedPix ? (
                    <>
                      <Check className="size-4 text-positive-strong" aria-hidden="true" />
                      Chave PIX Copiada!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      Copiar Código PIX
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground text-center">
                  <ClockIcon className="size-3.5 shrink-0" />
                  <span>Aguardando pagamento... A ativação é automática.</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border/80 bg-muted/20 p-5 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <QrCode className="size-8" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    PIX Anual com 25% OFF
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                    Ao confirmar, geramos o QR Code dinâmico oficial do Banco Central.
                    A liberação é instantânea após o pagamento.
                  </p>
                </div>
                <Badge variant="positive" size="sm">
                  R$\u00a0178,80 à vista
                </Badge>
              </div>
            )}

            {/* Resumo de cobrança */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{planInfo.label}</span>
                <span className="font-semibold text-foreground whitespace-nowrap tabular-nums">
                  {planInfo.price}
                </span>
              </div>
              <div className="border-t border-border/80 pt-2 flex justify-between text-sm font-bold">
                <span>Total a pagar</span>
                <span className="whitespace-nowrap tabular-nums text-foreground">{planInfo.price}</span>
              </div>
            </div>

            {/* Selos de segurança */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <SecuritySeal icon={Lock} label="SSL 256-bit" />
              <SecuritySeal icon={ShieldCheck} label="Dados protegidos" />
              <SecuritySeal icon={CheckCircle2} label="Garantia 30 dias" />
            </div>

            {/* CTA — Oculto se o PIX já foi gerado (pois o usuário já tem o QR code) */}
            {(!pixResult || activeMethod === "credit_card") && (
              <Button
                type="button"
                className="w-full gap-2 py-6 text-base font-semibold rounded-xl cursor-pointer"
                disabled={isPending}
                onClick={() => { void handleConfirm(); }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    Processando com Asaas...
                  </>
                ) : activeMethod === "pix" ? (
                  <>
                    <QrCode className="size-5" aria-hidden="true" />
                    Gerar QR Code PIX
                  </>
                ) : (
                  <>
                    <ChevronRight className="size-5" aria-hidden="true" />
                    Confirmar Assinatura Pro
                  </>
                )}
              </Button>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Ao confirmar, você concorda com os Termos de Uso e a Política de Privacidade.
              Cancelamento a qualquer momento em 1 clique sem burocracia.
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
        "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all duration-200 cursor-pointer",
        active
          ? "border-primary bg-primary/8 text-primary shadow-2xs"
          : "border-border/80 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
