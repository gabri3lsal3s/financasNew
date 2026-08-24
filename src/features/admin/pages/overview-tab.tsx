import { Check, Clock, KeyRound, Shield, UserCheck, Users, X } from "lucide-react";
import { Button, EmptyState, NumberTicker, Skeleton } from "@/components/ui";
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
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Grade de KPIs Executivos do SaaS com Grid Responsivo */}
      <section aria-label="Métricas do SaaS" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Total de Usuários */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Total de Usuários</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary-strong" aria-hidden="true">
              <Users className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_users ?? 0} />
            </div>
          )}
        </div>

        {/* Contas Ativas */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Contas Ativas</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 border border-positive/20 text-positive-strong" aria-hidden="true">
              <UserCheck className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.active_users ?? 0} />
            </div>
          )}
        </div>

        {/* Fila de Aprovação */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Fila de Aprovação</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning" aria-hidden="true">
              <Clock className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-warning sm:text-2xl">
              <NumberTicker value={metrics?.pending_users ?? 0} />
            </div>
          )}
        </div>

        {/* Suspensos / Banidos */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Suspensos / Banidos</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-critical/10 border border-critical/20 text-critical" aria-hidden="true">
              <Shield className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-critical sm:text-2xl">
              <NumberTicker value={metrics?.suspended_users ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Criados */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Criados</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio" aria-hidden="true">
              <KeyRound className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_invites ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Usados */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Usados</span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 border border-positive/20 text-positive-strong" aria-hidden="true">
              <KeyRound className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="num truncate text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.used_invites ?? 0} />
            </div>
          )}
        </div>
      </section>

      {/* Fila Rápida de Aprovação com Layout Adaptativo Mobile e Desktop */}
      <section aria-label="Fila de Aprovação" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning" aria-hidden="true">
              <Clock className="size-3.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Fila de Aprovação Imediata</h3>
              <p className="text-xs text-muted-foreground">Contas cadastradas aguardando autorização administrativa</p>
            </div>
          </div>
          <span className="inline-flex rounded-md bg-surface-hover px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border">
            {pendingUsers.length} {pendingUsers.length === 1 ? "pendente" : "pendentes"}
          </span>
        </div>

        {pendingUsersQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : pendingUsers.length === 0 ? (
          <EmptyState
            title="Nenhum cadastro pendente"
            description="Todos os usuários que se cadastraram foram avaliados ou ativados via convite."
          />
        ) : (
          <>
            {/* Visualização em Lista de Cards para Mobile (telas menores que sm) */}
            <div className="flex flex-col gap-3 sm:hidden">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-surface-hover/20"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate">{user.name || "Sem nome informado"}</span>
                    <span className="font-mono text-xs text-muted-foreground truncate">{user.email}</span>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      Cadastro em {new Date(user.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(user.id)}
                      disabled={updateStatusMutation.isPending}
                      className="gap-1.5 text-xs h-9 justify-center"
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
                      className="gap-1.5 text-xs h-9 justify-center"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Visualização em Tabela para Desktop e Tablets (sm+) */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[540px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                    <th className="py-3 px-4">Nome / E-mail</th>
                    <th className="py-3 px-4">Data de Cadastro</th>
                    <th className="py-3 px-4 text-right">Ação Imediata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col max-w-[260px]">
                          <span className="font-semibold text-foreground truncate">{user.name || "Sem nome"}</span>
                          <span className="font-mono text-muted-foreground text-[11px] truncate">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(user.id)}
                            disabled={updateStatusMutation.isPending}
                            className="gap-1.5 text-xs h-8 px-3"
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
                            className="gap-1.5 text-xs h-8 px-3"
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
          </>
        )}
      </section>
    </div>
  );
}
