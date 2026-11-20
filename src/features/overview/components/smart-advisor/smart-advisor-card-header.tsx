import { ChevronLeft, ChevronRight, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { CalculationBreakdown } from "@/domain/calculation-memory/types";
import { AdvisorCategoryIcon } from "./smart-advisor-category-icon";
import type { SmartAdvisorPresentation } from "./smart-advisor-routing";

export interface SmartAdvisorCardHeaderProps {
  presentation: SmartAdvisorPresentation;
  currentIndex: number;
  totalCount: number;
  isTopSavingsEssential: boolean;
  isSubmitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMarkEssential: () => void;
  onDismiss: () => void;
  hasExternalMarkEssential: boolean;
  breakdown?: CalculationBreakdown;
}

/**
 * Barra superior do SmartAdvisor com categoria, navegação 1 de N e ação de dispensa/essencial.
 */
export function SmartAdvisorCardHeader({
  presentation,
  currentIndex,
  totalCount,
  isTopSavingsEssential,
  isSubmitting,
  onPrev,
  onNext,
  onMarkEssential,
  onDismiss,
  hasExternalMarkEssential,
  breakdown,
}: SmartAdvisorCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 flex items-center justify-center transition-transform motion-safe:duration-150"
          aria-hidden="true"
        >
          <AdvisorCategoryIcon kind={presentation.iconKind} />
        </span>
        <Badge variant={presentation.badgeVariant} size="xs" className="shrink-0 font-medium">
          {presentation.badgeLabel}
        </Badge>
        {breakdown ? (
          <CalculationMemoryModal
            breakdown={breakdown}
            label={`Memória de cálculo de ${presentation.badgeLabel}`}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {totalCount > 1 ? (
          <div className="flex items-center rounded-md border border-border/80 bg-surface-hover/50 px-1 py-0.5">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Sugestão anterior"
              sensoryIntent="selection"
              onClick={onPrev}
              className="relative h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none max-sm:after:absolute max-sm:after:-inset-2.5"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-1.5 select-none whitespace-nowrap">
              {currentIndex + 1} de {totalCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Próxima sugestão"
              sensoryIntent="selection"
              onClick={onNext}
              className="relative h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none max-sm:after:absolute max-sm:after:-inset-2.5"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {isTopSavingsEssential ? (
          <Button
            variant="ghost"
            size="xs"
            aria-label="Manter como essencial"
            title="Manter como essencial"
            sensoryIntent={hasExternalMarkEssential ? "action" : false}
            onClick={onMarkEssential}
            disabled={isSubmitting}
            className="relative h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Manter como essencial</span>
            <span className="sr-only sm:hidden">Manter como essencial</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            aria-label="Dispensar por 30 dias"
            title="Dispensar por 30 dias"
            sensoryIntent="action"
            onClick={onDismiss}
            className="relative h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Dispensar por 30 dias</span>
            <span className="sr-only sm:hidden">Dispensar por 30 dias</span>
          </Button>
        )}
      </div>
    </div>
  );
}
