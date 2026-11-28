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
import { formatDateBR } from "@/lib/date";
import { useAdminPastDueSubscriptions, useAdminPlans, useAdminSubscriptions } from "@/state";
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
  const [nowMs] = useState(() => Date.now());
  const subscriptionsQuery = useAdminSubscriptions(200);
  const pastDueQuery = useAdminPastDueSubscriptions();
  const plansQuery = useAdminPlans();

  const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const { estimatedMrrCents, activeSubscribersCount, activeTrialsCount, expiringTrialsCount, pastDueCount } = useMemo(() => {
    const planMap = new Map(plans.map((p) => [p.id, p]));
    let mrr = 0;
    let activePaid = 0;
    let trials = 0;
    let expiring = 0;
    let pastDue = 0;

    for (const sub of subscriptions) {
      if (sub.status === "past_due") {
        pastDue += 1;
      }
      if (sub.status === "trialing" || (sub.status === "active" && sub.tier === "trial")) {
        trials += 1;
        if (sub.trial_ends_at) {
          const diff = new Date(sub.trial_ends_at).getTime() - nowMs;
          if (diff > 0 && diff <= 3 * 86_400_000) expiring += 1;
        }
        continue;
      }
      if (sub.status === "active" && sub.tier !== "read_only") {
        activePaid += 1;
        const plan = planMap.get(sub.plan_id) ?? planMap.get(sub.tier);
        if (plan && plan.price_cents > 0) {
          if (plan.billing_interval === "year") {
            mrr += Math.round(plan.price_cents / 12);
          } else if (plan.billing_interval === "month") {
            mrr += plan.price_cents;
          }
        }
      }
    }

    return {
      estimatedMrrCents: mrr,
      activeSubscribersCount: activePaid,
      activeTrialsCount: trials,
      expiringTrialsCount: expiring,
      pastDueCount: Math.max(pastDue, (pastDueQuery.data ?? []).length),
    };
  }, [subscriptions, plans, pastDueQuery.data, nowMs]);

  const filteredSubscriptions = useMemo(() => {
    if (statusFilter === "all") return subscriptions;
    return subscriptions.filter((s) => s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  const hasError = subscriptionsQuery.isError || plansQuery.isError;

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
                void subscriptionsQuery.refetch();
                void plansQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : subscriptionsQuery.isLoading || plansQuery.isLoading ? (
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
        <KpiGrid columns={4}>
          <KpiCard
            label="MRR estimado"
            action={
              <AdminHelpTip
                title="MRR estimado"
                what="Estimativa mensal da receita das assinaturas pagas ativas exibidas. Planos anuais entram pelo valor dividido por 12."
                when="Consulte o indicador para acompanhar a receita recorrente prevista."
                impact="Ajuda a planejar receitas. O valor recebido pode ser diferente da estimativa."
              />
            }
            cents={estimatedMrrCents}
            tone="positive"
            icon={<TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />}
          />
          <KpiCard
            label="Assinantes Ativos"
            value={String(activeSubscribersCount)}
            tone="portfolio"
            icon={<Crown className="size-4 text-portfolio" aria-hidden="true" />}
          />
          <KpiCard
            label="Trials Ativos"
            value={String(activeTrialsCount)}
            hint={expiringTrialsCount > 0 ? `${expiringTrialsCount} expirando em 3d` : undefined}
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

        {subscriptionsQuery.isLoading ? (
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-foreground truncate">
                      {sub.user_id}
                    </span>
                    <Badge variant={resolveSubBadgeVariant(sub.status)} size="xs">
                      {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                    </Badge>
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
                    <th className="py-3 px-4">Usuário ID</th>
                    <th className="py-3 px-4">Tier / Plano</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Vigência</th>
                    <th className="py-3 px-4 text-right">Gateway</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {filteredSubscriptions.slice(0, 50).map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-hover/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-foreground">
                        {sub.user_id}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{sub.tier}</td>
                      <td className="py-3 px-4">
                        <Badge variant={resolveSubBadgeVariant(sub.status)} size="xs">
                          {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                        </Badge>
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
        description="Receita recorrente, planos e pagamentos em atraso"
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
        keepMountedAfterFirstVisit
        items={[
          {
            value: "visao-financeira",
            label: "Receita & Custos",
            content: <FinOpsOverviewPanel />,
          },
          {
            value: "assinaturas",
            label: "Assinaturas & Inadimplência",
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
            label: "Cotas & Uso de IA",
            content: <AiQuotasUsagePanel />,
          },
        ]}
      />
    </div>
  );
}
