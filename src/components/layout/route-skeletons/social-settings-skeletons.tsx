import {
  Skeleton,
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
    <div aria-label="Carregando Orçamento Familiar" className="flex flex-col gap-5 sm:gap-6 min-w-0 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-1">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
        <Skeleton className="h-5 w-44 rounded" />
        <SkeletonList rows={3} />
      </div>
    </div>
  );
}

/** Esqueleto de Lembretes: Abas de pendências/lidos e central de alertas. */
export function RemindersSkeleton() {
  return (
    <div aria-label="Carregando Lembretes" className="flex flex-col gap-5 sm:gap-6 min-w-0 motion-reduce:animate-none">
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
    <div aria-label="Carregando Configurações" className="flex flex-col gap-5 sm:gap-6 min-w-0 motion-reduce:animate-none">
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
