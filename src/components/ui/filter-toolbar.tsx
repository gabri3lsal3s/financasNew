import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterToolbarProps extends HTMLAttributes<HTMLDivElement> {
  searchSlot?: ReactNode;
  filtersSlot?: ReactNode;
  chipsSlot?: ReactNode;
  actionsSlot?: ReactNode;
}

/**
 * Contêiner canônico para barras de filtro e busca em páginas de listagem (DRY).
 * Garante responsividade mobile-first, prevenindo esmagamento em smartphones
 * e alinhando busca, dropdowns e ações de forma simétrica no desktop.
 */
export function FilterToolbar({
  searchSlot,
  filtersSlot,
  chipsSlot,
  actionsSlot,
  className,
  ...props
}: FilterToolbarProps) {
  const hasControls = Boolean(searchSlot || filtersSlot);

  return (
    <div className={cn("flex flex-col gap-3 w-full min-w-0", className)} {...props}>
      {hasControls && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between min-w-0">
          {searchSlot && (
            <div className="w-full sm:max-w-xs md:max-w-sm flex-1 min-w-0">
              {searchSlot}
            </div>
          )}

          {filtersSlot && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 justify-end min-w-0">
              {filtersSlot}
            </div>
          )}
        </div>
      )}

      {(chipsSlot || actionsSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5 min-w-0">
          {chipsSlot ? <div className="min-w-0 flex-1">{chipsSlot}</div> : <div />}
          {actionsSlot && <div className="shrink-0 self-end sm:self-auto">{actionsSlot}</div>}
        </div>
      )}
    </div>
  );
}
