import { Copy, Crown, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { getInviteBenefitDescription } from "@/domain/admin";
import { formatDateBR } from "@/lib/date";
import type { AccessInvite } from "@/types";
import { resolveInviteStatusBadge } from "./invite-status-utils";

export interface InvitesListProps {
  invites: AccessInvite[];
  isRevoking: boolean;
  onCopyLink: (code: string) => void;
  onRequestRevoke: (invite: AccessInvite) => void;
}

/**
 * Cards mobile de convites de acesso (< sm).
 */
export function InvitesMobileList({
  invites,
  isRevoking,
  onCopyLink,
  onRequestRevoke,
}: InvitesListProps) {
  return (
    <div className="flex flex-col divide-y divide-border/80 sm:hidden">
      {invites.map((invite) => {
        const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
        const isExhausted = invite.used_count >= invite.max_uses;
        const benefit = getInviteBenefitDescription(invite);
        const hasModuleGrants = invite.module_grants && Object.keys(invite.module_grants).length > 0;
        const status = resolveInviteStatusBadge(invite, isExpired, isExhausted);

        return (
          <div key={invite.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">{invite.code}</span>
                  {invite.target_tier === "lifetime" && (
                    <Crown className="size-3.5 text-portfolio" aria-hidden="true" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Usos: <strong className="text-foreground">{invite.used_count}</strong> de{" "}
                  {invite.max_uses}
                </span>
              </div>

              <Badge variant={status.variant} size="xs" className="max-w-full truncate inline-block">
                {status.label}
              </Badge>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-1 border-t border-border/80">
              <div className="flex justify-between items-center gap-2">
                <span>Plano / Benefício:</span>
                <span className="text-foreground font-semibold text-[11px] text-right truncate max-w-[200px]">
                  {benefit}
                </span>
              </div>
              {hasModuleGrants && (
                <div className="flex justify-between items-center gap-2">
                  <span>Módulos Customizados:</span>
                  <span className="text-primary-strong font-medium text-[11px]">
                    {Object.keys(invite.module_grants || {}).length} regras
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span>Restrição:</span>
                <span className="text-foreground font-medium truncate max-w-[200px]">
                  {invite.target_email || "Qualquer e-mail"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Validade:</span>
                <span className="text-foreground font-medium">
                  {invite.expires_at ? formatDateBR(invite.expires_at) : "Permanente"}
                </span>
              </div>
              {invite.notes && (
                <div className="flex justify-between gap-2">
                  <span>Notas:</span>
                  <span className="text-muted-foreground italic truncate max-w-[200px]">
                    {invite.notes}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent={false}
                onClick={() => onCopyLink(invite.code)}
                disabled={invite.is_revoked || isExpired || isExhausted}
                className="flex-1 justify-center"
              >
                <Copy aria-hidden="true" />
                <span>Copiar Link</span>
              </Button>
              {!invite.is_revoked && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  sensoryIntent="selection"
                  onClick={() => onRequestRevoke(invite)}
                  disabled={isRevoking}
                  className="size-8 !w-8 !min-w-8 p-0 shrink-0"
                  title="Revogar convite"
                  aria-label={`Revogar convite ${invite.code}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
