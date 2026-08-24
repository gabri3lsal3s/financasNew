import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { useAdminInvites, useAdminRevokeInvite } from "@/state";
import { CreateInviteDialog } from "../components";
import { pushToast } from "@/services/toast";

export function InvitesTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const invitesQuery = useAdminInvites();
  const revokeMutation = useAdminRevokeInvite();

  const invites = invitesQuery.data ?? [];

  const handleCopyLink = async (code: string) => {
    const link = `${window.location.origin}/criar-conta?convite=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      pushToast({
        title: "Link de cadastro copiado",
        description: "O link com o código de convite embutido foi copiado.",
        variant: "success",
      });
    } catch {
      // no-op
    }
  };

  const handleRevoke = (inviteId: string) => {
    revokeMutation.mutate({ inviteId });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho com Ação de Criar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-4 rounded-2xl border border-portfolio/30 bg-portfolio/5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate">Gestão de Convites &amp; Allowlist</span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              Cadastros com convite válido são ativados automaticamente.
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={() => setCreateOpen(true)}
          className="gap-2 w-full sm:w-auto justify-center shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          Gerar Novo Convite
        </Button>
      </div>

      {/* Tabela de Convites */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 shadow-xs overflow-hidden">
        {invitesQuery.isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : invites.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum convite gerado"
              description="Clique em 'Gerar Novo Convite' para criar o primeiro código da allowlist."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                  <th className="py-3 px-3.5 sm:px-4">Código</th>
                  <th className="py-3 px-3.5 sm:px-4">Usos</th>
                  <th className="py-3 px-3.5 sm:px-4">Restrição de E-mail</th>
                  <th className="py-3 px-3.5 sm:px-4">Validade</th>
                  <th className="py-3 px-3.5 sm:px-4">Status</th>
                  <th className="py-3 px-3.5 sm:px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invites.map((invite) => {
                  const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
                  const isExhausted = invite.used_count >= invite.max_uses;

                  return (
                    <tr key={invite.id} className="hover:bg-surface-hover/30">
                      <td className="py-3 px-3.5 sm:px-4 font-mono font-bold text-foreground whitespace-nowrap">
                        {invite.code}
                      </td>
                      <td className="py-3 px-3.5 sm:px-4 font-mono whitespace-nowrap">
                        {invite.used_count} / {invite.max_uses}
                      </td>
                      <td className="py-3 px-3.5 sm:px-4 text-muted-foreground">
                        <span className="truncate max-w-[180px] block">
                          {invite.target_email || "Qualquer e-mail"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 sm:px-4 text-muted-foreground whitespace-nowrap">
                        {invite.expires_at
                          ? new Date(invite.expires_at).toLocaleDateString("pt-BR")
                          : "Permanente"}
                      </td>
                      <td className="py-3 px-3.5 sm:px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            invite.is_revoked
                              ? "bg-critical/10 text-critical border border-critical/20"
                              : isExpired
                                ? "bg-warning/10 text-warning border border-warning/20"
                                : isExhausted
                                  ? "bg-surface-hover text-muted-foreground border border-border"
                                  : "bg-positive/10 text-positive-strong border border-positive/20"
                          }`}
                        >
                          {invite.is_revoked
                            ? "Revogado"
                            : isExpired
                              ? "Expirado"
                              : isExhausted
                                ? "Esgotado"
                                : "Disponível"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 sm:px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(invite.code)}
                            disabled={invite.is_revoked || isExpired || isExhausted}
                            className="gap-1 text-xs h-8 px-2.5"
                          >
                            <Copy className="size-3.5" aria-hidden="true" />
                            Copiar Link
                          </Button>
                          {!invite.is_revoked ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevoke(invite.id)}
                              disabled={revokeMutation.isPending}
                              className="size-8 p-0 shrink-0"
                              title="Revogar convite"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      <CreateInviteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
