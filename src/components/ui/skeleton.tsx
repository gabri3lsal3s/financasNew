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

/** Esqueleto de card de KPI (rótulo + valor) — formato dos KPIs da Visão Geral. */
export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-surface p-4", className)} aria-hidden="true">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

/** Esqueleto de gráfico — bloco alto no formato dos charts (fluxo, donut, relatórios). */
export function SkeletonChart({ className }: { className?: string }) {
  return <Skeleton className={cn("h-48 w-full rounded-xl", className)} />;
}

/** Esqueleto de tabela (linhas de cabeçalho + corpo) — formato das tabelas de dados. */
export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      <Skeleton className="h-4 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}
