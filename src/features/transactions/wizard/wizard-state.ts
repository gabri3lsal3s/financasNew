/**
 * Estado e lógica pura do wizard de lançamento (D10 — tela cheia guiada).
 * Derivados calculados aqui (D12): parcelas em centavos + competência
 * snapshot quando cartão. O servidor valida invariantes (soma = total, 1–60).
 */
import { z } from "zod";
import { parcelar, toISODate } from "@/domain/money";
import { divideIntoInstallments } from "@/domain/cards";
import { cleanTextSchema, moneyCentsSchema } from "@/domain/validation";
import type { RecurrenceFrequency, RecurrenceRule } from "@/domain/recurrences";
import type { DebtType, InstallmentInput, PaymentMethod, ReceiveType } from "@/types";


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
}

export const WIZARD_STEPS = ["Valor", "Categoria", "Detalhes", "Revisão"] as const;

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
  };
  return overrides ? { ...base, ...overrides } : base;
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

import { formatCentsAsBRL } from "@/services/masks";

export function reportWeightLabel(weight: number, baseValueCents?: number): string {
  if (weight === 1) return "100% (conta integralmente)";
  if (weight === 0) return "Não conta nos relatórios";
  if (weight === 0.75 || weight === 0.5 || weight === 0.25) return `${Math.round(weight * 100)}%`;
  if (baseValueCents != null && baseValueCents > 0) {
    const customCents = Math.round(baseValueCents * weight);
    const formatted = formatCentsAsBRL(customCents);
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

export const step1ValueSchema = z.object({
  type: z.enum(["expense", "income"]),
  valueCents: moneyCentsSchema(),
  installments: z
    .number()
    .int()
    .min(1, "O número mínimo de parcelas é 1.")
    .max(60, "O número máximo de parcelas é 60."),
});

export const step2CategorySchema = z.object({
  categoryId: cleanTextSchema(50, { min: 1, requiredMessage: "Selecione uma categoria." }),
});

export const step3DetailsSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    date: z.string().min(1, "Informe a data do lançamento."),
    paymentMethod: z.enum(["cash", "debit", "credit_card", "pix", "transfer", "other"]),
    cardId: z.string().nullable(),
    receiveType: z.enum(["cash", "pix", "transfer", "other"]),
    description: cleanTextSchema(255).default(""),
    reportWeight: z.number(),
    reportCustomAmountCents: moneyCentsSchema({ allowZero: true }),
    debtEnabled: z.boolean(),
    debtType: z.enum(["payable", "receivable"]),
    debtAmountCents: moneyCentsSchema({ allowZero: true }),
    debtDueDate: z.string(),
    recurring: z.boolean(),
    recurrenceFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    recurrenceEndMode: z.enum(["date", "count"]),
    recurrenceEndDate: z.string(),
    recurrenceCount: z.number().int(),
    valueCents: moneyCentsSchema({ allowZero: true }),
  })
  .superRefine((data, ctx) => {
    if (data.type === "expense" && data.paymentMethod === "credit_card" && (!data.cardId || data.cardId.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardId"],
        message: "Selecione o cartão de crédito.",
      });
    }
    if (data.debtEnabled && data.debtAmountCents <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debtAmountCents"],
        message: "O valor da cobrança vinculada deve ser maior que zero.",
      });
    }
    if (data.recurring) {
      if (data.recurrenceEndMode === "date" && !data.recurrenceEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrenceEndDate"],
          message: "Informe a data de fim da recorrência.",
        });
      }
      if (data.recurrenceEndMode === "count" && data.recurrenceCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrenceCount"],
          message: "O número de ocorrências deve ser ao menos 1.",
        });
      }
    }
    if (!isPresetWeight(data.reportWeight)) {
      if (data.reportCustomAmountCents < 0 || data.reportCustomAmountCents > data.valueCents) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reportCustomAmountCents"],
          message: "O valor considerado no relatório deve ser entre zero e o valor total do lançamento.",
        });
      }
    }
  });

export const launchStateSchema = z
  .object({
    step: z.number().int().min(1).max(4),
    type: z.enum(["expense", "income"]),
    valueCents: moneyCentsSchema(),
    installments: z.number().int().min(1).max(60),
    categoryId: cleanTextSchema(50, { min: 1, requiredMessage: "Selecione uma categoria." }),
    date: z.string().min(1, "Informe a data do lançamento."),
    paymentMethod: z.enum(["cash", "debit", "credit_card", "pix", "transfer", "other"]),
    cardId: z.string().nullable(),
    receiveType: z.enum(["cash", "pix", "transfer", "other"]),
    description: cleanTextSchema(255).default(""),
    reportWeight: z.number(),
    reportCustomAmountCents: moneyCentsSchema({ allowZero: true }),
    debtEnabled: z.boolean(),
    debtType: z.enum(["payable", "receivable"]),
    debtAmountCents: moneyCentsSchema({ allowZero: true }),
    debtDueDate: z.string(),
    recurring: z.boolean(),
    recurrenceFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    recurrenceEndMode: z.enum(["date", "count"]),
    recurrenceEndDate: z.string(),
    recurrenceCount: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "expense" && data.paymentMethod === "credit_card" && (!data.cardId || data.cardId.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardId"],
        message: "Selecione o cartão de crédito.",
      });
    }
    if (data.debtEnabled && data.debtAmountCents <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debtAmountCents"],
        message: "O valor da cobrança vinculada deve ser maior que zero.",
      });
    }
    if (data.recurring) {
      if (data.recurrenceEndMode === "date" && !data.recurrenceEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrenceEndDate"],
          message: "Informe a data de fim da recorrência.",
        });
      }
      if (data.recurrenceEndMode === "count" && data.recurrenceCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrenceCount"],
          message: "O número de ocorrências deve ser ao menos 1.",
        });
      }
    }
    if (!isPresetWeight(data.reportWeight)) {
      if (data.reportCustomAmountCents < 0 || data.reportCustomAmountCents > data.valueCents) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reportCustomAmountCents"],
          message: "O valor considerado no relatório deve ser entre zero e o valor total do lançamento.",
        });
      }
    }
  });

export function validateLaunchStep(
  state: LaunchState,
  step: number,
): { success: boolean; error?: string } {
  if (step === 1) {
    const res = step1ValueSchema.safeParse(state);
    return res.success ? { success: true } : { success: false, error: res.error.issues[0]?.message };
  }
  if (step === 2) {
    const res = step2CategorySchema.safeParse(state);
    return res.success ? { success: true } : { success: false, error: res.error.issues[0]?.message };
  }
  if (step === 3) {
    const res = step3DetailsSchema.safeParse(state);
    return res.success ? { success: true } : { success: false, error: res.error.issues[0]?.message };
  }
  return { success: true };
}

/** Pode avançar do passo atual (validações por etapa com Zod). */
export function canProceed(state: LaunchState): boolean {
  return validateLaunchStep(state, state.step).success;
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
 * prévia (revisão) e no envio ao RPC `create_recurrence`. Retorna null quando
 * o lançamento não é recorrente ou o fim por data ainda não foi informado.
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
 * Reutiliza divideIntoInstallments do domínio de cartões (DRY).
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
