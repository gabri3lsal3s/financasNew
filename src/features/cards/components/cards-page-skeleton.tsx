import { Skeleton, SkeletonKpi, SkeletonList } from "@/components/ui";
import { KpiGrid } from "@/components/modules";

/** Esqueleto estruturado da tela de Cartões (Zero CLS). */
export function CardsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-tour="cards-content">
      <div className="flex justify-center py-2">
        <Skeleton className="h-52 sm:h-60 w-full max-w-[400px] rounded-2xl shadow-xs" />
      </div>
      <KpiGrid columns={3} data-tour="cards-invoice-summary">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </KpiGrid>
      <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/80">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
