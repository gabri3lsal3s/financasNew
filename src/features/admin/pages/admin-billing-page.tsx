import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Clock, Crown, ExternalLink, Receipt, TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  MoneyText,
  Select,
  Skeleton,
  Tabs,
  buttonVariants,
} from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { KpiCard, KpiGrid } from "@/components/modules";
import { ROLE_LABELS } from "@/domain/admin";
import { formatDateBR } from "@/lib/date";
import { useAdminBillingOverview, useAdminPlans } from "@/state";
import { AdminHelpTip, AdminPageGuide } from "../components/admin-help-tip";
import { AiQuotasUsagePanel } from "../components/ai-quotas-usage-panel";
import { FinOpsOverviewPanel } from "../components/finops-overview-panel";
import { PastDueManagementCard } from "../components/past-due-management-card";

const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trialing: "Em Teste",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  read_only_expired: "Somente Leitura",
};

function resolveSubBadgeVariant(status: string): "positive" | "warning" | "critical" | "muted" {
  if (status === "active") return "positive";
  if (status === "trialing") return "warning";
  if (status === "past_due") return "critical";
  return "muted";
}

export function AdminBillingPage() {
  const [activeTab, setActiveTab] = useState("visao-financeira");
  const [statusFilter, setStatusFilter] = useState("all");
  const billingOverviewQuery = useAdminBillingOverview();
  const plansQuery = useAdminPlans();

  const overview = billingOverviewQuery.data;
  const subscriptions = useMemo(() => overview?.subscriptions ?? [], [overview?.subscriptions]);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const pastDueCount = overview?.past_due_count ?? 0;

  const filteredSubscriptions = useMemo(() => {
    if (statusFilter === "all") return subscriptions;
    return subscriptions.filter((s) => s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  const hasError = billingOverviewQuery.isError || plansQuery.isError;

  const subscriptionsTabContent = (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {hasError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar o faturamento"
          description="Ocorreu um erro ao buscar assinaturas ou planos. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void billingOverviewQuery.refetch();
                void plansQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : billingOverviewQuery.isLoading || plansQuery.isLoading ? (
        <KpiGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3 h-24"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </KpiGrid>
      ) : (
        <div className="flex flex-col gap-2">
          <KpiGrid columns={4}>
            <KpiCard
              label="MRR real estimado"
              action={
                <AdminHelpTip
                  title="MRR real estimado"
                  what="Estimativa mensal da receita das assinaturas pagas ativas de clientes reais. Contas internas, de teste e cortesias são excluídas."
                  when="Consulte o indicador para acompanhar a receita recorrente prevista."
                  impact="Ajuda a planejar receitas. O valor recebido pode ser diferente da estimativa."
                />
              }
              cents={overview?.estimated_real_mrr_cents ?? 0}
              tone="positive"
              icon={<TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />}
            />
            <KpiCard
              label="Pagantes reais"
              value={String(overview?.real_paid_subscribers_count ?? 0)}
              hint={
                (overview?.courtesy_lifetime_count ?? 0) > 0
                  ? `${overview?.courtesy_lifetime_count} cortesia/vitalício`
                  : undefined
              }
              tone="portfolio"
              icon={<Crown className="size-4 text-portfolio" aria-hidden="true" />}
            />
            <KpiCard
              label="Trials ativos"
              value={String(overview?.trials_count ?? 0)}
              hint={
                (overview?.expiring_trials_count ?? 0) > 0
                  ? `${overview?.expiring_trials_count} expirando em 3d`
                  : undefined
              }
              icon={<Clock className="size-4 text-muted-foreground" aria-hidden="true" />}
            />
            <KpiCard
              label="Inadimplentes"
              action={
                <AdminHelpTip
                  title="Inadimplência"
                  what="Assinaturas com pagamento em atraso."
                  when="Confira as cobranças pendentes na lista de inadimplência antes de tomar uma ação."
                  impact="O atraso pode restringir o acesso da conta a somente leitura."
                />
              }
              value={String(pastDueCount)}
              tone={pastDueCount > 0 ? "negative" : "default"}
              icon={<AlertTriangle className="size-4 text-critical-strong" aria-hidden="true" />}
            />
          </KpiGrid>
          {(overview?.internal_or_test_count ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {overview?.internal_or_test_count}{" "}
              {overview?.internal_or_test_count === 1
                ? "assinatura de conta interna ou de teste isolada das métricas reais."
                : "assinaturas de contas internas ou de teste isoladas das métricas reais."}
            </p>
          )}
        </div>
      )}

      <PastDueManagementCard />

      <section aria-label="Assinaturas da Plataforma" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Assinaturas</h2>
            <Badge variant="muted" size="xs">
              {filteredSubscriptions.length}
            </Badge>
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              ariaLabel="Filtrar assinaturas por status"
              options={[
                { value: "all", label: "Status: Todos" },
                { value: "active", label: "Ativa" },
                { value: "trialing", label: "Em Teste" },
                { value: "past_due", label: "Inadimplente" },
                { value: "canceled", label: "Cancelada" },
                { value: "read_only_expired", label: "Somente Leitura" },
              ]}
            />
          </div>
        </div>

        {billingOverviewQuery.isLoading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : filteredSubscriptions.length === 0 ? (
          <EmptyState
            title="Nenhuma assinatura localizada"
            description="Nenhuma assinatura corresponde ao filtro selecionado."
          />
        ) : (
          <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <div className="flex flex-col divide-y divide-border/80 md:hidden">
              {filteredSubscriptions.slice(0, 50).map((sub) => (
                <div key={sub.id} className="p-4 flex flex-col gap-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground line-clamp-2 break-words">
                        {sub.user_name || sub.user_email || sub.user_id}
                      </span>
                      {sub.user_name && sub.user_email && (
                        <span className="font-mono text-[11px] text-muted-foreground truncate">
                          {sub.user_email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                      <Badge variant={resolveSubBadgeVariant(sub.status)} size="xs" className="max-w-full truncate inline-block">
                        {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                      </Badge>
                      {sub.is_test && (
                        <Badge variant="warning" size="xs" className="max-w-full truncate inline-block">
                          Teste
                        </Badge>
                      )}
                      {sub.user_role !== "user" && (
                        <Badge variant="muted" size="xs" className="max-w-full truncate inline-block">
                          {ROLE_LABELS[sub.user_role as keyof typeof ROLE_LABELS] ?? sub.user_role}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Plano: <strong className="text-foreground">{sub.tier}</strong></span>
                    <span>{sub.asaas_subscription_id ? "Asaas" : "Direto"}</span>
                  </div>
                  {(sub.current_period_end || sub.trial_ends_at) && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Vigência: {formatDateBR(sub.current_period_end ?? sub.trial_ends_at ?? "")}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto no-scrollbar scroll-smooth">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-surface-raised border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Tier / Plano</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Vigência</th>
                    <th className="py-3 px-4 text-right">Gateway</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {filteredSubscriptions.slice(0, 50).map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-hover/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {sub.user_name || sub.user_email || sub.user_id}
                          </span>
                          {sub.user_name && sub.user_email && (
                            <span className="font-mono text-[11px] text-muted-foreground truncate">
                              {sub.user_email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{sub.tier}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={resolveSubBadgeVariant(sub.status)} size="xs" className="max-w-full truncate inline-block">
                            {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                          </Badge>
                          {sub.is_test && (
                            <Badge variant="warning" size="xs" className="max-w-full truncate inline-block">
                              Teste
                            </Badge>
                          )}
                          {sub.user_role !== "user" && (
                            <Badge variant="muted" size="xs" className="max-w-full truncate inline-block">
                              {ROLE_LABELS[sub.user_role as keyof typeof ROLE_LABELS] ?? sub.user_role}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {sub.current_period_end || sub.trial_ends_at
                          ? formatDateBR(sub.current_period_end ?? sub.trial_ends_at ?? "")
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {sub.asaas_subscription_id ? "Asaas" : "Direto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Catálogo de Planos" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Planos Cadastrados</h2>
          <Badge variant="muted" size="xs">
            {plans.length} planos ativos
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plansQuery.isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </>
          ) : (
            plans.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground text-sm line-clamp-2 break-words">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {p.description || "Sem descrição"}
                    </span>
                  </div>
                  <Badge variant={p.is_publicly_available ? "default" : "muted"} size="xs">
                    {p.is_publicly_available ? "Público" : "Exclusivo"}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-1 text-foreground">
                  <MoneyText
                    cents={p.price_cents}
                    variant="value"
                    tone="default"
                    className="text-lg font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    /{p.billing_interval === "year" ? "ano" : "mês"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        utilityActions={<AdminPageGuide page="billing" />}
        title="Faturamento"
        description="Receitas, assinaturas e pagamentos"
        actions={
          <a
            href="https://www.asaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink aria-hidden="true" />
            <span>Painel Asaas</span>
          </a>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        ariaLabel="Seções de faturamento"
        fullWidth
        keepMountedAfterFirstVisit
        items={[
          {
            value: "visao-financeira",
            label: "FinOps",
            content: <FinOpsOverviewPanel />,
          },
          {
            value: "assinaturas",
            label: "Assinaturas",
            badge:
              pastDueCount > 0 ? (
                <Badge variant="critical" size="xs">
                  {pastDueCount}
                </Badge>
              ) : undefined,
            content: subscriptionsTabContent,
          },
          {
            value: "cotas-ia",
            label: "Cotas IA",
            content: <AiQuotasUsagePanel />,
          },
        ]}
      />
    </div>
  );
}
