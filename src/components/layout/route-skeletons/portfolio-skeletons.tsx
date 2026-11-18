import {
  Skeleton,
  SkeletonChart,
  SkeletonKpi,
  SkeletonList,
  SkeletonTable,
} from "@/components/ui/skeleton-base";

/** Esqueleto da Carteira de Investimentos: Grid de 4 KPIs, Card de Caixa e Tabela de Posições. */
export function InvestmentsSkeleton() {
  return (
    <div aria-label="Carregando Investimentos" className="space-y-6 motion-reduce:animate-none">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}

/** Esqueleto da aba de Metas de Investimentos: Presets, pílulas e card de metas com donut. */
export function TargetsSkeleton() {
  return (
    <div
      aria-label="Carregando Metas de Alocação"
      data-tour="targets-classes-card"
      className="flex flex-col gap-5 motion-reduce:animate-none w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 sm:w-48" />
            <Skeleton className="h-3 w-48 sm:w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-center">
          <Skeleton className="h-8 w-24 rounded-lg flex-1 sm:flex-initial" />
          <Skeleton className="h-8 w-28 rounded-lg flex-1 sm:flex-initial" />
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-4 w-16 rounded" />
        </div>

        <div className="flex items-center justify-center py-4">
          <div className="relative flex items-center justify-center">
            <Skeleton className="size-40 sm:size-48 rounded-full" />
            <div className="absolute size-24 sm:size-28 rounded-full bg-surface" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg sm:ml-auto" />
        </div>

        <div className="divide-y divide-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24 sm:w-32" />
                  <Skeleton className="h-3 w-16 sm:w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Esqueleto de Relatórios: Cabeçalho executivo, abas, 4 KPIs e tabela de DRE. */
export function ReportsSkeleton() {
  return (
    <div aria-label="Carregando Relatórios" className="flex flex-col gap-6 w-full min-w-0 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-border/80 pb-2 overflow-x-auto no-scrollbar">
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}

/** Esqueleto de Insights: Abas analíticas, KPIs de diagnóstico, gráfico e recorrências. */
export function InsightsSkeleton() {
  return (
    <div aria-label="Carregando Insights" className="space-y-6 motion-reduce:animate-none">
      <div className="flex gap-2 border-b border-border/80 pb-2 overflow-x-auto no-scrollbar">
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <SkeletonChart />
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
        <Skeleton className="h-4 w-40 rounded" />
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
