import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, Skeleton } from "@/components/ui";
import { useAdminInvites, useAdminRevokeInvite } from "@/state";
import { CreateInviteDialog } from "../components";
import { InvitesMobileList } from "../components/invites-mobile-list";
import { InvitesDesktopTable } from "../components/invites-desktop-table";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getPublicAppUrl } from "@/services/app-url";
import type { AccessInvite } from "@/types";

export function InvitesTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AccessInvite | null>(null);
  const invitesQuery = useAdminInvites();
  const revokeMutation = useAdminRevokeInvite();

  const invites = invitesQuery.data ?? [];

  const handleCopyLink = async (code: string) => {
    const link = getPublicAppUrl(`criar-conta?convite=${code}`);
    try {
      await navigator.clipboard.writeText(link);
      triggerSensory("action");
      pushToast({
        title: "Link de cadastro copiado",
        description: "O link com o código de convite embutido foi copiado.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    const targetId = revokeTarget.id;
    setRevokeTarget(null);
    revokeMutation.mutate(
      { inviteId: targetId },
      {
        onSuccess: () => {
          pushToast({
            title: "Convite revogado",
            description: "O código foi desativado e não poderá mais ser utilizado.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-border/80 bg-surface shadow-xs">
        <div className="flex items-start gap-3 min-w-0">
          <KeyRound className="size-4.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate">
              Gestão de Convites &amp; Allowlist
            </span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              Cadastros com convite válido são ativados automaticamente na plataforma com planos pré-configurados.
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          size="sm"
          sensoryIntent="selection"
          onClick={() => setCreateOpen(true)}
          className="gap-2 w-full sm:w-auto justify-center shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Gerar Novo Convite</span>
        </Button>
      </div>

      {invitesQuery.isLoading ? (
        <div
          className="rounded-xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 divide-y divide-border/80"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28 sm:w-36 font-mono" />
                  <Skeleton className="h-3 w-36 sm:w-48" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : invites.length === 0 ? (
        <EmptyState
          title="Nenhum convite gerado"
          description="Clique em 'Gerar Novo Convite' para criar o primeiro código da allowlist."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <InvitesMobileList
            invites={invites}
            isRevoking={revokeMutation.isPending}
            onCopyLink={(code) => void handleCopyLink(code)}
            onRequestRevoke={setRevokeTarget}
          />
          <InvitesDesktopTable
            invites={invites}
            isRevoking={revokeMutation.isPending}
            onCopyLink={(code) => void handleCopyLink(code)}
            onRequestRevoke={setRevokeTarget}
          />
        </div>
      )}

      <CreateInviteDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revogar código de convite?"
        description={
          revokeTarget
            ? `O código ${revokeTarget.code} será desativado imediatamente e não poderá mais ser utilizado.`
            : undefined
        }
        confirmLabel="Revogar convite"
        variant="destructive"
        confirmPending={revokeMutation.isPending}
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}
