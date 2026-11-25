import type { ConfidenceLevel, ReceiptFieldConfidence } from "@/domain/notifications";
import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { ChargeKind, DebtType, PaymentMethod, ReceiveType, TransactionScope } from "@/types";

export type EntryType = "expense" | "income";
export type WizardMode = "quick" | "guided";
export type WizardContextMode = "personal" | "family" | "trip" | "split" | "business";

export interface LaunchState {
  step: number;
  type: EntryType;
  /** Valor em centavos. */
  valueCents: number;
  installments: number;
  categoryId: string;
  /** YYYY-MM-DD */
  date: string;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  receiveType: ReceiveType;
  description: string;
  reportWeight: number;
  /** Valor em centavos considerado no relatório quando personalizado. */
  reportCustomAmountCents: number;
  debtEnabled: boolean;
  debtType: DebtType;
  debtAmountCents: number;
  /** YYYY-MM-DD */
  debtDueDate: string;
  /** Recorrência formal (Fase 32) — avulsa/parcelada XOR recorrente. */
  recurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndMode: "date" | "count";
  /** YYYY-MM-DD — fim por data (quando `recurrenceEndMode === "date"`). */
  recurrenceEndDate: string;
  /** Nº de ocorrências (quando `recurrenceEndMode === "count"`). */
  recurrenceCount: number;
  /** Lançamento da casa / familiar compartilhado (Fase 3). */
  isFamily: boolean;
  /** Se o usuário marcou para rachar a despesa com amigos (gerar Pix e cobrança vinculada) */
  splitEnabled: boolean;
  /** Quantidade de participantes na divisão (mínimo 2) */
  splitPeopleCount: number;
  /** Vínculo com viagem ativa (Modo Viagem) */
  tripId: string | null;
  /** Modalidade de recebimento do rateio quando despesa parcelada */
  splitDebtMode: "single_total" | "per_installment";
  /** Tipo de encargo quando despesa no cartão de crédito */
  chargeKind?: ChargeKind;
  /** Esfera fiscal do lançamento: pessoal (PF) ou negócio (PJ/MEI). */
  scope?: TransactionScope;
  /** Despesa dedutível para cálculo de escudo fiscal no Modo Negócio. */
  isTaxDeductible?: boolean;
  /** Valor retido na fonte (IRRF/ISS) em centavos para receitas PJ/Autônomo. */
  taxWithheldCents?: number;
  /** Se o usuário ativou a divisão de uso misto (Split PF/PJ). */
  splitPFPJEnabled?: boolean;
  /** Percentual atribuído ao negócio no Split PF/PJ (1 a 99, default 50). */
  splitPFPJBusinessPercent?: number;
}

export const WIZARD_STEPS = ["Valor", "Categoria", "Detalhes", "Revisão"] as const;

export interface ReceiptMeta {
  merchant?: string;
  receiptKind?: string;
  dueDate?: string;
  documentStatus?: "paid" | "pending_due";
  cardLastDigits?: string;
  taxId?: string;
  packageName?: string;
  pixKey?: string;
  confidence?: ConfidenceLevel;
  confidenceScore?: number;
  fieldConfidence?: ReceiptFieldConfidence;
  isSameTitularity?: boolean;
  needsAmountInput?: boolean;
  semanticTags?: string[];
  inferredScope?: "personal" | "business";
  isTaxDeductible?: boolean;
}

export interface CreatedSplitExpense {
  id: string;
  value: number;
  description?: string | null;
  date: string;
  peopleCount: number;
  installmentsCount?: number;
  installmentsMode?: "single_total" | "per_installment";
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
}
