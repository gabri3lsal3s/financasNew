import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";

export interface SmartAdvisorCardSkeletonProps {
  className?: string;
}

/**
 * Esqueleto estável de carregamento do SmartAdvisorCard (§15.2).
 * Adota a altura mínima canônica estável (`min-h-[148px] sm:min-h-[140px]`),
 * prevenindo Cumulative Layout Shift (CLS) e flashes ao carregar a Home.
 */
export function SmartAdvisorCardSkeleton({ className }: SmartAdvisorCardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Carregando recomendações do assistente..."
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-colors",
        "min-h-[148px] sm:min-h-[140px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
      </div>

      <div className="my-2.5 flex flex-col gap-2">
        <Skeleton className="h-5 w-44 rounded-md" />
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-3/4 max-w-sm rounded-md" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-20 rounded-md hidden sm:block" />
      </div>
    </div>
  );
}
