import type { PaymentMethod, ReceiveType } from "@/types";

/**
 * Labels pt-BR compartilhados (DRY) — formas de pagamento e tipos de
 * recebimento. Fonte única: telas, wizard, relatórios e busca global
 * importam daqui (nunca duplicam strings).
 */
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
