import {
  Skeleton,
  SkeletonChart,
  SkeletonHeroCard,
  SkeletonKpi,
  SkeletonList,
} from "@/components/ui/skeleton-base";

/** Esqueleto da Visão Geral (Home): MonthPicker, Hero de Caixa Real, Grid de 4 KPIs e 2 Gráficos. */
export function OverviewSkeleton() {
  return (
    <div
      aria-label="Carregando Visão Geral"
      className="flex flex-col gap-6 w-full min-w-0 motion-reduce:animate-none"
    >
      {/* Navegador de mês espelhando o MonthPicker */}
      <div className="flex items-center justify-between gap-2 h-10">
        <Skeleton className="size-9 rounded-xl shrink-0" />
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="size-9 rounded-xl shrink-0" />
      </div>

      <div className="flex flex-col gap-3">
        <SkeletonHeroCard />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    </div>
  );
}

/** Esqueleto de Transações: Cabeçalho, navegador de mês, abas, busca e lista agrupada por data. */
export function TransactionsSkeleton() {
  return (
    <div
      aria-label="Carregando Transações"
      className="flex flex-col gap-5 w-full min-w-0 motion-reduce:animate-none"
    >
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Skeleton className="h-9 sm:w-28 rounded-xl" />
          <Skeleton className="h-9 sm:w-32 rounded-xl" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 h-10">
        <Skeleton className="size-9 rounded-xl shrink-0" />
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="size-9 rounded-xl shrink-0" />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
        <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
      </div>

      <Skeleton className="h-9.5 w-full rounded-xl" />

      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-surface-hover/25 border-b border-border/50">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <div className="p-3 sm:p-4">
          <SkeletonList rows={4} />
        </div>
      </div>
    </div>
  );
}

/** Esqueleto de Orçamentos: Cards de teto planejado e barras de categorias. */
export function BudgetsSkeleton() {
  return (
    <div aria-label="Carregando Orçamentos" className="space-y-6 motion-reduce:animate-none">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de Cartões: Cartão virtual, grid de resumo da fatura e lançamentos. */
export function CardsSkeleton() {
  return (
    <div aria-label="Carregando Cartões" className="space-y-6 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-2">
        <Skeleton className="h-52 sm:h-60 w-full max-w-[400px] rounded-2xl shadow-xs" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <Skeleton className="h-4 w-32 rounded" />
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}

/** Esqueleto de Dívidas & Contas: Resumo de pendências e lista de lançamentos. */
export function DebtsSkeleton() {
  return (
    <div aria-label="Carregando Contas e Dívidas" className="space-y-6 motion-reduce:animate-none">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="flex gap-2 border-b border-border/80 pb-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <Skeleton className="h-4 w-36 rounded" />
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
