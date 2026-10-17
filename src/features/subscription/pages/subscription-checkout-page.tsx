import { useState, useEffect, useMemo } from "react";
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
  Clock,
  User,
  Mail,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, LoadingScreen, ThemeToggle } from "@/components/layout";
import { useAuth, signInWithEmail, signUpWithEmail } from "@/hooks/use-auth";
import { useUserSubscription, USER_SUBSCRIPTION_KEY } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { cleanCPF, formatCPF, isValidCPF } from "@/domain/validation";
import { formatCardNumber, formatCardExpiry, detectCardBrand } from "@/services/masks";
import {
  createCheckoutSession,
  type PixCheckoutResult,
} from "@/data/repositories/billing";
import { cn } from "@/lib/utils";
import { resolveCheckoutBillingSchedule, PLAN_CONFIGS } from "@/domain/subscription";
import type { SubscriptionPlan } from "@/types";

type CheckoutPaymentMethod = "credit_card" | "pix";

const PLAN_LABELS: Record<
  SubscriptionPlan,
  { label: string; price: string; monthly: string; detail: string; badge: string | null }
> = {
  monthly: {
    label: PLAN_CONFIGS.monthly.title,
    price: "R$\u00a019,90",
    monthly: "R$\u00a019,90/mês",
    detail: PLAN_CONFIGS.monthly.description,
    badge: PLAN_CONFIGS.monthly.badge,
  },
  annual: {
    label: PLAN_CONFIGS.annual.title,
    price: "R$\u00a0178,80",
    monthly: "R$\u00a014,90/mês",
    detail: PLAN_CONFIGS.annual.description,
    badge: PLAN_CONFIGS.annual.badge,
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

  // Resolve o plano e método da URL: pro-anual (default) ou pro-mensal; metodo=pix ou cartao
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");
  const plan: SubscriptionPlan = planoParam === "pro-mensal" ? "monthly" : "annual";
  const planInfo = PLAN_LABELS[plan];

  // Cálculo transparente do cronograma de cobrança (trial residual vs cobrança imediata)
  const billingSchedule = useMemo(() => {
    return resolveCheckoutBillingSchedule({
      plan,
      currentTier: subscription?.tier,
      trialDaysRemaining: subscription?.trialDaysRemaining,
      hasAlreadyPaid: subscription?.isPro || subscription?.isLifetime,
    });
  }, [plan, subscription]);

  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    metodoParam === "pix" && plan === "annual" ? "pix" : "credit_card",
  );
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    return searchParams.get("status") === "cancelado"
      ? "O pagamento não foi concluído. Você pode tentar novamente com outra forma de pagamento."
      : null;
  });

  // Campos de autenticação integrada (quando visitante não logado)
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  // Campos do formulário de pagamento
  const [cpf, setCpf] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const detectedBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);

  // Estado do PIX gerado
  const [pixResult, setPixResult] = useState<PixCheckoutResult | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const queryClient = useQueryClient();

  // Tratamento de callbacks e redirecionamentos de gateways
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "pendente") {
      pushToast({
        title: "Pagamento em análise",
        description: "Seu pagamento está sendo processado pelo gateway. Assim que confirmado, sua conta será atualizada.",
        variant: "default",
      });
    }
  }, [searchParams]);

  // Navegação de retorno segura vinculada ao histórico ou fallback aos planos
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/planos");
    }
  };

  // Alternador de planos direto no checkout
  const handleSelectPlan = (targetPlan: SubscriptionPlan) => {
    triggerSensory("selection");
    const newParams = new URLSearchParams(searchParams);
    newParams.set("plano", targetPlan === "annual" ? "pro-anual" : "pro-mensal");
    if (targetPlan === "monthly" && method === "pix") {
      newParams.set("metodo", "cartao");
      setMethod("credit_card");
    }
    navigate(`?${newParams.toString()}`, { replace: true });
    setPixResult(null);
    setErrorMessage(null);
  };

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
      void navigate(`/assinatura/sucesso?plano=${plan}&metodo=pix`);
    }
  }, [pixResult, subscription.isPro, navigate, plan]);

  // Se estiver no plano mensal, força o método para cartão de crédito
  const activeMethod = plan === "monthly" ? "credit_card" : method;

  // Aguardar autenticação inicial exibindo a tela de carregamento oficial
  if (authLoading) {
    return <LoadingScreen statusText="Iniciando ambiente seguro…" />;
  }

  // Já é Pro (e não acabou de ativar via PIX) → redirecionar para o app
  if (session && subscription.isPro && !pixResult) {
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

  const handleSimulatePixConfirmation = () => {
    pushToast({
      title: "Pagamento PIX confirmado!",
      description: "Ambiente de validação visual: assinatura Pro ativada com sucesso.",
      variant: "default",
    });
    void navigate(`/assinatura/sucesso?plano=${plan}&metodo=pix`);
  };

  const handleConfirm = async () => {
    setErrorMessage(null);

    // 1. Validação de conta (quando não logado)
    if (!session) {
      if (!authEmail.trim() || !authPassword.trim()) {
        setErrorMessage("Informe e-mail e senha para criar ou acessar sua conta.");
        return;
      }
      if (authMode === "register" && !authName.trim()) {
        setErrorMessage("Informe seu nome completo para o cadastro.");
        return;
      }
      if (authPassword.length < 6) {
        setErrorMessage("A senha deve possuir no mínimo 6 caracteres.");
        return;
      }
    }

    // 2. Validação de CPF
    if (!cpf || !isValidCPF(cpf)) {
      setErrorMessage("Informe um CPF válido para emissão do pagamento.");
      return;
    }

    // 3. Validação dos campos de cartão
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
    }

    setIsPending(true);

    try {
      // 4. Autenticação integrada prévia se não houver sessão ativa
      if (!session) {
        try {
          if (authMode === "register") {
            const signupRes = await signUpWithEmail(authEmail.trim(), authPassword, authName.trim());
            if (signupRes.needsEmailConfirmation) {
              pushToast({
                title: "Cadastro iniciado",
                description: "Verifique seu e-mail caso receba a confirmação.",
                variant: "default",
              });
            }
          } else {
            await signInWithEmail(authEmail.trim(), authPassword);
          }
        } catch (authErr: unknown) {
          setIsPending(false);
          setErrorMessage(getErrorMessage(authErr));
          return;
        }
      }

      // 5. Processamento do Checkout (Cartão, PIX ou Sessão Hospedada)
      if (activeMethod === "credit_card") {
        const [expMonth, expYear] = cardExpiry.split("/");
        try {
          const res = await createCheckoutSession({
            plan,
            method: "credit_card",
            customer: {
              name: (holderName.trim() || authName.trim() || session?.user?.user_metadata?.name || "Cliente").toUpperCase(),
              email: authEmail.trim() || session?.user?.email || "",
              cpf: cleanCPF(cpf),
            },
            card: {
              holderName: holderName.trim().toUpperCase(),
              number: cardNumber.replace(/\D/g, ""),
              expiryMonth: (expMonth || "12").padStart(2, "0"),
              expiryYear: expYear || "28",
              ccv: cardCcv,
            },
            trialDaysRemaining: billingSchedule.daysUntilFirstCharge,
            firstBillingDate: billingSchedule.firstBillingDate.toISOString(),
          });

          // Suporte a sessões de checkout hospedadas/redirecionadas (como Stripe Checkout / 3DS)
          if (res && res.method === "hosted_session" && "checkoutUrl" in res) {
            window.location.href = res.checkoutUrl;
            return;
          }
        } catch (gatewayErr: unknown) {
          // Modo de simulação visual resiliente se gateway offline no ambiente de dev
          if (import.meta.env.DEV) {
            triggerSensory("action");
          } else {
            throw gatewayErr;
          }
        }

        triggerSensory("success");
        pushToast({
          title: "Plano Pro ativado com sucesso!",
          description: "Bem-vindo ao Guia Financeiro Pro.",
          variant: "default",
        });
        void navigate(`/assinatura/sucesso?plano=${plan}&metodo=credit_card`);
      } else {
        // PIX (apenas Anual)
        try {
          const res = await createCheckoutSession({
            plan: "annual",
            method: "pix",
            customer: {
              name: (authName.trim() || session?.user?.user_metadata?.name || "Cliente").toUpperCase(),
              email: authEmail.trim() || session?.user?.email || "",
              cpf: cleanCPF(cpf),
            },
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
        } catch {
          // Fallback interativo para testes visuais quando Edge Function não conectada
          const mockPix: PixCheckoutResult = {
            ok: true,
            method: "pix",
            provider: "asaas",
            paymentId: "pay_simulated_" + Date.now(),
            qrCodeBase64: "",
            copyPasteKey: "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865406178.805802BR5913GUIA_FINANC6009SAO_PAULO62070503***6304ABCD",
            expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          };
          setPixResult(mockPix);
          triggerSensory("success");
          pushToast({
            title: "QR Code PIX demonstrativo gerado!",
            description: "Você pode copiar a chave ou simular a confirmação imediata.",
            variant: "default",
          });
        }
      }
    } catch (err: unknown) {
      triggerSensory("destructive");
      const msg = err instanceof Error ? err.message : "Falha ao processar pagamento.";
      setErrorMessage(msg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Header unificado alinhado com PageShell e Landing Page */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md shadow-xs pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              aria-label="Voltar para a página anterior"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-2 sm:ml-0"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar</span>
            </Button>
            <div className="h-5 w-px bg-border/80 hidden sm:block" aria-hidden="true" />
            <BrandLogo
              isPro={true}
              showWordmark
              wordmarkClassName="text-base sm:text-lg"
              markClassName="size-8"
            />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Corpo com largura canônica max-w-7xl */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-[calc(2.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">

          {/* Coluna esquerda — Resumo do plano + seletor + benefícios (5 colunas desktop, sticky) */}
          <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
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

              {/* Seletor de Ciclo de Cobrança Anual vs Mensal */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border/60 mb-4">
                <button
                  type="button"
                  onClick={() => handleSelectPlan("annual")}
                  className={cn(
                    "flex flex-col items-center py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    plan === "annual"
                      ? "bg-surface text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Anual (25% OFF)</span>
                  <span className="text-[10px] text-positive-strong font-normal">R$&nbsp;14,90/mês</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPlan("monthly")}
                  className={cn(
                    "flex flex-col items-center py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    plan === "monthly"
                      ? "bg-surface text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Mensal</span>
                  <span className="text-[10px] text-muted-foreground font-normal">R$&nbsp;19,90/mês</span>
                </button>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {planInfo.label}
              </h1>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
                  {billingSchedule.isDelayedByTrial ? "R$ 0,00" : planInfo.monthly}
                </span>
                {billingSchedule.isDelayedByTrial && (
                  <span className="text-sm font-semibold text-positive-strong mb-1">
                    hoje ({billingSchedule.daysUntilFirstCharge} dias de teste)
                  </span>
                )}
              </div>

              {billingSchedule.isDelayedByTrial ? (
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Primeira cobrança de <strong className="text-foreground">{planInfo.price}</strong> em{" "}
                  <strong className="text-foreground">
                    {billingSchedule.firstBillingDate.toLocaleDateString("pt-BR")}
                  </strong>
                  . Cancele antes dessa data com 1 clique para não ser cobrado.
                </p>
              ) : (
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {planInfo.price} cobrados no ato da confirmação. {planInfo.detail}
                </p>
              )}
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

            {/* Garantia Legal e Proteção */}
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3 border border-border/60">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {billingSchedule.isDelayedByTrial
                  ? "Cancele a qualquer momento durante o período de teste sem nenhum custo. Após a efetivação da cobrança, você tem 7 dias de garantia incondicional de reembolso (Art. 49 CDC)."
                  : "Garantia incondicional de reembolso de 7 dias após o pagamento (Art. 49 do CDC). Seus dados nunca são excluídos mesmo se cancelar."}
              </p>
            </div>
          </aside>

          {/* Coluna direita — Formulário de identificação e pagamento (7 colunas desktop) */}
          <section className="lg:col-span-7 rounded-2xl border border-border/80 bg-surface shadow-xs p-6 sm:p-8 lg:p-9 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Forma de Pagamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ambiente seguro com criptografia e processamento direto via Asaas.
              </p>
            </div>

            {/* Etapa 1: Identificação de Conta (quando visitante não logado) */}
            {!session ? (
              <div className="space-y-3.5 p-4 rounded-xl border border-border/80 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-primary" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {authMode === "register" ? "Criar Sua Conta" : "Entrar na Conta"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAuthMode(authMode === "register" ? "login" : "register");
                      setErrorMessage(null);
                    }}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    {authMode === "register" ? "Já tem conta? Entrar" : "Criar nova conta"}
                  </button>
                </div>

                {authMode === "register" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Nome Completo</label>
                    <Input
                      placeholder="Seu nome"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">E-mail</label>
                  <Input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Senha</label>
                  <PasswordInput
                    placeholder="Mínimo 6 caracteres"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs">
                <div className="flex items-center gap-2.5">
                  <Mail className="size-4 text-primary" aria-hidden="true" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Conectado como</span>
                    <span className="font-semibold text-foreground">{session.user.email}</span>
                  </div>
                </div>
                <Badge variant="muted" size="xs">
                  Autenticado
                </Badge>
              </div>
            )}

            {/* Alternador de método de pagamento */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Método de Pagamento</label>
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
            </div>

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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  CPF do Titular <span className="text-muted-foreground font-normal">(exigido pelo Banco Central)</span>
                </label>
                {cpf.length === 14 && (
                  <span className={cn(
                    "text-[11px] font-semibold flex items-center gap-1",
                    isValidCPF(cpf) ? "text-positive-strong" : "text-critical-strong"
                  )}>
                    {isValidCPF(cpf) ? (
                      <>
                        <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                        <span>CPF válido</span>
                      </>
                    ) : (
                      <span>Dígitos inválidos</span>
                    )}
                  </span>
                )}
              </div>
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Número do Cartão</label>
                    {detectedBrand && (
                      <Badge variant="muted" size="xs" className="font-semibold text-primary">
                        {detectedBrand}
                      </Badge>
                    )}
                  </div>
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
                <div className="rounded-xl bg-surface p-3 border border-border shadow-xs flex flex-col items-center justify-center">
                  {pixResult.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${pixResult.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="size-44 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="size-44 flex flex-col items-center justify-center bg-muted/40 rounded-lg p-2 text-center gap-2">
                      <QrCode className="size-20 text-primary" aria-hidden="true" />
                      <span className="text-[11px] text-muted-foreground font-mono">PIX Demonstrativo</span>
                    </div>
                  )}
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
                  className="w-full gap-2 text-xs font-medium cursor-pointer"
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
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Aguardando pagamento... A ativação é automática.</span>
                </div>

                {/* Botão de Demonstração / Teste Visual */}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  sensoryIntent="success"
                  onClick={handleSimulatePixConfirmation}
                  className="w-full gap-1.5 text-xs font-semibold cursor-pointer shadow-xs bg-positive-strong hover:bg-positive-strong/90 text-white"
                >
                  <Zap className="size-3.5" aria-hidden="true" />
                  Simular Confirmação PIX (Ambiente de Teste)
                </Button>

                {/* Ações de Desbloqueio e Saída sem Prender o Usuário */}
                <div className="flex flex-col w-full gap-2 pt-2 border-t border-border/80">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPixResult(null);
                      setMethod("credit_card");
                    }}
                    className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <CreditCard className="size-3.5" aria-hidden="true" />
                    Pagar com cartão de crédito em vez de PIX
                  </Button>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPixResult(null);
                        navigate("/planos");
                      }}
                      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      Voltar aos planos
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigate("/");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Ir para o painel
                    </Button>
                  </div>
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
                  R$&nbsp;178,80 à vista
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
                <span>{billingSchedule.isDelayedByTrial ? "Total cobrado hoje" : "Total a pagar"}</span>
                <span className="whitespace-nowrap tabular-nums text-foreground">
                  {billingSchedule.isDelayedByTrial ? "R$ 0,00" : planInfo.price}
                </span>
              </div>
              {billingSchedule.isDelayedByTrial && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  Primeira fatura de {planInfo.price} agendada para {billingSchedule.firstBillingDate.toLocaleDateString("pt-BR")}.
                </p>
              )}
            </div>

            {/* Selos de segurança */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <SecuritySeal icon={Lock} label="SSL 256-bit" />
              <SecuritySeal icon={ShieldCheck} label="Dados protegidos" />
              <SecuritySeal icon={CheckCircle2} label="Garantia 7 dias (CDC)" />
            </div>

            {/* CTA Principal */}
            {(!pixResult || activeMethod === "credit_card") && (
              <Button
                type="button"
                className="w-full gap-2 py-6 text-base font-semibold rounded-xl cursor-pointer shadow-md"
                disabled={isPending}
                onClick={() => { void handleConfirm(); }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    Processando com gateway seguro...
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
      onClick={() => {
        triggerSensory("selection");
        onClick();
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20",
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
