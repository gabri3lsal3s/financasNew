import { Link } from "react-router";
import { BellRing, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { KpiCard, KpiGrid } from "@/components/modules";
import { ErrorState, Skeleton, buttonVariants } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import {
  useAdminMetrics,
  useAdminPastDueSubscriptions,
  useAdminSupportTickets,
  useAdminUpdateUserStatus,
  useAdminUsers,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { AdminPageGuide } from "../components/admin-help-tip";
import { FeatureUsageSection } from "../components/feature-usage-section";
import { AdminMetricsKpiGrid } from "../components/admin-metrics-kpi-grid";
import { AdminPendingApprovalsCard } from "../components/admin-pending-approvals-card";
import { RetentionRadarCard } from "../components/retention-radar-card";

interface AttentionCardProps {
  label: string;
  to: string;
  actionLabel: string;
  count: number;
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  };
}

function AttentionCard({ label, to, actionLabel, count, query }: AttentionCardProps) {
  return (
    <KpiCard
      label={label}
      value={query.isLoading || query.isError ? undefined : String(count)}
      hint={
        <div className="space-y-2">
          {query.isLoading && <Skeleton className="h-6 w-12" />}
          {query.isError && (
            <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
          )}
          <Link to={to} className="inline-block text-xs font-semibold text-primary-strong hover:underline">
            {actionLabel}
          </Link>
        </div>
      }
    />
  );
}

export function AdminDashboardPage() {
  const metricsQuery = useAdminMetrics();
  const pendingUsersQuery = useAdminUsers({ status: "pending_approval", limit: 10 });
  const ticketsQuery = useAdminSupportTickets();
  const pastDueQuery = useAdminPastDueSubscriptions();
  const updateStatusMutation = useAdminUpdateUserStatus();

  const metrics = metricsQuery.data;
  const pendingUsers = pendingUsersQuery.data ?? [];
  const openTicketsCount = (ticketsQuery.data ?? []).filter(
    (ticket) => ticket.status === "open" || ticket.status === "in_progress",
  ).length;

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
        description="Pendências e indicadores da operação"
        utilityActions={<AdminPageGuide page="dashboard" />}
        actions={
          <>
            <Link
              to="/admin/chamados?tab=comunicados"
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

      <section aria-labelledby="admin-attention-title" className="space-y-4">
        <h2 id="admin-attention-title" className="text-lg font-bold text-foreground">
          O que precisa da minha atenção?
        </h2>

        {pendingUsersQuery.isError ? (
          <ErrorState
            message={getErrorMessage(pendingUsersQuery.error)}
            onRetry={() => void pendingUsersQuery.refetch()}
          />
        ) : (
          <AdminPendingApprovalsCard
            pendingUsers={pendingUsers}
            pendingCount={metrics?.pending_users ?? pendingUsers[0]?.total_count ?? pendingUsers.length}
            isLoading={pendingUsersQuery.isLoading}
            isMutating={updateStatusMutation.isPending}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        <KpiGrid columns={2}>
          <AttentionCard
            label="Chamados abertos ou em atendimento"
            count={openTicketsCount}
            query={ticketsQuery}
            to="/admin/chamados"
            actionLabel="Ver chamados"
          />
          <AttentionCard
            label="Assinaturas inadimplentes"
            count={pastDueQuery.data?.length ?? 0}
            query={pastDueQuery}
            to="/admin/faturamento"
            actionLabel="Ver inadimplência"
          />
        </KpiGrid>
      </section>

      <RetentionRadarCard />

      <section aria-labelledby="admin-service-title" className="space-y-4">
        <h2 id="admin-service-title" className="text-lg font-bold text-foreground">
          Como está o serviço?
        </h2>
        {metricsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(metricsQuery.error)}
            onRetry={() => void metricsQuery.refetch()}
          />
        ) : (
          <AdminMetricsKpiGrid metrics={metrics} isLoading={metricsQuery.isLoading} />
        )}
      </section>

      <section aria-labelledby="admin-month-title" className="space-y-4">
        <h2 id="admin-month-title" className="text-lg font-bold text-foreground">
          Como está o mês?
        </h2>
        <FeatureUsageSection />
      </section>
    </div>
  );
}
