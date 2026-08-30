import { useState } from "react";
import { Copy, Crown, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Skeleton, Badge } from "@/components/ui";
import { getInviteBenefitDescription } from "@/domain/admin";
import { useAdminInvites, useAdminRevokeInvite } from "@/state";
import { CreateInviteDialog } from "../components";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export function InvitesTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const invitesQuery = useAdminInvites();
  const revokeMutation = useAdminRevokeInvite();

  const invites = invitesQuery.data ?? [];

  const handleCopyLink = async (code: string) => {
    const link = `${window.location.origin}/criar-conta?convite=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      triggerSensory("action");
      pushToast({
        title: "Link de cadastro copiado",
        description: "O link com o código de convite embutido foi copiado.",
        variant: "default",
      });
    } catch {
      // no-op
    }
  };

  const handleRevoke = (inviteId: string) => {
    triggerSensory("destructive");
    revokeMutation.mutate({ inviteId });
  };

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      {/* Cabeçalho com Ação de Criar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all hover:border-border">
        <div className="flex items-center gap-3.5 min-w-0">
          <KeyRound className="size-5 text-portfolio shrink-0" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate">Gestão de Convites &amp; Allowlist</span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              Cadastros com convite válido são ativados automaticamente na plataforma com planos pré-configurados.
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={() => {
            triggerSensory("selection");
            setCreateOpen(true);
          }}
          className="gap-2 w-full sm:w-auto justify-center shrink-0 h-9"
        >
          <Plus className="size-4" aria-hidden="true" />
          Gerar Novo Convite
        </Button>
      </div>

      {/* Lista / Tabela de Convites com Layout Adaptativo */}
      <div className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        {invitesQuery.isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : invites.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum convite gerado"
              description="Clique em 'Gerar Novo Convite' para criar o primeiro código da allowlist."
            />
          </div>
        ) : (
          <>
            {/* Visualização em Cards para Mobile */}
            <div className="flex flex-col divide-y divide-border/60 sm:hidden">
              {invites.map((invite) => {
                const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
                const isExhausted = invite.used_count >= invite.max_uses;
                const benefit = getInviteBenefitDescription(invite);
                const hasModuleGrants = invite.module_grants && Object.keys(invite.module_grants).length > 0;

                return (
                  <div key={invite.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">{invite.code}</span>
                          {invite.target_tier === "lifetime" && (
                            <Crown className="size-3.5 text-portfolio" aria-hidden="true" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          Usos: <strong className="text-foreground">{invite.used_count}</strong> de {invite.max_uses}
                        </span>
                      </div>

                      <Badge
                        variant={
                          invite.is_revoked
                            ? "critical"
                            : isExpired
                              ? "warning"
                              : isExhausted
                                ? "muted"
                                : "positive"
                        }
                        size="xs"
                      >
                        {invite.is_revoked
                          ? "Revogado"
                          : isExpired
                            ? "Expirado"
                            : isExhausted
                              ? "Esgotado"
                              : "Disponível"}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-1 border-t border-border/60">
                      <div className="flex justify-between items-center">
                        <span>Plano / Benefício:</span>
                        <span className="text-foreground font-semibold text-[11px] text-right truncate max-w-[200px]">
                          {benefit}
                        </span>
                      </div>
                      {hasModuleGrants && (
                        <div className="flex justify-between items-center">
                          <span>Módulos Customizados:</span>
                          <span className="text-primary font-medium text-[11px]">
                            {Object.keys(invite.module_grants || {}).length} regras
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Restrição:</span>
                        <span className="text-foreground font-medium truncate max-w-[200px]">
                          {invite.target_email || "Qualquer e-mail"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Validade:</span>
                        <span className="text-foreground font-medium">
                          {invite.expires_at
                            ? new Date(invite.expires_at).toLocaleDateString("pt-BR")
                            : "Permanente"}
                        </span>
                      </div>
                      {invite.notes && (
                        <div className="flex justify-between">
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
                        onClick={() => handleCopyLink(invite.code)}
                        disabled={invite.is_revoked || isExpired || isExhausted}
                        className="flex-1 gap-1.5 text-xs h-8 justify-center"
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
                  </div>
                );
              })}
            </div>

            {/* Visualização em Tabela para Tablets e Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-medium">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Plano / Benefício</th>
                    <th className="py-3 px-4">Usos</th>
                    <th className="py-3 px-4">Restrição</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invites.map((invite) => {
                    const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
                    const isExhausted = invite.used_count >= invite.max_uses;
                    const benefit = getInviteBenefitDescription(invite);

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
                          {invite.expires_at
                            ? new Date(invite.expires_at).toLocaleDateString("pt-BR")
                            : "Permanente"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant={
                              invite.is_revoked
                                ? "critical"
                                : isExpired
                                  ? "warning"
                                  : isExhausted
                                    ? "muted"
                                    : "positive"
                            }
                            size="xs"
                          >
                            {invite.is_revoked
                              ? "Revogado"
                              : isExpired
                                ? "Expirado"
                                : isExhausted
                                  ? "Esgotado"
                                  : "Disponível"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(invite.code)}
                              disabled={invite.is_revoked || isExpired || isExhausted}
                              className="gap-1 text-xs h-7 px-2"
                            >
                              <Copy className="size-3" aria-hidden="true" />
                              Copiar Link
                            </Button>
                            {!invite.is_revoked ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRevoke(invite.id)}
                                disabled={revokeMutation.isPending}
                                className="size-7 p-0"
                                title="Revogar convite"
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
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
          </>
        )}
      </div>

      {/* Modal de Criação de Convite */}
      <CreateInviteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
