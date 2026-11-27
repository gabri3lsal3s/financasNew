import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  PLAN_CONFIGS,
  resolveCheckoutBillingSchedule,
  resolvePlanFromQuery,
} from "@/domain/subscription";
import { formatCPF } from "@/domain/validation";
import { resendConfirmationEmail, useAuth } from "@/hooks/use-auth";
import {
  detectCardBrand,
  formatCardExpiry,
  formatCardNumber,
  formatCep,
  formatPhoneBR,
} from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useBillingContact, useCancelPendingPixMutation, useCheckoutMutation, useUserSubscription } from "@/state";
import type { SubscriptionPlan } from "@/types";
import { buildCheckoutReturnPath, submitCheckoutOrder } from "../utils/checkout-submit";
import {
  validateCheckoutFields,
  type CheckoutPaymentMethod,
} from "../utils/checkout-validation";
import { useCheckoutPixFlow } from "./use-checkout-pix-flow";

/**
 * Gerencia o estado, validações, pré-preenchimento seguro e submissão do checkout Pro.
 */
export function useSubscriptionCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const subscription = useUserSubscription();
  const checkoutMutation = useCheckoutMutation();
  const cancelPixMutation = useCancelPendingPixMutation();
  const billingContactQuery = useBillingContact(Boolean(session));

  const plan: SubscriptionPlan = resolvePlanFromQuery(searchParams.get("plano"));
  const planConfig = PLAN_CONFIGS[plan];
  const metodoParam = searchParams.get("metodo");

  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    metodoParam === "pix" && plan === "annual" ? "pix" : "credit_card",
  );
  const activeMethod: CheckoutPaymentMethod = plan === "monthly" ? "credit_card" : method;

  const billingSchedule = useMemo(
    () =>
      resolveCheckoutBillingSchedule({
        plan,
        currentTier: subscription?.tier,
        trialDaysRemaining: subscription?.trialDaysRemaining,
        hasAlreadyPaid: subscription?.isPro || subscription?.isLifetime,
        isReadOnly: subscription?.isReadOnly,
        status: subscription?.status,
        hasConsumedTrial:
          subscription?.hasUsedTrial ||
          subscription?.isReadOnly ||
          subscription?.billingPhase === "trial_expired",
        isNewRegistration: !session,
        currentPeriodEnd: subscription?.currentPeriodEnd,
        paymentMethod: activeMethod,
      }),
    [plan, subscription, session, activeMethod],
  );
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    searchParams.get("status") === "cancelado"
      ? "O pagamento não foi concluído. Você pode tentar novamente com outra forma de pagamento."
      : null,
  );

  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [cpfInput, setCpfInput] = useState<string | null>(null);
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [postalCodeInput, setPostalCodeInput] = useState<string | null>(null);
  const [addressNumberInput, setAddressNumberInput] = useState<string | null>(null);

  const prefill = session ? billingContactQuery.data : null;
  const cpf = cpfInput ?? (prefill?.cpf ? formatCPF(prefill.cpf) : "");
  const phone = phoneInput ?? (prefill?.phone ? formatPhoneBR(prefill.phone) : "");
  const postalCode = postalCodeInput ?? (prefill?.postalCode ? formatCep(prefill.postalCode) : "");
  const addressNumber = addressNumberInput ?? (prefill?.addressNumber?.trim() || "");

  const detectedBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);

  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [confirmedCardLast4, setConfirmedCardLast4] = useState("");

  const pixFlow = useCheckoutPixFlow(plan, {
    isPro: Boolean(subscription.isPro),
    tier: subscription.tier,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
  });

  const clearSensitiveCardState = useCallback(() => {
    setCardNumber("");
    setCardExpiry("");
    setCardCcv("");
  }, []);

  useEffect(() => {
    if (searchParams.get("status") === "pendente") {
      pushToast({
        title: "Pagamento em análise",
        description:
          "Seu pagamento está sendo processado pelo gateway. Assim que confirmado, sua conta será atualizada.",
        variant: "default",
      });
    }
  }, [searchParams]);

  const checkoutReturnPath = buildCheckoutReturnPath(plan, activeMethod);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/planos");
  };

  const cancelPendingPixBestEffort = (paymentId: string | undefined) => {
    if (!paymentId || !session) return;
    void cancelPixMutation.mutateAsync({ paymentId, silent: true }).catch(() => undefined);
  };

  const handleSelectMethod = (nextMethod: CheckoutPaymentMethod) => {
    if (nextMethod === "pix") {
      clearSensitiveCardState();
    } else {
      cancelPendingPixBestEffort(pixFlow.pixResult?.paymentId);
      pixFlow.setPixResult(null);
    }
    setMethod(nextMethod);
    setErrorMessage(null);
  };

  const handleSwitchToCard = () => {
    cancelPendingPixBestEffort(pixFlow.pixResult?.paymentId);
    pixFlow.setPixResult(null);
    setMethod("credit_card");
    setErrorMessage(null);
  };

  const handleCancelPix = async () => {
    const paymentId = pixFlow.pixResult?.paymentId;
    if (!paymentId) {
      pixFlow.setPixResult(null);
      return;
    }
    try {
      await cancelPixMutation.mutateAsync({ paymentId });
      pixFlow.setPixResult(null);
    } catch {
      // Toast destrutivo já tratado no hook de mutação
    }
  };

  const handleSelectPlan = (targetPlan: SubscriptionPlan) => {
    triggerSensory("selection");
    const newParams = new URLSearchParams(searchParams);
    newParams.set("plano", targetPlan === "annual" ? "pro-anual" : "pro-mensal");
    if (targetPlan === "monthly" && method === "pix") {
      newParams.set("metodo", "cartao");
      setMethod("credit_card");
    }
    navigate(`?${newParams.toString()}`, { replace: true });
    cancelPendingPixBestEffort(pixFlow.pixResult?.paymentId);
    pixFlow.setPixResult(null);
    setErrorMessage(null);
  };

  const handleResendConfirmation = async () => {
    const targetEmail = (confirmedEmail || authEmail).trim();
    if (!targetEmail) return;
    await resendConfirmationEmail(targetEmail, checkoutReturnPath);
  };

  const handleConfirm = async () => {
    setErrorMessage(null);
    const validationError = validateCheckoutFields({
      hasSession: Boolean(session),
      authMode,
      authName,
      authEmail,
      authPassword,
      cpf,
      activeMethod,
      holderName,
      cardNumber,
      cardExpiry,
      cardCcv,
      phone,
      postalCode,
      addressNumber,
    });
    if (validationError) {
      triggerSensory("error");
      setErrorMessage(validationError);
      return;
    }

    setIsPending(true);
    try {
      const sessionName =
        typeof session?.user?.user_metadata?.name === "string"
          ? session.user.user_metadata.name
          : undefined;
      await submitCheckoutOrder({
        hasSession: Boolean(session),
        sessionName,
        sessionEmail: session?.user?.email ?? undefined,
        authMode,
        authName,
        authEmail,
        authPassword,
        cpf,
        plan,
        activeMethod,
        holderName,
        cardNumber,
        cardExpiry,
        cardCcv,
        phone,
        postalCode,
        addressNumber,
        daysUntilFirstCharge: billingSchedule.daysUntilFirstCharge,
        firstBillingDate: billingSchedule.firstBillingDate,
        mutateCheckout: checkoutMutation.mutateAsync,
        onErrorMessage: setErrorMessage,
        onPixCreated: pixFlow.setPixResult,
        onEmailConfirmationRequired: (email, cardLast4) => {
          clearSensitiveCardState();
          setAuthPassword("");
          setConfirmedEmail(email);
          setConfirmedCardLast4(cardLast4 || "");
          setConfirmationSent(true);
        },
        onPendingPayment: (message) => {
          setCardCcv("");
          setErrorMessage(message);
        },
        onNavigateSuccess: (url) => {
          clearSensitiveCardState();
          setAuthPassword("");
          void navigate(url);
        },
      });
    } catch (err: unknown) {
      // Limpa CVV imediatamente em falha de gateway (D-10)
      setCardCcv("");
      triggerSensory("destructive");
      setErrorMessage(err instanceof Error ? err.message : "Falha ao processar pagamento.");
    } finally {
      setIsPending(false);
    }
  };

  return {
    authLoading,
    session,
    subscription,
    plan,
    planConfig,
    billingSchedule,
    activeMethod,
    setMethod,
    handleSelectMethod,
    handleSwitchToCard,
    handleCancelPix,
    isPending,
    isCancelingPix: cancelPixMutation.isPending,
    errorMessage,
    setErrorMessage,
    authMode,
    setAuthMode,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    cpf,
    handleCpfChange: (val: string) => {
      setCpfInput(formatCPF(val));
      if (errorMessage) setErrorMessage(null);
    },
    holderName,
    setHolderName,
    cardNumber,
    handleCardNumberChange: (val: string) => {
      setCardNumber(formatCardNumber(val));
      if (errorMessage) setErrorMessage(null);
    },
    cardExpiry,
    handleCardExpiryChange: (val: string) => {
      setCardExpiry(formatCardExpiry(val));
      if (errorMessage) setErrorMessage(null);
    },
    cardCcv,
    handleCardCcvChange: (val: string) => {
      setCardCcv(val.replace(/\D/g, "").slice(0, 4));
      if (errorMessage) setErrorMessage(null);
    },
    phone,
    handlePhoneChange: (val: string) => {
      setPhoneInput(formatPhoneBR(val));
      if (errorMessage) setErrorMessage(null);
    },
    postalCode,
    handlePostalCodeChange: (val: string) => {
      setPostalCodeInput(formatCep(val));
      if (errorMessage) setErrorMessage(null);
    },
    addressNumber,
    handleAddressNumberChange: (val: string) => {
      setAddressNumberInput(val);
      if (errorMessage) setErrorMessage(null);
    },
    detectedBrand,
    pixResult: pixFlow.pixResult,
    setPixResult: pixFlow.setPixResult,
    copiedPix: pixFlow.copiedPix,
    isVerifyingManual: pixFlow.isVerifyingManual,
    confirmationSent,
    confirmedEmail,
    confirmedCardLast4,
    checkoutReturnPath,
    handleResendConfirmation,
    handleBack,
    handleSelectPlan,
    handleCopyPix: pixFlow.handleCopyPix,
    handleManualVerify: pixFlow.handleManualVerify,
    handleSimulatePixConfirmation: pixFlow.handleSimulatePixConfirmation,
    handleConfirm,
    navigate,
  };
}
