import type { AccessInvite } from "@/types";

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

  return { valid: true };
}
