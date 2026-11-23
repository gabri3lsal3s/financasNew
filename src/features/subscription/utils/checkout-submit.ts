import { cleanCPF } from "@/domain/validation";
import { signInWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type {
  PixCheckoutResult,
  useCheckoutMutation,
} from "@/state";
import type { SubscriptionPlan } from "@/types";
import type { CheckoutPaymentMethod } from "./checkout-validation";

const TEST_PIX_COPY_PASTE_KEY =
  "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865406178.805802BR5913AXIR_PRO6009SAO_PAULO62070503***6304ABCD";

type MutateCheckoutFn = ReturnType<typeof useCheckoutMutation>["mutateAsync"];
type CheckoutSessionResult = Awaited<ReturnType<MutateCheckoutFn>>;

export interface SubmitCheckoutOrderParams {
  hasSession: boolean;
  sessionName?: string;
  sessionEmail?: string;
  authMode: "register" | "login";
  authName: string;
  authEmail: string;
  authPassword: string;
  cpf: string;
  plan: SubscriptionPlan;
  activeMethod: CheckoutPaymentMethod;
  holderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCcv: string;
  daysUntilFirstCharge: number;
  firstBillingDate: Date;
  mutateCheckout: MutateCheckoutFn;
  onErrorMessage: (message: string) => void;
  onPixCreated: (pix: PixCheckoutResult) => void;
  onEmailConfirmationRequired: (email: string, cardLast4?: string) => void;
  onNavigateSuccess: (url: string) => void;
}

/**
 * Executa a criação/login de conta e a chamada ao gateway de checkout (Cartão ou PIX).
 */
export async function submitCheckoutOrder(params: SubmitCheckoutOrderParams): Promise<void> {
  if (!params.hasSession && params.authMode === "login") {
    try {
      await signInWithEmail(params.authEmail.trim(), params.authPassword);
    } catch (authErr: unknown) {
      triggerSensory("error");
      params.onErrorMessage(getErrorMessage(authErr));
      return;
    }
  }

  const registration =
    !params.hasSession && params.authMode === "register"
      ? {
          name: params.authName.trim(),
          email: params.authEmail.trim(),
          password: params.authPassword,
        }
      : undefined;

  const customerEmail = params.authEmail.trim() || params.sessionEmail || "";
  const customerName = (
    params.holderName.trim() ||
    params.authName.trim() ||
    params.sessionName ||
    "Cliente"
  ).toUpperCase();

  if (params.activeMethod === "credit_card") {
    await processCreditCardCheckout({
      ...params,
      customerEmail,
      customerName,
      registration,
    });
    return;
  }

  await processPixCheckout({
    ...params,
    customerEmail,
    registration,
  });
}

async function processCreditCardCheckout(
  params: SubmitCheckoutOrderParams & {
    customerEmail: string;
    customerName: string;
    registration?: { name: string; email: string; password: string };
  },
): Promise<void> {
  const [expMonth, expYear] = params.cardExpiry.split("/");
  const rawCardNumber = params.cardNumber.replace(/\D/g, "");

  const res: CheckoutSessionResult = await params.mutateCheckout({
    plan: params.plan,
    method: "credit_card",
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      cpf: cleanCPF(params.cpf),
    },
    card: {
      holderName: params.holderName.trim().toUpperCase(),
      number: rawCardNumber,
      expiryMonth: (expMonth || "12").padStart(2, "0"),
      expiryYear: expYear || "28",
      ccv: params.cardCcv,
    },
    registration: params.registration,
    trialDaysRemaining: params.daysUntilFirstCharge,
    firstBillingDate: params.firstBillingDate.toISOString(),
  });

  if (
    res &&
    res.method === "hosted_session" &&
    "checkoutUrl" in res &&
    typeof res.checkoutUrl === "string" &&
    /^https:\/\//i.test(res.checkoutUrl.trim())
  ) {
    window.location.href = res.checkoutUrl.trim();
    return;
  }

  if (res && "needsEmailConfirmation" in res && res.needsEmailConfirmation) {
    const cardLast4 =
      "cardLast4" in res && typeof res.cardLast4 === "string"
        ? res.cardLast4
        : rawCardNumber.slice(-4);
    params.onEmailConfirmationRequired(params.customerEmail, cardLast4);
    triggerSensory("success");
    pushToast({
      title: "Conta criada e cartão cadastrado!",
      description: "Enviamos um link de confirmação para o seu e-mail.",
      variant: "default",
    });
    return;
  }

  const isScheduled = Boolean(res && "phase" in res && res.phase === "trial_scheduled");
  const firstChargeParam =
    isScheduled && res && "firstChargeAt" in res && typeof res.firstChargeAt === "string"
      ? `&fase=trial_scheduled&primeira_cobranca=${encodeURIComponent(res.firstChargeAt)}`
      : "";

  triggerSensory("success");
  pushToast({
    title: isScheduled ? "Cartão cadastrado com sucesso!" : "Plano Pro ativado com sucesso!",
    description: isScheduled ? "Seu período de teste de 30 dias está ativo." : "Bem-vindo ao Axir Pro.",
    variant: "default",
  });
  params.onNavigateSuccess(`/assinatura/sucesso?plano=${params.plan}&metodo=credit_card${firstChargeParam}`);
}

async function processPixCheckout(
  params: SubmitCheckoutOrderParams & {
    customerEmail: string;
    registration?: { name: string; email: string; password: string };
  },
): Promise<void> {
  try {
    const res = await params.mutateCheckout({
      plan: "annual",
      method: "pix",
      customer: {
        name: (params.authName.trim() || params.sessionName || "Cliente").toUpperCase(),
        email: params.customerEmail,
        cpf: cleanCPF(params.cpf),
      },
      registration: params.registration,
    });

    if (res.method === "pix") {
      params.onPixCreated(res);
      triggerSensory("success");
      pushToast({
        title: "QR Code PIX gerado!",
        description: "Pague pelo app do seu banco para ativar sua conta instantaneamente.",
        variant: "default",
      });
      if ("needsEmailConfirmation" in res && res.needsEmailConfirmation) {
        params.onEmailConfirmationRequired(params.customerEmail);
      }
    }
  } catch (pixErr: unknown) {
    if (import.meta.env.DEV && import.meta.env.MODE === "test") {
      params.onPixCreated({
        ok: true,
        method: "pix",
        provider: "asaas",
        paymentId: "pay_simulated_" + Date.now(),
        qrCodeBase64: "",
        copyPasteKey: TEST_PIX_COPY_PASTE_KEY,
        expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      triggerSensory("success");
      pushToast({
        title: "QR Code PIX demonstrativo gerado!",
        description: "Ambiente de testes: chave demonstrativa gerada.",
        variant: "default",
      });
      return;
    }
    throw pixErr;
  }
}
