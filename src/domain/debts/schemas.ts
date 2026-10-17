import { z } from "zod";
import { cleanTextSchema, moneyAmountSchema } from "@/domain/validation";

/**
 * Schema Zod para criação e edição de Dívidas / Cobranças (Empréstimos, Contas a Pagar/Receber):
 * - Sanitiza nome do credor/devedor e observações;
 * - Limita valor monetário contra overflow.
 */
export const debtInputSchema = z
  .object({
    name: cleanTextSchema(100, { min: 1 }).optional(),
    personName: cleanTextSchema(100, { min: 1 }).optional(),
    type: z.enum(["payable", "receivable"], { message: "Tipo inválido (deve ser a pagar ou a receber)." }),
    amount: moneyAmountSchema({ minMessage: "O valor da pendência deve ser maior que zero." }),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida (formato AAAA-MM-DD).")
      .optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida (formato AAAA-MM-DD).")
      .optional(),
    notes: cleanTextSchema(500).nullable().optional(),
    paid_at: z.string().nullable().optional(),
    interestRate: z
      .number({ message: "Informe uma taxa de juros válida." })
      .min(0, "A taxa de juros não pode ser negativa.")
      .max(100, "A taxa de juros não pode ultrapassar 100% ao mês.")
      .nullable()
      .optional(),
    finePercent: z
      .number({ message: "Informe uma alíquota de multa válida." })
      .min(0, "A multa não pode ser negativa.")
      .max(100, "A multa não pode ultrapassar 100%.")
      .nullable()
      .optional(),
  })
  .refine((data) => Boolean(data.name || data.personName), {
    message: "Informe o nome da pessoa ou entidade.",
    path: ["personName"],
  })
  .refine((data) => Boolean(data.due_date || data.dueDate), {
    message: "Data de vencimento inválida (formato AAAA-MM-DD).",
    path: ["dueDate"],
  })
  .transform((data) => {
    const finalName = (data.name ?? data.personName)!;
    const finalDueDate = (data.due_date ?? data.dueDate)!;
    return {
      ...data,
      name: finalName,
      personName: finalName,
      due_date: finalDueDate,
      dueDate: finalDueDate,
    };
  });

export type DebtInput = z.infer<typeof debtInputSchema>;

/**
 * Schema Zod para liquidação / baixa de Dívida:
 */
export const debtSettlementSchema = z
  .object({
    debtId: z.string().min(1, "Selecione a dívida a ser liquidada.").optional(),
    debt_id: z.string().min(1, "Selecione a dívida a ser liquidada.").optional(),
    amount: moneyAmountSchema({ minMessage: "O valor da liquidação deve ser maior que zero." }),
    paidAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de quitação inválida (formato AAAA-MM-DD).")
      .optional(),
    paid_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de quitação inválida (formato AAAA-MM-DD).")
      .optional(),
  })
  .refine((data) => Boolean(data.debtId || data.debt_id), {
    message: "Selecione a dívida a ser liquidada.",
    path: ["debtId"],
  })
  .refine((data) => Boolean(data.paidAt || data.paid_at), {
    message: "Data de quitação inválida (formato AAAA-MM-DD).",
    path: ["paidAt"],
  })
  .transform((data) => {
    const finalDebtId = (data.debtId ?? data.debt_id)!;
    const finalPaidAt = (data.paidAt ?? data.paid_at)!;
    return {
      debtId: finalDebtId,
      debt_id: finalDebtId,
      amount: data.amount,
      paidAt: finalPaidAt,
      paid_at: finalPaidAt,
    };
  });

export type DebtSettlementInput = z.infer<typeof debtSettlementSchema>;
