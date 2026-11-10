import { BarChart3, Activity, ArrowUpRight, Clock } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { useFeatureUsageMetrics } from "@/state";

const MODULE_LABELS: Record<string, string> = {
  expenses: "Despesas & Lançamentos",
  incomes: "Receitas & Entradas",
  cards: "Cartões de Crédito",
  investments: "Investimentos & Aportes",
  budgets: "Orçamentos & Metas",
  debts: "Dívidas & Empréstimos",
  reports: "Relatórios & DRE",
  settings: "Ajustes & Personalização",
  support: "Central de Suporte",
};

export function FeatureUsageSection() {
  const { data: ranking = [], isLoading } = useFeatureUsageMetrics(30);

  const topModules = ranking.slice(0, 5);
  const leastUsedModules = ranking.length > 5 ? ranking.slice(-3).reverse() : [];
  const totalInteractions = ranking.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Engajamento & Uso de Funcionalidades</h3>
            <p className="text-xs text-muted-foreground">
              Módulos mais acessados e frequência de utilização nos últimos 30 dias.
            </p>
          </div>
        </div>
        {totalInteractions > 0 && (
          <Badge variant="muted" size="xs" className="self-start sm:self-auto shrink-0">
            {totalInteractions} interações registradas
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : ranking.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-5 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum dado analítico no período"
          description="Os eventos anônimos de navegação e uso começarão a aparecer conforme os usuários utilizarem o aplicativo."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Funcionalidades Mais Usadas */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ArrowUpRight className="size-3.5 text-positive-strong" aria-hidden="true" />
              <span>Funcionalidades Mais Utilizadas</span>
            </div>
            <div className="space-y-2.5">
              {topModules.map((item, idx) => {
                const label = MODULE_LABELS[item.module] || item.module;
                return (
                  <div
                    key={item.module}
                    className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/60 bg-surface-subtle/30"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-surface-hover text-[10px] font-bold text-foreground">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-foreground">{item.count}</span>
                        <span className="text-[11px] text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Barra de Progresso Visual */}
                    <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Menos Utilizadas & Oportunidades */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
              <span>Oportunidades de Descoberta / Menos Acessadas</span>
            </div>
            {leastUsedModules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Dados suficientes ainda não coletados para identificar desvios.
              </p>
            ) : (
              <div className="space-y-2.5">
                {leastUsedModules.map((item) => {
                  const label = MODULE_LABELS[item.module] || item.module;
                  return (
                    <div
                      key={item.module}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-surface-subtle/20 text-xs"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted" size="xs">
                          {item.count} acessos
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
