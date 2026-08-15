/**
 * Estado e lógica pura do wizard de lançamento (D10 — tela cheia guiada).
 * Derivados calculados aqui (D12): parcelas em centavos + competência
 * snapshot quando cartão. O servidor valida invariantes (soma = total, 1–60).
 */
import { parcelar, toISODate } from "@/domain/money";
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
  /** Valor em centavos considerado no relatório quando personalizado. */
  reportCustomAmountCents: number;
  debtEnabled: boolean;
  debtAmountCents: number;
  /** YYYY-MM-DD */
  debtDueDate: string;
}

export const WIZARD_STEPS = ["Valor", "Categoria", "Detalhes", "Revisão"] as const;

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
    reportCustomAmountCents: 0,
    debtEnabled: false,
    debtAmountCents: 0,
    debtDueDate: "",
  };
}

/* ------------------------------------------------------------------
   PESO NO RELATÓRIO — percentuais pré-definidos + valor personalizado
   em reais (calculado como fração 0–1 sobre o valor total do lançamento).
   ------------------------------------------------------------------ */

export const REPORT_WEIGHT_PRESETS = [1, 0.75, 0.5, 0.25, 0] as const;

/**
 * Valor sentinela que marca "peso personalizado em edição" no estado.
 * Não é um preset válido — o valor em centavos vira peso via
 * `effectiveReportWeight`.
 */
export const CUSTOM_WEIGHT_VALUE = -1;

/** Peso é um dos valores pré-definidos (Select mostra o preset). */
export function isPresetWeight(weight: number): boolean {
  return (REPORT_WEIGHT_PRESETS as readonly number[]).includes(weight);
}

/** Formata número como texto percentual ("37,5"). */
export function weightToPercentText(weight: number): string {
  const percent = Number((weight * 100).toFixed(2));
  return String(percent).replace(".", ",");
}

/** Rótulo do peso para a revisão (presets com texto amigável; custom em R$ e %). */
export function reportWeightLabel(weight: number, baseValueCents?: number): string {
  if (weight === 1) return "100% (conta integralmente)";
  if (weight === 0) return "Não conta nos relatórios";
  if (weight === 0.75 || weight === 0.5 || weight === 0.25) return `${Math.round(weight * 100)}%`;
  if (baseValueCents != null && baseValueCents > 0) {
    const customCents = Math.round(baseValueCents * weight);
    const formatted = (customCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `${formatted} (${weightToPercentText(weight)}% no relatório)`;
  }
  return `${weightToPercentText(weight)}%`;
}

/**
 * Peso efetivo para persistência: presets são usados direto; peso personalizado
 * calcula a fração real `reportCustomAmountCents / valueCents` (0–1).
 */
export function effectiveReportWeight(state: LaunchState): number {
  if (isPresetWeight(state.reportWeight)) return state.reportWeight;
  if (state.valueCents <= 0) return 1;
  const ratio = state.reportCustomAmountCents / state.valueCents;
  return Math.min(1, Math.max(0, Number(ratio.toFixed(4))));
}

/** Pode avançar do passo atual (validações por etapa). */
export function canProceed(state: LaunchState): boolean {
  if (state.step === 1) return state.valueCents > 0;
  if (state.step === 2) return state.categoryId !== "";
  if (state.step === 3) {
    if (!state.date) return false;
    if (state.type === "expense" && state.paymentMethod === "credit_card" && !state.cardId) return false;
    if (state.debtEnabled && state.debtAmountCents <= 0) return false;
    // Peso personalizado: exige valor válido maior ou igual a zero e menor/igual ao valor total.
    if (!isPresetWeight(state.reportWeight)) {
      if (state.reportCustomAmountCents < 0 || state.reportCustomAmountCents > state.valueCents) return false;
    }
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
