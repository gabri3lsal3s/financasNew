import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { DebtType, PaymentMethod, ReceiveType } from "@/types";

export type EntryType = "expense" | "income";
export type WizardMode = "quick" | "guided";
export type WizardContextMode = "personal" | "family" | "trip" | "split";

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
}

export const WIZARD_STEPS = ["Valor", "Categoria", "Detalhes", "Revisão"] as const;

export interface ReceiptMeta {
  merchant?: string;
  cardLastDigits?: string;
  taxId?: string;
  packageName?: string;
  pixKey?: string;
}

export interface CreatedSplitExpense {
  id: string;
  value: number;
  description?: string | null;
  date: string;
  peopleCount: number;
  installmentsCount?: number;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
}
