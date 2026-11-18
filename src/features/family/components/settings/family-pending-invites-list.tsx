import { Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { getPublicShareUrl } from "@/services/app-url";
import type { FamilyInvite } from "@/types";

export interface FamilyPendingInvitesListProps {
  invites: FamilyInvite[];
  copiedToken: string | null;
  revokePending: boolean;
  onCopyLink: (url: string, token: string) => void;
  onRequestRevokeInvite: (invite: FamilyInvite) => void;
}

export function FamilyPendingInvitesList({
  invites,
  copiedToken,
  revokePending,
  onCopyLink,
  onRequestRevokeInvite,
}: FamilyPendingInvitesListProps) {
  if (invites.length === 0) return null;

  return (
    <div className="pt-3 border-t border-border/80 space-y-2">
      <span className="text-xs font-semibold text-foreground block">
        Convites Pendentes ({invites.length})
      </span>
      <div className="space-y-2">
        {invites.map((inv) => {
          const url = getPublicShareUrl(`convite-familiar/${inv.token}`);
          const emailLabel = inv.invited_email ?? "participante";
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/80 bg-muted/20 text-xs"
            >
              <span className="text-foreground truncate">{inv.invited_email ?? "Sem e-mail"}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent={false}
                  onClick={() => onCopyLink(url, inv.token)}
                  className="gap-1 rounded-md"
                >
                  {copiedToken === inv.token ? (
                    <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  <span>Link</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestRevokeInvite(inv)}
                  disabled={revokePending}
                  className="text-critical-strong hover:bg-critical/10 rounded-md"
                  title="Revogar convite"
                  aria-label={`Revogar convite de ${emailLabel}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
