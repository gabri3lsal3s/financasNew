import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior">
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">Página {page} de {pageCount}</span>
      <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Próxima página">
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
