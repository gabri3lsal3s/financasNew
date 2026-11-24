import { parcelar, toISODate } from "@/domain/money";
import { divideIntoInstallments } from "@/domain/cards";
import type { RecurrenceRule } from "@/domain/recurrences";
import type { InstallmentInput } from "@/types";
import { effectiveReportWeight } from "./wizard-schemas";
import type { EntryType, LaunchState, WizardMode } from "./wizard-types";

export function defaultLaunchState(
  type: EntryType = "expense",
  overrides?: Partial<LaunchState>,
): LaunchState {
  const base: LaunchState = {
    step: overrides?.valueCents && overrides.valueCents > 0 ? 2 : 1,
    type,
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
    debtType: "payable",
    debtAmountCents: 0,
    debtDueDate: "",
    recurring: false,
    recurrenceFrequency: "monthly",
    recurrenceEndMode: "date",
    recurrenceEndDate: "",
    recurrenceCount: 12,
    isFamily: overrides?.isFamily ?? false,
    splitEnabled: overrides?.splitEnabled ?? false,
    splitPeopleCount: overrides?.splitPeopleCount ?? 2,
    tripId: overrides?.tripId ?? null,
    splitDebtMode: overrides?.splitDebtMode ?? "single_total",
    chargeKind: overrides?.chargeKind ?? "regular",
    scope: overrides?.scope ?? "personal",
    isTaxDeductible: overrides?.isTaxDeductible ?? false,
    taxWithheldCents: overrides?.taxWithheldCents ?? 0,
    splitPFPJEnabled: overrides?.splitPFPJEnabled ?? false,
    splitPFPJBusinessPercent: overrides?.splitPFPJBusinessPercent ?? 50,
  };
  return overrides ? { ...base, ...overrides } : base;
}

const parseISO = (iso: string): Date => new Date(`${iso}T00:00:00`);

/** Parcelas de renda (D12) — mesmas regras das despesas, sem competência. */
export function buildIncomeInstallments(params: {
  totalCents: number;
  count: number;
  startDate: string;
}): InstallmentInput[] {
  const plano = parcelar(params.totalCents, params.count, parseISO(params.startDate));
  return plano.map((parcela) => ({ date: parcela.date, value: parcela.valueCents / 100 }));
}

/**
 * Regra de recorrência derivada do estado do wizard (Fase 32) — usada na
 * prévia (revisão) e no envio ao RPC `create_recurrence`.
 */
export function recurrenceRuleFromLaunchState(state: LaunchState, id = "preview"): RecurrenceRule | null {
  if (!state.recurring) return null;
  if (state.recurrenceEndMode === "date" && !state.recurrenceEndDate) return null;
  return {
    id,
    kind: state.type,
    frequency: state.recurrenceFrequency,
    valueCents: state.valueCents,
    startDate: state.date,
    endDate: state.recurrenceEndMode === "date" ? state.recurrenceEndDate : null,
    occurrencesTotal: state.recurrenceEndMode === "count" ? state.recurrenceCount : null,
    reportWeight: effectiveReportWeight(state),
    isActive: true,
  };
}

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
  const items = divideIntoInstallments(params);
  return items.map((item) => ({
    date: item.date,
    value: item.valueCents / 100,
    billCompetence: item.billCompetence,
  }));
}

export const WIZARD_PREFERENCE_STORAGE_KEY = "axir_wizard_preferred_mode";

export function getStoredWizardMode(): WizardMode | null {
  try {
    if (typeof window === "undefined") return null;
    const val = window.localStorage.getItem(WIZARD_PREFERENCE_STORAGE_KEY);
    if (val === "quick" || val === "guided") return val;
    return null;
  } catch {
    return null;
  }
}

export function setStoredWizardMode(mode: WizardMode): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WIZARD_PREFERENCE_STORAGE_KEY, mode);
    }
  } catch {
    // no-op
  }
}
