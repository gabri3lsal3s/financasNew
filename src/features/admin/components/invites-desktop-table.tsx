import { Copy, Crown, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { getInviteBenefitDescription } from "@/domain/admin";
import { formatDateBR } from "@/lib/date";
import type { InvitesListProps } from "./invites-mobile-list";
import { resolveInviteStatusBadge } from "./invite-status-utils";

/**
 * Tabela densificada de convites de acesso para tablets e desktop (>= sm)
 * com contêiner de rolagem horizontal desobstruída.
 */
export function InvitesDesktopTable({
  invites,
  isRevoking,
  onCopyLink,
  onRequestRevoke,
}: InvitesListProps) {
  return (
    <div className="hidden sm:block overflow-x-auto no-scrollbar scroll-smooth w-full">
      <table className="w-full min-w-[640px] text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-surface-raised text-muted-foreground font-medium">
            <th className="py-3 px-4">Código</th>
            <th className="py-3 px-4">Plano / Benefício</th>
            <th className="py-3 px-4">Usos</th>
            <th className="py-3 px-4">Restrição</th>
            <th className="py-3 px-4">Validade</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {invites.map((invite) => {
            const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
            const isExhausted = invite.used_count >= invite.max_uses;
            const benefit = getInviteBenefitDescription(invite);
            const status = resolveInviteStatusBadge(invite, isExpired, isExhausted);

            return (
              <tr key={invite.id} className="hover:bg-surface-hover/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">{invite.code}</span>
                    {invite.target_tier === "lifetime" && (
                      <Crown className="size-3.5 text-portfolio" aria-hidden="true" />
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 max-w-[200px]">
                  <span className="font-medium text-foreground truncate block" title={benefit}>
                    {benefit}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="tabular-nums">
                    <strong>{invite.used_count}</strong> / {invite.max_uses}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {invite.target_email || "Livre"}
                </td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {invite.expires_at ? formatDateBR(invite.expires_at) : "Permanente"}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <Badge variant={status.variant} size="xs" className="max-w-full truncate inline-block">
                    {status.label}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      sensoryIntent={false}
                      onClick={() => onCopyLink(invite.code)}
                      disabled={invite.is_revoked || isExpired || isExhausted}
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
