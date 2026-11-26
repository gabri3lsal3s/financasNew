import { z } from "zod";
import { cleanTextSchema, moneyAmountSchema } from "@/domain/validation/sanitization";

/**
 * Schema Zod para criação e edição de Cartão de Crédito:
 * - Sanitiza nome, bandeira e cor;
 * - Limita limite de crédito contra overflow;
 * - Valida dias de fechamento e vencimento (1 a 31).
 */
export const creditCardFormSchema = z.object({
  name: cleanTextSchema(50, { min: 1, requiredMessage: "Informe o nome do cartão." }),
  brand: cleanTextSchema(30)
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  credit_limit: moneyAmountSchema({ allowZero: true })
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  closing_day: z
    .number({ message: "Informe o dia de fechamento." })
    .int("O dia de fechamento deve ser um número inteiro.")
    .min(1, "O dia de fechamento deve ser entre 1 e 31.")
    .max(31, "O dia de fechamento deve ser entre 1 e 31."),
  due_day: z
    .number({ message: "Informe o dia de vencimento." })
    .int("O dia de vencimento deve ser um número inteiro.")
    .min(1, "O dia de vencimento deve ser entre 1 e 31.")
    .max(31, "O dia de vencimento deve ser entre 1 e 31."),
  color: cleanTextSchema(30)
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  is_active: z.boolean().default(true),
  last_four_digits: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (!val) return null;
      const digitsOnly = val.replace(/\D/g, "");
      return digitsOnly.length > 0 ? digitsOnly : null;
    })
    .refine((val) => val === null || val.length === 4, {
      message: "Os últimos dígitos devem conter exatamente 4 números.",
    }),
  scope: z.enum(["personal", "business", "mixed"]).optional(),
});

export type CreditCardFormInput = z.infer<typeof creditCardFormSchema>;

/**
 * Schema Zod para pagamento e estorno de fatura de cartão:
 */
export const cardPaymentInputSchema = z.object({
  cardId: z.string().min(1, "Selecione o cartão de crédito."),
  competenceMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida (formato AAAA-MM)."),
  amount: moneyAmountSchema({ minMessage: "O valor do pagamento deve ser maior que zero." }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (formato AAAA-MM-DD)."),
  note: cleanTextSchema(255).nullable().optional(),
});

export type CardPaymentInput = z.infer<typeof cardPaymentInputSchema>;
