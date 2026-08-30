import { Check, Clock, KeyRound, Shield, UserCheck, Users, X, Layers, Activity } from "lucide-react";
import { Button, EmptyState, NumberTicker, Skeleton, Badge } from "@/components/ui";
import {
  useAdminMetrics,
  useAdminUpdateUserStatus,
  useAdminUsers,
  useAdminFeatures,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export function OverviewTab() {
  const metricsQuery = useAdminMetrics();
  const pendingUsersQuery = useAdminUsers({ status: "pending_approval", limit: 10 });
  const featuresQuery = useAdminFeatures();
  const updateStatusMutation = useAdminUpdateUserStatus();

  const metrics = metricsQuery.data;
  const pendingUsers = pendingUsersQuery.data ?? [];
  const features = featuresQuery.data ?? [];

  const activeFeaturesCount = features.filter((f) => f.is_globally_enabled).length;
  const totalFeaturesCount = features.length;

  const handleApprove = (userId: string, userName?: string | null) => {
    triggerSensory("action");
    updateStatusMutation.mutate(
      { userId, status: "active" },
      {
        onSuccess: () => {
          pushToast({
            title: "Usuário aprovado",
            description: userName ? `Acesso liberado para ${userName}.` : "Conta ativada com sucesso.",
            variant: "default",
          });
        },
      },
    );
  };

  const handleReject = (userId: string, userName?: string | null) => {
    triggerSensory("destructive");
    updateStatusMutation.mutate(
      { userId, status: "banned", reason: "Cadastro recusado pela administração." },
      {
        onSuccess: () => {
          pushToast({
            title: "Cadastro recusado",
            description: userName ? `Cadastro de ${userName} foi recusado.` : "Usuário bloqueado.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Grade de KPIs Executivos do SaaS */}
      <section aria-label="Métricas do SaaS" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total de Usuários */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Total de Usuários</span>
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_users ?? 0} />
            </div>
          )}
        </div>

        {/* Contas Ativas */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Contas Ativas</span>
            <UserCheck className="size-4 text-positive-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.active_users ?? 0} />
            </div>
          )}
        </div>

        {/* Fila de Aprovação */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Fila de Aprovação</span>
            <Clock className="size-4 text-warning-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-warning-strong sm:text-2xl">
              <NumberTicker value={metrics?.pending_users ?? 0} />
            </div>
          )}
        </div>

        {/* Suspensos / Bloqueados */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Bloqueados</span>
            <Shield className="size-4 text-critical-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-critical-strong sm:text-2xl">
              <NumberTicker value={metrics?.suspended_users ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Gerados */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Criados</span>
            <KeyRound className="size-4 text-portfolio" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_invites ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Resgatados */}
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Usados</span>
            <KeyRound className="size-4 text-positive-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums truncate text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.used_invites ?? 0} />
            </div>
          )}
        </div>
      </section>

      {/* Radar de Saúde & Status dos Módulos */}
      <section aria-label="Status do Sistema" className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Status Operacional da Plataforma</span>
              <Badge variant={activeFeaturesCount === totalFeaturesCount ? "positive" : "warning"} size="xs">
                {activeFeaturesCount === totalFeaturesCount ? "100% Operacional" : `${totalFeaturesCount - activeFeaturesCount} Módulo Pausado`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalFeaturesCount > 0
                ? `${activeFeaturesCount} de ${totalFeaturesCount} módulos ativos globalmente via Kill-Switch.`
                : "Carregando catálogo de módulos do sistema..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/20">
            <Layers className="size-3.5 text-muted-foreground" />
            <span>Módulos: {activeFeaturesCount}/{totalFeaturesCount}</span>
          </div>
        </div>
      </section>

      {/* Fila Rápida de Aprovação com Layout Adaptativo Mobile e Desktop */}
      <section aria-label="Fila de Aprovação" className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Fila de Aprovação Imediata</h3>
              <p className="text-xs text-muted-foreground">Contas cadastradas aguardando autorização administrativa</p>
            </div>
          </div>
          <Badge variant="muted" size="xs">
            {pendingUsers.length} {pendingUsers.length === 1 ? "pendente" : "pendentes"}
          </Badge>
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
            {/* Visualização em Lista de Cards para Mobile (< sm) */}
            <div className="flex flex-col gap-3 sm:hidden">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-surface"
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
                      onClick={() => handleApprove(user.id, user.name)}
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
                      onClick={() => handleReject(user.id, user.name)}
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
                  <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-medium">
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
                            onClick={() => handleApprove(user.id, user.name)}
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
                            onClick={() => handleReject(user.id, user.name)}
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
