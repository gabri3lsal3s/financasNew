import { cleanCPF } from "@/domain/validation";
import { signInWithEmail, signUpWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { cleanCep, cleanPhoneBR } from "@/services/masks";
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

export function buildCheckoutReturnPath(
  plan: SubscriptionPlan,
  activeMethod: CheckoutPaymentMethod,
): string {
  const planoSlug = plan === "annual" ? "pro-anual" : "pro-mensal";
  const metodoSlug = activeMethod === "pix" ? "pix" : "cartao";
  return `/assinatura?plano=${planoSlug}&metodo=${metodoSlug}`;
}

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
  phone: string;
  postalCode: string;
  addressNumber: string;
  daysUntilFirstCharge: number;
  firstBillingDate: Date;
  mutateCheckout: MutateCheckoutFn;
  onErrorMessage: (message: string) => void;
  onPixCreated: (pix: PixCheckoutResult) => void;
  onEmailConfirmationRequired: (email: string, cardLast4?: string) => void;
  onPendingPayment?: (message: string) => void;
  onNavigateSuccess: (url: string) => void;
}

/**
 * Executa a criação/login de conta e a chamada ao gateway de checkout (Cartão ou PIX).
 * Em novos cadastros que exigem confirmação por e-mail (B-02), cria a conta antes no
 * Supabase Auth e interrompe o envio de dados de cartão até o retorno autenticado.
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

  if (!params.hasSession && params.authMode === "register") {
    const checkoutReturnPath = buildCheckoutReturnPath(params.plan, params.activeMethod);
    try {
      const signUpResult = await signUpWithEmail(
        params.authEmail.trim(),
        params.authPassword,
        params.authName.trim(),
        undefined,
        undefined,
        checkoutReturnPath,
      );

      if (signUpResult.needsEmailConfirmation) {
        params.onEmailConfirmationRequired(params.authEmail.trim());
        triggerSensory("success");
        pushToast({
          title: "Conta criada! Confirme seu e-mail",
          description:
            "Enviamos o link de confirmação. Ao clicar, você voltará automaticamente ao checkout para concluir a assinatura.",
          variant: "default",
        });
        return;
      }
    } catch (authErr: unknown) {
      triggerSensory("error");
      params.onErrorMessage(getErrorMessage(authErr));
      return;
    }
  }

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
    });
    return;
  }

  await processPixCheckout({
    ...params,
    customerEmail,
  });
}

async function processCreditCardCheckout(
  params: SubmitCheckoutOrderParams & {
    customerEmail: string;
    customerName: string;
  },
): Promise<void> {
  const [expMonth, expYear] = params.cardExpiry.split("/");
  const rawCardNumber = params.cardNumber.replace(/\D/g, "");
  const cleanPhone = cleanPhoneBR(params.phone);
  const cleanPostalCode = cleanCep(params.postalCode);
  const cleanAddressNumber = params.addressNumber.trim();

  const res: CheckoutSessionResult = await params.mutateCheckout({
    plan: params.plan,
    method: "credit_card",
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      cpf: cleanCPF(params.cpf),
      phone: cleanPhone,
      postalCode: cleanPostalCode,
      addressNumber: cleanAddressNumber,
    },
    card: {
      holderName: params.holderName.trim().toUpperCase(),
      number: rawCardNumber,
      expiryMonth: (expMonth || "12").padStart(2, "0"),
      expiryYear: expYear || "28",
      ccv: params.cardCcv,
      phone: cleanPhone,
      postalCode: cleanPostalCode,
      addressNumber: cleanAddressNumber,
    },
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
        : undefined;
    params.onEmailConfirmationRequired(params.customerEmail, cardLast4);
    triggerSensory("success");
    pushToast({
      title: "Conta criada!",
      description: "Enviamos um link de confirmação para o seu e-mail.",
      variant: "default",
    });
    return;
  }

  if (res && "status" in res && res.status === "incomplete") {
    const planSlug = params.plan === "annual" ? "pro-anual" : "pro-mensal";
    triggerSensory("selection");
    pushToast({
      title: "Pagamento em análise",
      description:
        "Seu cartão está sendo validado pela operadora. Assim que aprovado, o plano Pro será ativado automaticamente.",
      variant: "default",
    });
    if (params.onPendingPayment) {
      params.onPendingPayment(
        "Seu cartão está em validação pela operadora. Assim que aprovado, sua assinatura será ativada.",
      );
    } else {
      params.onNavigateSuccess(`/assinatura?plano=${planSlug}&status=pendente`);
    }
    return;
  }

  const isTrialScheduled = Boolean(res && "phase" in res && res.phase === "trial_scheduled");
  const isPlanChangeScheduled = Boolean(res && "phase" in res && res.phase === "plan_change_scheduled");
  const scheduledPhase = isTrialScheduled
    ? "trial_scheduled"
    : isPlanChangeScheduled
      ? "plan_change_scheduled"
      : null;
  const firstChargeParam =
    scheduledPhase && res && "firstChargeAt" in res && typeof res.firstChargeAt === "string"
      ? `&fase=${scheduledPhase}&primeira_cobranca=${encodeURIComponent(res.firstChargeAt)}`
      : "";

  triggerSensory("success");
  pushToast({
    title: isPlanChangeScheduled
      ? "Mudança de plano agendada!"
      : isTrialScheduled
        ? "Cartão cadastrado com sucesso!"
        : "Plano Pro ativado com sucesso!",
    description: isPlanChangeScheduled
      ? "Nenhuma cobrança hoje. A cobrança ocorrerá somente após o período que você já possui."
      : isTrialScheduled
        ? "Seu período de teste de 30 dias está ativo."
        : "Bem-vindo ao Axir Pro.",
    variant: "default",
  });
  params.onNavigateSuccess(`/assinatura/sucesso?plano=${params.plan}&metodo=credit_card${firstChargeParam}`);
}

async function processPixCheckout(
  params: SubmitCheckoutOrderParams & {
    customerEmail: string;
  },
): Promise<void> {
  try {
    const cleanPhone = cleanPhoneBR(params.phone);
    const res = await params.mutateCheckout({
      plan: "annual",
      method: "pix",
      customer: {
        name: (params.authName.trim() || params.sessionName || "Cliente").toUpperCase(),
        email: params.customerEmail,
        cpf: cleanCPF(params.cpf),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
      },
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
