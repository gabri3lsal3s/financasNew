import { z } from "zod";
import { cleanTextSchema } from "@/domain/validation";

/**
 * Schema Zod para criação e edição de Categorias:
 * - Sanitiza nome, ícone e cor;
 * - Previne injeção HTML/XSS no cadastro de categorias;
 * - Valida escopo e modalidade familiar.
 */
export const categoryFormSchema = z.object({
  name: cleanTextSchema(60, { min: 1, requiredMessage: "Informe o nome da categoria." }),
  type: z.enum(["expense", "income"]),
  icon: cleanTextSchema(50).nullable().optional(),
  color: cleanTextSchema(30).nullable().optional(),
  is_family: z.boolean().default(false).optional(),
  scope: z.enum(["personal", "business", "both"]).optional(),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;
