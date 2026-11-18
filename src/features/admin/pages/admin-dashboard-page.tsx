import { Link } from "react-router";
import { BellRing, Database, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { buttonVariants } from "@/components/ui";
import { useAdminMetrics, useAdminUpdateUserStatus, useAdminUsers } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import { FeatureUsageSection } from "../components";
import { AdminMetricsKpiGrid } from "../components/admin-metrics-kpi-grid";
import { AdminPendingApprovalsCard } from "../components/admin-pending-approvals-card";

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
      <PageHeader
        title="Dashboard Executivo"
        description="Métricas em tempo real, telemetria da infraestrutura e ações de governança"
        actions={
          <>
            <Link
              to="/admin/notificacoes"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs shrink-0")}
            >
              <BellRing className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>Novo Comunicado</span>
            </Link>
            <Link
              to="/admin/backups"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs shrink-0")}
            >
              <Database className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Gerar Snapshot</span>
            </Link>
            <Link
              to="/admin/configuracoes"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs shrink-0")}
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Kill-Switches</span>
            </Link>
          </>
        }
      />

      <AdminMetricsKpiGrid metrics={metrics} isLoading={metricsQuery.isLoading} />

      <AdminPendingApprovalsCard
        pendingUsers={pendingUsers}
        pendingCount={metrics?.pending_users ?? 0}
        isLoading={pendingUsersQuery.isLoading}
        isMutating={updateStatusMutation.isPending}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <section aria-label="Telemetria de Módulos">
        <FeatureUsageSection />
      </section>
    </div>
  );
}
