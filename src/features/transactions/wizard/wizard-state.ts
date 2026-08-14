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
  /** Texto cru do percentual personalizado (ex.: "37,5") — vazio = não usado. */
  reportWeightCustom: string;
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
    reportWeightCustom: "",
    debtEnabled: false,
    debtAmountCents: 0,
    debtDueDate: "",
  };
}

/* ------------------------------------------------------------------
   PESO NO RELATÓRIO — percentuais pré-definidos + valor personalizado
   (0–100). O peso persistido é a fração 0–1 (invariante do schema).
   ------------------------------------------------------------------ */

export const REPORT_WEIGHT_PRESETS = [1, 0.75, 0.5, 0.25, 0] as const;

/**
 * Valor sentinela que marca "peso personalizado em edição" no estado.
 * Não é um preset válido — o percentual digitado só vira peso via
 * `effectiveReportWeight` (e `canProceed` bloqueia até ser válido).
 */
export const CUSTOM_WEIGHT_VALUE = -1;

/** Peso é um dos valores pré-definidos (Select mostra o preset). */
export function isPresetWeight(weight: number): boolean {
  return (REPORT_WEIGHT_PRESETS as readonly number[]).includes(weight);
}

/**
 * Converte texto pt-BR de percentual em número 0–100: aceita vírgula ou
 * ponto decimal e sufixo "%" ("37,5" · "37.5" · "37%"). Retorna null se
 * não for um número finito.
 */
export function parsePercentInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/%$/, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Percentual válido (0–100) — peso 0–1 é a invariante do schema. */
export function isValidPercent(percent: number): boolean {
  return Number.isFinite(percent) && percent >= 0 && percent <= 100;
}

/** Percentual (0–100) → peso (0–1). */
export function percentToWeight(percent: number): number {
  return percent / 100;
}

/** Peso (0–1) → texto pt-BR do percentual ("37,5"). */
export function weightToPercentText(weight: number): string {
  return String(weight * 100).replace(".", ",");
}

/** Rótulo do peso para a revisão (presets com texto amigável; custom em %). */
export function reportWeightLabel(weight: number): string {
  if (weight === 1) return "100% (conta integralmente)";
  if (weight === 0) return "Não conta nos relatórios";
  if (weight === 0.75 || weight === 0.5 || weight === 0.25) return `${Math.round(weight * 100)}%`;
  return `${weightToPercentText(weight)}%`;
}

/**
 * Peso efetivo para persistência: presets são usados direto; peso personalizado
 * resolve o percentual digitado (0–100 → fração 0–1, invariante do schema).
 * O fallback 0 é apenas defensivo — `canProceed` já exige percentual válido.
 */
export function effectiveReportWeight(state: LaunchState): number {
  if (isPresetWeight(state.reportWeight)) return state.reportWeight;
  const percent = parsePercentInput(state.reportWeightCustom);
  return percent !== null && isValidPercent(percent) ? percentToWeight(percent) : 0;
}

/** Pode avançar do passo atual (validações por etapa). */
export function canProceed(state: LaunchState): boolean {
  if (state.step === 1) return state.valueCents > 0;
  if (state.step === 2) return state.categoryId !== "";
  if (state.step === 3) {
    if (!state.date) return false;
    if (state.type === "expense" && state.paymentMethod === "credit_card" && !state.cardId) return false;
    if (state.debtEnabled && state.debtAmountCents <= 0) return false;
    // Peso personalizado: exige percentual válido (0–100).
    if (!isPresetWeight(state.reportWeight)) {
      const percent = parsePercentInput(state.reportWeightCustom);
      if (percent === null || !isValidPercent(percent)) return false;
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
