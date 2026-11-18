import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PositionPaginationProps {
  startIndex: number;
  endIndex: number;
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
}

export function PositionPagination({
  startIndex,
  endIndex,
  totalCount,
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange,
}: PositionPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>
          Exibindo{" "}
          <strong className="text-foreground font-medium">
            {startIndex}–{endIndex}
          </strong>{" "}
          de {totalCount} ativos
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1">
          <span className="text-[11px]">Por página:</span>
          {[10, 25].map((size) => (
            <Button
              key={size}
              type="button"
              variant={pageSize === size ? "secondary" : "ghost"}
              size="xs"
              sensoryIntent="selection"
              onClick={() => onPageSizeChange(size)}
              className="h-7 px-2 text-xs"
            >
              {size}
            </Button>
          ))}
          <Button
            type="button"
            variant={pageSize === Infinity ? "secondary" : "ghost"}
            size="xs"
            sensoryIntent="selection"
            onClick={() => onPageSizeChange(Infinity)}
            className="h-7 px-2 text-xs"
          >
            Todos
          </Button>
        </div>

        {pageSize !== Infinity && totalPages > 1 ? (
          <div className="flex items-center gap-1.5 sm:border-l sm:border-border/60 sm:pl-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="size-8 p-0"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="text-xs px-1.5 font-medium text-foreground tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="size-8 p-0"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
