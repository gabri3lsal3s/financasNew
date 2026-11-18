import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  PLAN_CONFIGS,
  resolveCheckoutBillingSchedule,
  resolvePlanFromQuery,
} from "@/domain/subscription";
import { formatCPF } from "@/domain/validation";
import { useAuth } from "@/hooks/use-auth";
import { detectCardBrand, formatCardExpiry, formatCardNumber } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useCheckoutMutation, useUserSubscription } from "@/state";
import type { SubscriptionPlan } from "@/types";
import { submitCheckoutOrder } from "../utils/checkout-submit";
import {
  validateCheckoutFields,
  type CheckoutPaymentMethod,
} from "../utils/checkout-validation";
import { useCheckoutPixFlow } from "./use-checkout-pix-flow";

/**
 * Gerencia o estado, validações e submissão do checkout Pro.
 */
export function useSubscriptionCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const subscription = useUserSubscription();
  const checkoutMutation = useCheckoutMutation();

  const plan: SubscriptionPlan = resolvePlanFromQuery(searchParams.get("plano"));
  const planConfig = PLAN_CONFIGS[plan];
  const metodoParam = searchParams.get("metodo");

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
      }),
    [plan, subscription, session],
  );

  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    metodoParam === "pix" && plan === "annual" ? "pix" : "credit_card",
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

  const [cpf, setCpf] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const detectedBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);

  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [confirmedCardLast4, setConfirmedCardLast4] = useState("");

  const pixFlow = useCheckoutPixFlow(plan, Boolean(subscription.isPro));

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

  const activeMethod: CheckoutPaymentMethod = plan === "monthly" ? "credit_card" : method;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/planos");
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
    pixFlow.setPixResult(null);
    setErrorMessage(null);
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
        daysUntilFirstCharge: billingSchedule.daysUntilFirstCharge,
        firstBillingDate: billingSchedule.firstBillingDate,
        mutateCheckout: checkoutMutation.mutateAsync,
        onErrorMessage: setErrorMessage,
        onPixCreated: pixFlow.setPixResult,
        onEmailConfirmationRequired: (email, cardLast4) => {
          setConfirmedEmail(email);
          if (cardLast4) setConfirmedCardLast4(cardLast4);
          setConfirmationSent(true);
        },
        onNavigateSuccess: (url) => {
          void navigate(url);
        },
      });
    } catch (err: unknown) {
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
    isPending,
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
      setCpf(formatCPF(val));
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
    detectedBrand,
    pixResult: pixFlow.pixResult,
    setPixResult: pixFlow.setPixResult,
    copiedPix: pixFlow.copiedPix,
    confirmationSent,
    confirmedEmail,
    confirmedCardLast4,
    handleBack,
    handleSelectPlan,
    handleCopyPix: pixFlow.handleCopyPix,
    handleSimulatePixConfirmation: pixFlow.handleSimulatePixConfirmation,
    handleConfirm,
    navigate,
  };
}
