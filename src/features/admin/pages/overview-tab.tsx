import { Check, Clock, KeyRound, Shield, UserCheck, Users, X } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import {
  useAdminMetrics,
  useAdminUpdateUserStatus,
  useAdminUsers,
} from "@/state";

export function OverviewTab() {
  const metricsQuery = useAdminMetrics();
  const pendingUsersQuery = useAdminUsers({ status: "pending_approval", limit: 10 });
  const updateStatusMutation = useAdminUpdateUserStatus();

  const metrics = metricsQuery.data;
  const pendingUsers = pendingUsersQuery.data ?? [];

  const handleApprove = (userId: string) => {
    updateStatusMutation.mutate({
      userId,
      status: "active",
    });
  };

  const handleReject = (userId: string) => {
    updateStatusMutation.mutate({
      userId,
      status: "banned",
      reason: "Cadastro recusado pela administração.",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Grade de KPIs Executivos do SaaS */}
      <section aria-label="Métricas do SaaS" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total de Usuários</span>
            <Users className="size-4 text-primary-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-foreground">{metrics?.total_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Contas Ativas</span>
            <UserCheck className="size-4 text-positive-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-positive-strong">{metrics?.active_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Fila de Aprovação</span>
            <Clock className="size-4 text-warning" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-warning">{metrics?.pending_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Suspensos / Banidos</span>
            <Shield className="size-4 text-critical" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-critical">{metrics?.suspended_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Convites Criados</span>
            <KeyRound className="size-4 text-portfolio" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-foreground">{metrics?.total_invites ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Convites Usados</span>
            <KeyRound className="size-4 text-positive-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-xl font-bold font-display text-positive-strong">{metrics?.used_invites ?? 0}</span>
          )}
        </div>
      </section>

      {/* Fila Rápida de Aprovação */}
      <section aria-label="Fila de Aprovação" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-warning" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Fila de Aprovação Imediata</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {pendingUsers.length} aguardando liberação
          </span>
        </div>

        {pendingUsersQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : pendingUsers.length === 0 ? (
          <EmptyState
            title="Nenhum cadastro pendente"
            description="Todos os usuários que se cadastraram foram avaliados ou ativados via convite."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                  <th className="py-2.5 px-3">Nome / E-mail</th>
                  <th className="py-2.5 px-3">Data de Cadastro</th>
                  <th className="py-2.5 px-3 text-right">Ação Imediata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover/30">
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{user.name || "Sem nome"}</span>
                        <span className="font-mono text-muted-foreground text-[11px]">{user.email}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(user.id)}
                          disabled={updateStatusMutation.isPending}
                          className="gap-1 text-xs"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(user.id)}
                          disabled={updateStatusMutation.isPending}
                          className="gap-1 text-xs"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                          Recusar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
