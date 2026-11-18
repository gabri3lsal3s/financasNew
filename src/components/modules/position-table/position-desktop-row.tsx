import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import type { PositionRow } from "@/components/modules/portfolio/position-types";
import type { PositionColumnDef } from "./position-columns";

export interface PositionDesktopHeaderProps {
  columns: readonly PositionColumnDef[];
  isSubHeader?: boolean;
}

export function PositionDesktopHeader({ columns, isSubHeader = false }: PositionDesktopHeaderProps) {
  return (
    <div
      role="row"
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-b border-border/80",
        isSubHeader ? "bg-surface-hover/40 text-muted-foreground" : "bg-surface text-muted-foreground",
      )}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          role="columnheader"
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            col.className ?? "flex-1",
            col.align === "right" ? "text-right" : "text-left",
          )}
        >
          {col.header}
        </div>
      ))}
    </div>
  );
}

export interface PositionDesktopRowProps {
  row: PositionRow;
  columns: readonly PositionColumnDef[];
  isHighlighted: boolean;
  onOpen?: (assetId: string, ticker: string) => void;
}

export function PositionDesktopRow({
  row,
  columns,
  isHighlighted,
  onOpen,
}: PositionDesktopRowProps) {
  const isClickable = Boolean(onOpen);

  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }
    onOpen(row.assetId, row.ticker);
  };

  return (
    <div
      id={`asset-row-${row.assetId}`}
      role="row"
      onClick={isClickable ? handleRowClick : undefined}
      className={cn(
        "flex items-center gap-3 border-b border-border/60 px-4 py-2.5 sm:py-2 transition-colors last:border-b-0 scroll-mt-24",
        isHighlighted && "bg-primary/10 ring-2 ring-primary ring-inset shadow-xs",
        isClickable && "cursor-pointer hover:bg-muted/60 active:bg-muted/80",
      )}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          role="cell"
          className={cn(
            "text-sm text-foreground",
            col.className ?? "flex-1",
            col.align === "right" ? "text-right" : "text-left",
          )}
        >
          {col.cell(row)}
        </div>
      ))}
    </div>
  );
}
