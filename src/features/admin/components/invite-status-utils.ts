import type { AccessInvite } from "@/types";

export function resolveInviteStatusBadge(
  invite: AccessInvite,
  isExpired: boolean,
  isExhausted: boolean,
): { variant: "critical" | "warning" | "muted" | "positive"; label: string } {
  if (invite.is_revoked) return { variant: "critical", label: "Revogado" };
  if (isExpired) return { variant: "warning", label: "Expirado" };
  if (isExhausted) return { variant: "muted", label: "Esgotado" };
  return { variant: "positive", label: "Disponível" };
}
