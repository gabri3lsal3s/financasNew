import { Link } from "react-router";
import { ArrowRight, ChartPie, Landmark, TrendingUp, Wallet } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SkeletonChart, SkeletonKpi, SkeletonTable } from "@/components/ui";
import { AllocationDonut, CategoryDonut, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { dividendsInMonth, portfolioReturnPct } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money/parse";
import { currentMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useAllPortfolioTransactions, usePortfolioPosition } from "@/state";

const formatPct = (value: number | null): string => {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

/**
 * Dashboard de Investimentos (§F17) — visão executiva de LEITURA da carteira:
 * KPIs (patrimônio, rentabilidade ponderada, proventos do mês), donuts de
 * distribuição (classe e ticker) e a tabela de posições com ordenação.
 * A operação (cadastro/metas/aporte) permanece em `/carteira` (P3 = a).
 */
export function InvestmentsPage() {
  const position = usePortfolioPosition();
  const transactionsQuery = useAllPortfolioTransactions();

  const rows = position.rows;
  const hasInvestments = rows.length > 0;

  // Rentabilidade ponderada pelo valor (§F17 — motor puro).
  const returnPct = portfolioReturnPct(rows);

  // Proventos recebidos no mês (motor puro) — mês corrente.
  const month = currentMonth();
  const dividendsCents = numberToCents(dividendsInMonth(transactionsQuery.data ?? [], month));

  // Alocação por classe (AllocationDonut, F16) e por ticker (donut por ativo).
  const classSlices = rows.map((row) => ({
    label: row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe"),
    valueCents: Math.round(row.valueBRL * 100),
  }));
  const tickerSlices = rows
    .map((row) => ({
      label: row.ticker,
      valueCents: Math.round(row.valueBRL * 100),
    }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  // Comparativo Δ vs. mês anterior (F14) — série mensal derivada.
  const series = position.monthlySeries;
  const previousPoint = series.length > 1 ? series[series.length - 2] : undefined;
  const previousCents = previousPoint ? numberToCents(previousPoint.valueBRL) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Visão executiva da carteira: patrimônio, rentabilidade e distribuição por classe e ativo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/carteira">
            <Button size="sm" variant="outline">
              <Wallet aria-hidden="true" className="size-4" />
              Registrar transação
            </Button>
          </Link>
          <Link to="/carteira">
            <Button size="sm" variant="ghost">
              Metas e aporte
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </Link>
        </div>
      </header>

      {position.error ? (
        <Alert variant="error">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{getErrorMessage(position.error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => position.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : null}

      {position.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
          <SkeletonTable rows={4} />
        </div>
      ) : !hasInvestments ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem investimentos"
          description="Adicione ativos e registre transações na carteira para acompanhar o patrimônio e a rentabilidade aqui."
          tone="portfolio"
          headingLevel="h2"
          action={
            <Link to="/carteira">
              <Button size="sm">Ir para a carteira</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* KPIs executivos (§F17) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Patrimônio total"
              valueCents={numberToCents(position.totalBRL)}
              tone="portfolio"
              hint={<DeltaHint currentCents={numberToCents(position.totalBRL)} previousCents={previousCents} />}
            />
            <KpiCard
              label="Rentabilidade"
              value={formatPct(returnPct)}
              tone={returnPct !== null && returnPct >= 0 ? "positive" : returnPct !== null ? "negative" : "default"}
              hint="Não realizada, ponderada pelo valor"
            />
            <KpiCard
              label="Proventos no mês"
              cents={dividendsCents}
              tone="positive"
              hint={`Recebidos em ${month}`}
            />
            <KpiCard
              label="Ativos"
              value={String(rows.length)}
              hint="Inclui caixa/reserva (1:1)"
            />
          </div>

          {/* Distribuição patrimonial: por classe e por ticker */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section aria-label="Alocação por classe" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <ChartPie className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Alocação por classe</h2>
              </div>
              <AllocationDonut slices={classSlices} className="sm:max-w-md" />
            </section>

            <section aria-label="Alocação por ativo" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <Landmark className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Alocação por ativo</h2>
              </div>
              <CategoryDonut slices={tickerSlices} className="sm:max-w-md" />
            </section>
          </div>

          {/* Posições avançadas: PM, lucro/prejuízo, fonte, peso — com ordenação (F17) */}
          <section aria-label="Posições" className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Posições</h2>
              <Badge variant="muted" className="text-[11px]">
                {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
              </Badge>
            </div>
            <PositionTable rows={rows} sortable />
          </section>
        </>
      )}
    </div>
  );
}
