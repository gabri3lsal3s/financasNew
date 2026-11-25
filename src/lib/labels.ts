import type { RecurrenceKind } from "@/domain/insights";
import type {
  BusinessProfileKind,
  CategoryScope,
  ChargeKind,
  CreditCardScope,
  InternalTransferKind,
  PaymentMethod,
  PortfolioTransactionType,
  ReceiveType,
  RecurrenceFrequency,
  TransactionScope,
} from "@/types";

/**
 * Labels pt-BR compartilhados (DRY) — formas de pagamento, tipos de
 * recebimento, encargos de fatura, escopos PF/PJ e níveis de recorrência.
 */

export const INTERNAL_TRANSFER_KIND_LABELS: Record<InternalTransferKind, string> = {
  pro_labore: "Pró-Labore (Profissional para Pessoal)",
  capital_injection: "Aporte de Capital (Pessoal para Profissional)",
  card_reimbursement: "Reembolso de Cartão Misto (Profissional para Pessoal)",
};

export const TRANSACTION_SCOPE_LABELS: Record<TransactionScope, string> = {
  personal: "Pessoal",
  business: "Profissional",
};

export const CREDIT_CARD_SCOPE_LABELS: Record<CreditCardScope, string> = {
  personal: "Pessoal",
  business: "Profissional",
  mixed: "Uso Misto (Pessoal e Profissional)",
};

export const CATEGORY_SCOPE_LABELS: Record<CategoryScope, string> = {
  personal: "Pessoal",
  business: "Profissional",
  both: "Ambos (Pessoal e Profissional)",
};

export const BUSINESS_PROFILE_LABELS: Record<BusinessProfileKind, string> = {
  mei: "MEI (Microempreendedor Individual)",
  liberal: "Profissional Liberal / Autônomo",
  micro_business: "Pequena Empresa / Loja",
};

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  regular: "Consumo normal",
  interest: "Juros",
  fine: "Multa",
  tax: "IOF / Tributos",
  bank_fee: "Tarifa / Encargos",
};

export const RECURRENCE_LEVEL_LABELS: Record<RecurrenceKind, string> = {
  subscription: "Assinatura",
  recurring: "Recorrente",
};

/** Rótulos das frequências de recorrência formal (Fase 32). */
export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  quarterly: "Trimestral",
  yearly: "Anual",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  debit: "Débito",
  credit_card: "Cartão de crédito",
  pix: "Pix",
  transfer: "Transferência",
  other: "Outro",
};

export const RECEIVE_TYPE_LABELS: Record<ReceiveType, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  transfer: "Transferência",
  other: "Outro",
};

export const PORTFOLIO_TX_LABELS: Record<PortfolioTransactionType, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Dividendo",
  jcp: "Juros sobre capital (JCP)",
  fii_yield: "Rendimento de FII",
  subscription: "Subscrição",
  split: "Split (desdobramento)",
  reverse_split: "Grupamento (reverse split)",
};
