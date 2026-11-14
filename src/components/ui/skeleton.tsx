import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(110deg,var(--color-muted)_35%,var(--color-surface-hover)_50%,var(--color-muted)_65%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------------
   F12 — Skeleton Loaders por contexto: esqueletos compostos no formato real
   dos componentes (listas, KPIs, gráficos e tabelas), substituindo os blocos
   genéricos. Todos os blocos herdam o shimmer do Skeleton base.
   ------------------------------------------------------------------------ */

/** Esqueleto de linha de lista (ícone + linhas + valor) — formato das listas do app. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de card de KPI (rótulo + valor) — formato dos KPIs da Visão Geral (Zero CLS). */
export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 lg:p-5 shadow-xs h-full min-h-[92px] sm:min-h-[104px]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

/** Esqueleto de gráfico — card estruturado no formato real dos charts (fluxo, donut, relatórios) para Zero CLS. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs min-h-[260px] sm:min-h-[290px] w-full",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <Skeleton className="h-40 sm:h-48 w-full rounded-xl" />
      <div className="flex items-center justify-between gap-2 pt-1">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  );
}

/** Esqueleto de tabela (linhas de cabeçalho + corpo) — formato das tabelas de dados (Zero CLS). */
export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg shrink-0" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 sm:w-36" />
              <Skeleton className="h-3 w-16 sm:w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto do card hero de caixa da Visão Geral (§F49). */
export function SkeletonHeroCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 sm:w-44" />
            <Skeleton className="h-3 w-48 sm:w-64" />
          </div>
        </div>
        <Skeleton className="h-8 w-full sm:w-36 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-44 sm:w-56" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

/** Esqueleto da Visão Geral (Home): Hero de Caixa Real, Grid de KPIs, Carrossel de Alertas e Gráficos. */
export function OverviewSkeleton() {
  return (
    <div aria-label="Carregando Visão Geral" className="space-y-6 motion-reduce:animate-none">
      <SkeletonHeroCard />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkeletonChart />
        </div>
        <div>
          <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
            <Skeleton className="h-4 w-28 rounded" />
            <SkeletonList rows={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

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

/** Esqueleto de Transações: Filtro de busca, resumo mensal e lista agrupada por data. */
export function TransactionsSkeleton() {
  return (
    <div aria-label="Carregando Transações" className="space-y-6 motion-reduce:animate-none">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <Skeleton className="h-10 flex-1 max-w-md rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
          <Skeleton className="h-4 w-24 rounded" />
          <SkeletonList rows={5} />
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

/** Esqueleto de Relatórios: Cabeçalho executivo e tabela de DRE. */
export function ReportsSkeleton() {
  return (
    <div aria-label="Carregando Relatórios" className="space-y-6 motion-reduce:animate-none">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <Skeleton className="h-6 w-48 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <SkeletonTable rows={7} />
    </div>
  );
}

/** Esqueleto de Configurações: Layout de abas e cards de configuração. */
export function SettingsSkeleton() {
  return (
    <div aria-label="Carregando Configurações" className="space-y-6 motion-reduce:animate-none">
      <div className="flex gap-2 border-b border-border/60 pb-2 overflow-x-auto">
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
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

