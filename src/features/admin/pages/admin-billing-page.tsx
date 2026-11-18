import { AlertTriangle, ExternalLink, LifeBuoy, Receipt, Zap } from "lucide-react";
import { Badge, MoneyText, NumberTicker, Skeleton, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useAdminMetrics, useAdminPlans } from "@/state";
import { cn } from "@/lib/utils";

export function AdminBillingPage() {
  const metricsQuery = useAdminMetrics();
  const plansQuery = useAdminPlans();
  const metrics = metricsQuery.data;
  const plans = plansQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      <PageHeader
        title="Faturamento SaaS & Gateway Asaas"
        description="Gestão de receitas recorrentes, conciliação de pagamentos e contingências operacionais"
        actions={
          <a
            href="https://www.asaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 text-xs font-semibold",
            )}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span>Painel Asaas</span>
          </a>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Usuários Ativos</span>
            <Receipt className="size-4 text-primary-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums text-2xl font-bold text-foreground">
              <NumberTicker value={metrics?.active_users ?? 0} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cadastros Pendentes</span>
            <Zap className="size-4 text-warning-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums text-2xl font-bold text-warning-strong">
              <NumberTicker value={metrics?.pending_users ?? 0} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Contas Suspensas</span>
            <AlertTriangle className="size-4 text-critical-strong" aria-hidden="true" />
          </div>
          {metricsQuery.isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="tabular-nums text-2xl font-bold text-critical-strong">
              <NumberTicker value={metrics?.suspended_users ?? 0} />
            </div>
          )}
        </div>
      </div>

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
                    <span className="font-semibold text-foreground text-sm truncate">{p.name}</span>
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

      <section
        aria-label="Contingências do Runbook"
        className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary-strong" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">
            Procedimentos de Contingência (Founder Runbook)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-raised flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground">
              1. Cliente Pagou mas Webhook Atrasou
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Nunca deixe o cliente esperando na fila: acesse a aba <strong>Gestão de Usuários</strong>, clique em <strong>Gerenciar</strong> no usuário e altere o Plano para <strong>Pro Mensal</strong> ou <strong>Anual</strong> com status <strong>Ativo</strong>. A liberação tem efeito instantâneo sem necessidade de relogar.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-raised flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground">
              2. Cancelamento e Reembolso em até 7 Dias (CDC Art. 49)
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O cliente pode solicitar reembolso autônomo no app. Em caso de solicitação direta de suporte: acesse o Painel Asaas &gt; Cobranças &gt; Mais Ações &gt; Estornar Cobrança. O Asaas envia o webhook <code>PAYMENT_REFUNDED</code> e o banco rebaixa automaticamente o acesso para <code>read_only</code>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
