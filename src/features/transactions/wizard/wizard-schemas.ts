import { z } from "zod";
import { cleanTextSchema, moneyCentsSchema } from "@/domain/validation";
import { formatCentsAsBRL } from "@/services/masks";
import type { LaunchState } from "./wizard-types";

export const REPORT_WEIGHT_PRESETS = [1, 0.75, 0.5, 0.25, 0] as const;

/** Valor sentinela que marca "peso personalizado em edição" no estado. */
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

/** Peso efetivo para persistência (racha usa 1 inicialmente; presets diretos; custom calcula fração). */
export function effectiveReportWeight(state: LaunchState): number {
  if (state.type === "expense" && state.splitEnabled) {
    return 1;
  }
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

const baseDetailsShape = {
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
  isFamily: z.boolean().default(false).optional(),
  tripId: z.string().nullable().optional(),
  splitDebtMode: z.enum(["single_total", "per_installment"]).default("single_total").optional(),
};

interface DetailsRefinementInput {
  type: "expense" | "income";
  paymentMethod: string;
  cardId: string | null;
  debtEnabled: boolean;
  debtAmountCents: number;
  recurring: boolean;
  recurrenceEndMode: "date" | "count";
  recurrenceEndDate: string;
  recurrenceCount: number;
  reportWeight: number;
  reportCustomAmountCents: number;
  valueCents: number;
}

function validateDetailsRefinements(data: DetailsRefinementInput, ctx: z.RefinementCtx): void {
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
}

export const step3DetailsSchema = z
  .object({
    ...baseDetailsShape,
    valueCents: moneyCentsSchema({ allowZero: true }),
  })
  .superRefine(validateDetailsRefinements);

export const launchStateSchema = z
  .object({
    step: z.number().int().min(1).max(4),
    valueCents: moneyCentsSchema(),
    installments: z.number().int().min(1).max(60),
    categoryId: cleanTextSchema(50, { min: 1, requiredMessage: "Selecione uma categoria." }),
    ...baseDetailsShape,
  })
  .superRefine(validateDetailsRefinements);

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
