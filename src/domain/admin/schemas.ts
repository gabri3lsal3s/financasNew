import { z } from "zod";
import { SUBSCRIPTION_TIERS } from "@/types";

export const createModularInviteSchema = z.object({
  code: z
    .string()
    .min(3, "O código deve ter pelo menos 3 caracteres.")
    .max(50, "O código não pode ultrapassar 50 caracteres.")
    .regex(/^[A-Za-z0-9_-]+$/, "Código contém caracteres inválidos."),
  target_tier: z.enum(SUBSCRIPTION_TIERS).default("trial"),
  custom_trial_days: z.number().int().positive("Número de dias deve ser positivo.").nullable().optional(),
  max_uses: z.number().int().positive("Limite de usos deve ser pelo menos 1.").default(1),
  expires_at: z.string().datetime().nullable().optional(),
  target_email: z.string().email("E-mail inválido.").nullable().optional().or(z.literal("")),
  notes: z.string().max(500, "Notas não podem ultrapassar 500 caracteres.").nullable().optional(),
  module_grants: z.record(z.string(), z.enum(["none", "read", "write", "admin"])).default({}),
});

export type CreateModularInviteInput = z.infer<typeof createModularInviteSchema>;

export const adminSetSubscriptionSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido."),
  planId: z.string().min(1, "Plano obrigatório."),
  tier: z.enum(SUBSCRIPTION_TIERS),
  status: z.enum(["trialing", "active", "past_due", "canceled", "read_only_expired"]),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
});

export type AdminSetSubscriptionInput = z.infer<typeof adminSetSubscriptionSchema>;
