import type { SubscriptionPlan, SubscriptionTier } from "./subscription";

export type BillingProviderName = "asaas" | "manual";

export interface CustomerBillingDetails {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
}

export interface CreditCardPayload {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  postalCode?: string;
  addressNumber?: string;
}

export interface CreateCheckoutParams {
  plan: SubscriptionPlan;
  method: "credit_card" | "pix" | "hosted_session";
  customer: CustomerBillingDetails;
  card?: CreditCardPayload;
  trialDaysRemaining?: number;
  firstBillingDate?: string; // ISO string
  successUrl?: string;
  cancelUrl?: string;
  registration?: {
    name: string;
    email: string;
    password?: string;
  };
}

export interface CreateCumulativeCheckoutParams {
  months: number;
  method: "pix" | "credit_card";
  card?: CreditCardPayload;
  phone?: string;
}

export interface PixCheckoutResult {
  ok: true;
  method: "pix";
  provider: BillingProviderName;
  paymentId: string;
  qrCodeBase64: string;
  copyPasteKey: string;
  expirationDate: string;
  needsEmailConfirmation?: boolean;
  email?: string;
}

export interface DirectCreditCardResult {
  ok: true;
  method: "credit_card";
  provider: BillingProviderName;
  subscriptionId?: string;
  paymentId?: string;
  tier: SubscriptionTier;
  status: "active" | "trialing" | "pending";
  needsEmailConfirmation?: boolean;
  email?: string;
  cardLast4?: string;
}

export interface HostedSessionResult {
  ok: true;
  method: "hosted_session";
  provider: BillingProviderName;
  checkoutUrl: string;
  sessionId: string;
}

export type CheckoutSessionResult =
  | PixCheckoutResult
  | DirectCreditCardResult
  | HostedSessionResult;

export interface UpdatePaymentParams {
  subscriptionId: string;
  customerId?: string;
  card?: CreditCardPayload;
  returnUrl?: string;
}

export interface CancelSubscriptionParams {
  subscriptionId?: string;
  immediate?: boolean;
  reason?: string;
}

export type CanonicalEventType =
  | "subscription.created"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "subscription.canceled";

export interface NormalizedWebhookEvent {
  provider: BillingProviderName;
  eventId: string;
  eventType: CanonicalEventType;
  timestamp: string; // ISO 8601
  providerCustomerId: string;
  providerSubscriptionId?: string | null;
  providerPaymentId?: string | null;
  plan?: SubscriptionPlan | null;
  amountCents?: number | null;
  currentPeriodEnd?: string | null; // ISO 8601
  rawPayload?: unknown;
}

export interface BillingInvoiceItem {
  id: string;
  dateCreated: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  transactionReceiptUrl?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
}

/**
 * Interface canônica que qualquer adaptador de faturamento deve implementar.
 */
export interface BillingProviderAdapter {
  readonly providerName: BillingProviderName;

  /**
   * Cria uma sessão de checkout ou processa a contratação imediata.
   */
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;

  /**
   * Cria uma cobrança avulsa para pagamento acumulativo de 2 a 11 meses.
   */
  createCumulativeCheckoutSession?(params: CreateCumulativeCheckoutParams): Promise<CheckoutSessionResult>;

  /**
   * Cancela a renovação da assinatura no provedor de pagamento.
   */
  cancelSubscription(params?: CancelSubscriptionParams): Promise<void>;

  /**
   * Atualiza a forma de pagamento cadastrada para cobranças recorrentes.
   */
  updatePaymentMethod(params: UpdatePaymentParams): Promise<void>;

  /**
   * Consulta a lista cronológica de faturas e comprovantes fiscais do cliente.
   */
  listInvoices?(): Promise<BillingInvoiceItem[]>;

  /**
   * Realiza a migração direta do plano Mensal para o plano Anual (Upsell 40%).
   */
  upgradeToAnnual?(): Promise<void>;

  /**
   * Agenda a troca de plano para a próxima renovação (mensal <-> anual).
   */
  schedulePlanChange?(targetPlan: SubscriptionPlan): Promise<{ ok: boolean; message: string }>;

  /**
   * Cancela uma troca de plano agendada previamente.
   */
  cancelScheduledPlanChange?(): Promise<{ ok: boolean; message: string }>;
}
