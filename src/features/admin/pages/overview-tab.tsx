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
      <section aria-label="Métricas do SaaS" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Total de Usuários</span>
            <Users className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-foreground truncate">{metrics?.total_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Contas Ativas</span>
            <UserCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-positive-strong truncate">{metrics?.active_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Fila de Aprovação</span>
            <Clock className="size-4 text-warning shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-warning truncate">{metrics?.pending_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Suspensos / Banidos</span>
            <Shield className="size-4 text-critical shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-critical truncate">{metrics?.suspended_users ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Convites Criados</span>
            <KeyRound className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-foreground truncate">{metrics?.total_invites ?? 0}</span>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="truncate">Convites Usados</span>
            <KeyRound className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <span className="text-lg sm:text-xl font-bold font-display text-positive-strong truncate">{metrics?.used_invites ?? 0}</span>
          )}
        </div>
      </section>


      {/* Fila Rápida de Aprovação */}
      <section aria-label="Fila de Aprovação" className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-5 shadow-xs flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-warning shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Fila de Aprovação Imediata</h3>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {pendingUsers.length} aguardando
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
            <table className="w-full min-w-[520px] text-left text-xs border-collapse">
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
                      <div className="flex flex-col max-w-[220px]">
                        <span className="font-semibold text-foreground truncate">{user.name || "Sem nome"}</span>
                        <span className="font-mono text-muted-foreground text-[11px] truncate">{user.email}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(user.id)}
                          disabled={updateStatusMutation.isPending}
                          className="gap-1 text-xs h-8 px-2.5"
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
                          className="gap-1 text-xs h-8 px-2.5"
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
