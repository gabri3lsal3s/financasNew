import { Skeleton } from "@/components/ui";

export function InsightsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-8 w-28 rounded-lg mt-1" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
