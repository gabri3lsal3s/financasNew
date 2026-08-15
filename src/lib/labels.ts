import type { RecurrenceKind } from "@/domain/insights";
import type { PaymentMethod, PortfolioTransactionType, ReceiveType } from "@/types";

/**
 * Labels pt-BR compartilhados (DRY) — formas de pagamento, tipos de
 * recebimento e níveis de recorrência. Fonte única: telas, wizard,
 * relatórios, insights e busca global importam daqui (nunca duplicam strings).
 */

export const RECURRENCE_LEVEL_LABELS: Record<RecurrenceKind, string> = {
  subscription: "Assinatura",
  recurring: "Recorrente",
  similar: "Similar",
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
