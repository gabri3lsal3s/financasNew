import {
  AlertTriangle,
  ExternalLink,
  LifeBuoy,
  Receipt,
  Zap,
} from "lucide-react";
import {
  Badge,
  NumberTicker,
  Skeleton,
} from "@/components/ui";
import { useAdminMetrics, useAdminPlans } from "@/state";

export function AdminBillingPage() {
  const metricsQuery = useAdminMetrics();
  const plansQuery = useAdminPlans();
  const metrics = metricsQuery.data;
  const plans = plansQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Faturamento SaaS &amp; Gateway Asaas
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gestão de receitas recorrentes, conciliação de pagamentos e contingências operacionais
          </p>
        </div>

        <a
          href="https://www.asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors self-start sm:self-center"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span>Painel Asaas</span>
        </a>
      </div>

      {/* Grade de KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-4.5 shadow-xs flex flex-col justify-between gap-3">
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

        <div className="rounded-xl border border-border/80 bg-surface p-4.5 shadow-xs flex flex-col justify-between gap-3">
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

        <div className="rounded-xl border border-border/80 bg-surface p-4.5 shadow-xs flex flex-col justify-between gap-3">
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

      {/* Catálogo de Planos do Sistema */}
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
              <div key={p.id} className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-sm">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">{p.description || "Sem descrição"}</span>
                  </div>
                  <Badge variant={p.is_publicly_available ? "default" : "muted"} size="xs">
                    {p.is_publicly_available ? "Público" : "Exclusivo"}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-1 text-foreground">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <span className="text-lg font-bold font-mono">
                    {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{p.billing_interval === "year" ? "ano" : "mês"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Guia de Contingências Operacionais do Founder Runbook */}
      <section aria-label="Contingências do Runbook" className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary-strong" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">Procedimentos de Contingência (Founder Runbook)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border/60 bg-background/50 flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground">1. Cliente Pagou mas Webhook Atrasou</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Nunca deixe o cliente esperando na fila: acesse a aba <strong>Gestão de Usuários</strong>, clique em <strong>Gerenciar</strong> no usuário e altere o Plano para <strong>Pro Mensal</strong> ou <strong>Anual</strong> com status <strong>Ativo</strong>. A liberação tem efeito instantâneo sem necessidade de relogar.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-background/50 flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground">2. Cancelamento e Reembolso em até 7 Dias (CDC Art. 49)</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O cliente pode solicitar reembolso autônomo no app. Em caso de solicitação direta de suporte: acesse o Painel Asaas &gt; Cobranças &gt; Mais Ações &gt; Estornar Cobrança. O Asaas envia o webhook <code>PAYMENT_REFUNDED</code> e o banco rebaixa automaticamente o acesso para <code>read_only</code>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
