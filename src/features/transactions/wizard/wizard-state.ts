/**
 * Estado e lógica pura do wizard de lançamento (D10 — tela cheia guiada).
 * Derivados calculados aqui (D12): parcelas em centavos + competência
 * snapshot quando cartão. O servidor valida invariantes (soma = total, 1–60).
 */
import { parcelar } from "@/domain/money/parcelar";
import { resolveBillCompetence } from "@/domain/competence";
import type { InstallmentInput } from "@/data/rpc";
import type { PaymentMethod, ReceiveType } from "@/types";

export type EntryType = "expense" | "income";

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
  debtEnabled: boolean;
  debtAmountCents: number;
  /** YYYY-MM-DD */
  debtDueDate: string;
}

export const WIZARD_STEPS = ["Valor", "Categoria", "Detalhes", "Revisão"] as const;

const toISODate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export function defaultLaunchState(): LaunchState {
  return {
    step: 1,
    type: "expense",
    valueCents: 0,
    installments: 1,
    categoryId: "",
    date: toISODate(new Date()),
    paymentMethod: "pix",
    cardId: null,
    receiveType: "pix",
    description: "",
    reportWeight: 1,
    debtEnabled: false,
    debtAmountCents: 0,
    debtDueDate: "",
  };
}

/** Pode avançar do passo atual (validações por etapa). */
export function canProceed(state: LaunchState): boolean {
  if (state.step === 1) return state.valueCents > 0;
  if (state.step === 2) return state.categoryId !== "";
  if (state.step === 3) {
    if (!state.date) return false;
    if (state.type === "expense" && state.paymentMethod === "credit_card" && !state.cardId) return false;
    if (state.debtEnabled && state.debtAmountCents <= 0) return false;
    return true;
  }
  return true;
}

const parseISO = (iso: string): Date => new Date(`${iso}T00:00:00`);

/**
 * Parcelas calculadas no cliente (D12): valor exato em centavos, uma por mês,
 * com competência de fatura (snapshot) quando o cartão informa closing day.
 */
export function buildExpenseInstallments(params: {
  totalCents: number;
  count: number;
  startDate: string;
  closingDay?: number | null;
}): InstallmentInput[] {
  const plano = parcelar(params.totalCents, params.count, parseISO(params.startDate));
  return plano.map((parcela) => ({
    date: parcela.date,
    value: parcela.valueCents / 100,
    billCompetence:
      params.closingDay != null ? resolveBillCompetence(parseISO(parcela.date), params.closingDay) : null,
  }));
}
