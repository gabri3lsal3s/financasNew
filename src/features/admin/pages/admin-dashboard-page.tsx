import { Link } from "react-router";
import { AlertCircle, BellRing, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Button, EmptyState, buttonVariants } from "@/components/ui";
import { useAdminMetrics, useAdminUpdateUserStatus, useAdminUsers } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { FeatureUsageSection } from "../components";
import { AdminMetricsKpiGrid } from "../components/admin-metrics-kpi-grid";
import { AdminPendingApprovalsCard } from "../components/admin-pending-approvals-card";

export function AdminDashboardPage() {
  const metricsQuery = useAdminMetrics();
  const pendingUsersQuery = useAdminUsers({ status: "pending_approval", limit: 10 });
  const updateStatusMutation = useAdminUpdateUserStatus();

  const metrics = metricsQuery.data;
  const pendingUsers = pendingUsersQuery.data ?? [];
  const hasError = metricsQuery.isError || pendingUsersQuery.isError;

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
      <PageHeader
        title="Visão Geral"
        description="Métricas em tempo real e ações rápidas de operação"
        actions={
          <>
            <Link
              to="/admin/notificacoes"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <BellRing aria-hidden="true" />
              <span>Novo comunicado</span>
            </Link>
            <Link
              to="/admin/configuracoes"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <SlidersHorizontal aria-hidden="true" />
              <span>Configurações</span>
            </Link>
          </>
        }
      />

      {hasError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar o painel"
          description="Ocorreu um erro ao buscar as métricas ou a fila de aprovação. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void metricsQuery.refetch();
                void pendingUsersQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <AdminMetricsKpiGrid metrics={metrics} isLoading={metricsQuery.isLoading} />

          <AdminPendingApprovalsCard
            pendingUsers={pendingUsers}
            pendingCount={metrics?.pending_users ?? 0}
            isLoading={pendingUsersQuery.isLoading}
            isMutating={updateStatusMutation.isPending}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </>
      )}

      <section aria-label="Telemetria de Módulos">
        <FeatureUsageSection />
      </section>
    </div>
  );
}
