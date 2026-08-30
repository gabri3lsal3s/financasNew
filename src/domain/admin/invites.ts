import type { AccessInvite, ModuleAccessLevel, SubscriptionTier } from "@/types";

/**
 * Gera um código de convite padronizado no formato PREFIX-XXXX-XXXX
 */
export function generateInviteCode(prefix = "GF"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem O, 0, I, 1 para evitar ambiguidades visuais
  let part1 = "";
  let part2 = "";

  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${prefix}-${part1}-${part2}`;
}

export interface InviteValidationResult {
  valid: boolean;
  reason?: string;
  target_tier?: SubscriptionTier;
  custom_trial_days?: number | null;
  module_grants?: Record<string, ModuleAccessLevel>;
  benefitDescription?: string;
}

/**
 * Gera um texto amigável descrevendo o benefício embutido no convite.
 */
export function getInviteBenefitDescription(invite: AccessInvite): string {
  if (invite.target_tier === "lifetime") {
    return "Convite VIP: Acesso Vitalício Total";
  }
  if (invite.target_tier === "pro_annual") {
    return "Convite VIP: Assinatura Pro Anual";
  }
  if (invite.target_tier === "pro_monthly") {
    return "Convite VIP: Assinatura Pro Mensal";
  }
  if (invite.custom_trial_days && invite.custom_trial_days > 0) {
    return `Teste Pro estendido por ${invite.custom_trial_days} dias`;
  }
  return "Teste Pro completo por 30 dias";
}

/**
 * Valida a elegibilidade de um convite de acesso
 */
export function validateInvite(
  invite: AccessInvite | null | undefined,
  userEmail?: string,
  now = new Date(),
): InviteValidationResult {
  if (!invite) {
    return { valid: false, reason: "Código de convite não encontrado." };
  }

  if (invite.is_revoked) {
    return { valid: false, reason: "Este convite foi revogado pela administração." };
  }

  if (invite.used_count >= invite.max_uses) {
    return { valid: false, reason: "Este convite já atingiu o limite máximo de usos." };
  }

  if (invite.expires_at) {
    const expiresAtDate = new Date(invite.expires_at);
    if (expiresAtDate < now) {
      return { valid: false, reason: "Este convite está expirado." };
    }
  }

  if (invite.target_email && userEmail) {
    if (invite.target_email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      return {
        valid: false,
        reason: `Este convite é exclusivo para o e-mail ${invite.target_email}.`,
      };
    }
  }

  return {
    valid: true,
    target_tier: invite.target_tier,
    custom_trial_days: invite.custom_trial_days,
    module_grants: invite.module_grants,
    benefitDescription: getInviteBenefitDescription(invite),
  };
}
