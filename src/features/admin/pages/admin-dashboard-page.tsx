import { Link } from "react-router";
import {
  BellRing,
  Check,
  Clock,
  Database,
  KeyRound,
  Shield,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Button, EmptyState, NumberTicker, Skeleton } from "@/components/ui";
import {
  useAdminMetrics,
  useAdminUpdateUserStatus,
  useAdminUsers,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { FeatureUsageSection } from "../components";

export function AdminDashboardPage() {
  const metricsQuery = useAdminMetrics();
  const pendingUsersQuery = useAdminUsers({ status: "pending_approval", limit: 10 });
  const updateStatusMutation = useAdminUpdateUserStatus();

  const metrics = metricsQuery.data;
  const pendingUsers = pendingUsersQuery.data ?? [];

  const handleApprove = (userId: string, userName?: string | null) => {
    updateStatusMutation.mutate(
      { userId, status: "active" },
      {
        onSuccess: () => {
          triggerSensory("success");
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
    updateStatusMutation.mutate(
      { userId, status: "banned", reason: "Cadastro recusado pela administração." },
      {
        onSuccess: () => {
          triggerSensory("destructive");
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
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* Cabeçalho da Visão Geral */}
      <PageHeader
        title="Dashboard Executivo"
        description="Métricas em tempo real, telemetria da infraestrutura e ações de governança"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/admin/notificacoes">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <BellRing className="size-3.5 text-primary-strong" aria-hidden="true" />
                <span>Novo Comunicado</span>
              </Button>
            </Link>
            <Link to="/admin/backups">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Database className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Gerar Snapshot</span>
              </Button>
            </Link>
            <Link to="/admin/configuracoes">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Kill-Switches</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Grade de KPIs Principais */}
      <section aria-label="Métricas Principais" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total de Usuários */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Total Usuários</span>
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_users ?? 0} />
            </div>
          )}
        </div>

        {/* Contas Ativas */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Contas Ativas</span>
            <UserCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.active_users ?? 0} />
            </div>
          )}
        </div>

        {/* Fila de Aprovação */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Fila Aprovação</span>
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-warning-strong sm:text-2xl">
              <NumberTicker value={metrics?.pending_users ?? 0} />
            </div>
          )}
        </div>

        {/* Contas Bloqueadas */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Bloqueados</span>
            <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-critical-strong sm:text-2xl">
              <NumberTicker value={metrics?.suspended_users ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Criados */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Criados</span>
            <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <NumberTicker value={metrics?.total_invites ?? 0} />
            </div>
          )}
        </div>

        {/* Convites Resgatados */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Convites Usados</span>
            <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="tabular-nums text-xl font-bold tracking-tight text-positive-strong sm:text-2xl">
              <NumberTicker value={metrics?.used_invites ?? 0} />
            </div>
          )}
        </div>
      </section>

      {/* Seção 2: Fila de Aprovação Pendente Imediata */}
      <section aria-label="Fila de Aprovação" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Aprovações de Cadastro Pendentes</h2>
          </div>
          <Link to="/admin/usuarios?status=pending_approval" className="text-xs text-primary-strong hover:underline font-semibold">
            Ver todos ({metrics?.pending_users ?? 0})
          </Link>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          {pendingUsersQuery.isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Fila de aprovação vazia"
                description="Todos os cadastros foram avaliados. Nenhuma conta aguarda aprovação no momento."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {pendingUsers.map((u) => (
                <div key={u.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{u.name || "Nome não informado"}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(u.id, u.name)}
                      disabled={updateStatusMutation.isPending}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Aprovar</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(u.id, u.name)}
                      disabled={updateStatusMutation.isPending}
                      className="gap-1.5 text-xs h-8"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      <span>Recusar</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Seção 3: Telemetria de Módulos & Features */}
      <section aria-label="Telemetria de Módulos">
        <FeatureUsageSection />
      </section>
    </div>
  );
}
