import {
  Skeleton,
  SkeletonKpi,
  SkeletonList,
} from "@/components/ui/skeleton-base";

/** Esqueleto de Modo Viagem: Cabeçalho, abas de viagens e cards de viagens. */
export function TripsSkeleton() {
  return (
    <div aria-label="Carregando Viagens" className="space-y-6 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36 rounded-xl" />
      </div>
      <div className="flex gap-2 border-b border-border/80 pb-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Esqueleto de Orçamento Familiar: Resumo compartilhado do lar, KPIs e contribuições. */
export function FamilySkeleton() {
  return (
    <div aria-label="Carregando Orçamento Familiar" className="space-y-6 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <Skeleton className="h-8 w-52 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
        <Skeleton className="h-4 w-44 rounded" />
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}

/** Esqueleto de Lembretes: Abas de pendências/lidos e central de alertas. */
export function RemindersSkeleton() {
  return (
    <div aria-label="Carregando Lembretes" className="space-y-6 motion-reduce:animate-none">
      <div className="flex gap-2 border-b border-border/80 pb-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <SkeletonList rows={5} />
      </div>
    </div>
  );
}

/** Esqueleto de Configurações: 6 abas e cards de configuração. */
export function SettingsSkeleton() {
  return (
    <div aria-label="Carregando Configurações" className="space-y-6 motion-reduce:animate-none">
      <div
        data-testid="settings-skeleton-tabs"
        className="flex gap-2 border-b border-border/80 pb-2 overflow-x-auto no-scrollbar"
      >
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
          <div className="pt-2 flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
      </div>
    </div>
  );
}
