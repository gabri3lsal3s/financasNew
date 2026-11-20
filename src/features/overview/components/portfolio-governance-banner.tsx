import { ChevronRight, ShieldAlert } from "lucide-react";
import { Badge, Button } from "@/components/ui";

export interface PortfolioGovernanceBannerProps {
  overdueReviewsCount: number;
  onReview: () => void;
}

/**
 * Banner de alerta do carrossel para teses de carteira com revisão vencida.
 */
export function PortfolioGovernanceBanner({
  overdueReviewsCount,
  onReview,
}: PortfolioGovernanceBannerProps) {
  return (
    <div
      role="alert"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/15 text-warning-strong"
          aria-hidden="true"
        >
          <ShieldAlert className="size-4.5" />
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
              Revisão de Teses de Carteira
            </h2>
            <Badge size="xs" variant="warning">
              {overdueReviewsCount} {overdueReviewsCount === 1 ? "ativo pendente" : "ativos pendentes"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 break-words">
            {overdueReviewsCount === 1
              ? "1 ativo da sua carteira ultrapassou a periodicidade de governança sem revisão."
              : `${overdueReviewsCount} ativos da sua carteira ultrapassaram a periodicidade de governança sem revisão.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReview}
          className="w-full sm:w-auto h-8 text-xs font-medium cursor-pointer gap-1.5"
        >
          <span>Revisar Teses</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
