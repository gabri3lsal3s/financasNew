import { z } from "zod";
import { cleanTextSchema, moneyAmountSchema } from "@/domain/validation";

/**
 * Schema Zod para definição individual de teto de orçamento por categoria:
 */
export const budgetLimitInputSchema = z
  .object({
    categoryId: cleanTextSchema(50, { min: 1, requiredMessage: "Selecione a categoria." }),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Mês de competência inválido (formato AAAA-MM)."),
    amount: moneyAmountSchema({ allowZero: true }).optional(),
    limit: moneyAmountSchema({ allowZero: true }).optional(),
  })
  .refine((data) => data.amount !== undefined || data.limit !== undefined, {
    message: "Informe um valor de limite válido.",
    path: ["amount"],
  })
  .transform((data) => {
    const val = (data.limit ?? data.amount)!;
    return {
      categoryId: data.categoryId,
      month: data.month,
      amount: val,
      limit: val,
    };
  });

export type BudgetLimitInput = z.infer<typeof budgetLimitInputSchema>;

/**
 * Schema Zod para atualização em lote de limites orçamentários:
 */
export const batchBudgetLimitsInputSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Mês de competência inválido (formato AAAA-MM)."),
  limits: z
    .array(
      z
        .object({
          categoryId: cleanTextSchema(50, { min: 1 }),
          amount: moneyAmountSchema({ allowZero: true }).optional(),
          limit: moneyAmountSchema({ allowZero: true }).optional(),
        })
        .refine((data) => data.amount !== undefined || data.limit !== undefined, {
          message: "Informe um valor de limite válido.",
          path: ["amount"],
        })
        .transform((data) => {
          const val = (data.limit ?? data.amount)!;
          return {
            categoryId: data.categoryId,
            amount: val,
            limit: val,
          };
        }),
    )
    .min(1, "A lista de limites não pode estar vazia."),
});

export type BatchBudgetLimitsInput = z.infer<typeof batchBudgetLimitsInputSchema>;
