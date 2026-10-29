import type { PaymentMethod } from "@/types/schema";

export type ReceiptKind =
  | "pix"
  | "card_slip"
  | "bank_slip_payment"
  | "invoice_danfe"
  | "wire_transfer"
  | "generic";

export interface ParsedInstallmentData {
  /** Quantidade total de parcelas (2 a 60) */
  count: number;
  /** Valor de cada parcela em centavos */
  installmentAmountCents: number;
  /** Valor total consolidado em centavos */
  totalAmountCents: number;
  /** Parcela corrente citada no comprovante (ex: 2 de 10), se houver */
  currentInstallment?: number;
  /**
   * Indica se é uma nova compra a prazo (true), que deve gerar parcelas futuras no app,
   * ou se é o pagamento pontual de uma parcela de financiamento/fatura (false).
   */
  isNewFinancedPurchase: boolean;
}

export interface UniversalReceiptData {
  id: string;
  kind: ReceiptKind;
  nature: "expense" | "income";
  amountCents: number;
  date: string; // YYYY-MM-DD
  description: string;
  paymentMethod: PaymentMethod;
  merchantOrBeneficiary?: string;
  payerOrSource?: string;
  taxId?: string; // CPF (11 dígitos) ou CNPJ (14 dígitos)
  bankName?: string;
  issuerBank?: string;
  cardBrand?: string; // Visa, Mastercard, Elo, Amex, Hipercard
  cardLastDigits?: string; // 4 dígitos finais (ex: "4821")
  authorizationCode?: string;
  terminalAcquirer?: string; // Cielo, Rede, Stone, PagBank, SafraPay, Getnet, etc.
  installments?: ParsedInstallmentData;
  isScheduled?: boolean;
  scheduledFor?: string;
  txId?: string;
  pixKey?: string;
  barcodeOrDigitableLine?: string;
  dueDate?: string;
  nfeAccessKey?: string;
  rawCleanText: string;
}
