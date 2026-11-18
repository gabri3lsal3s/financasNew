import type { ReactNode } from "react";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface DataListColumn<T> {
  key: string;
  header: ReactNode;
  /** Renderizador da célula. */
  cell: (row: T, index: number) => ReactNode;
  /** Alinhamento do cabeçalho e das células. */
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DataListProps<T> {
  columns: DataListColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  density?: "compact" | "default" | "comfortable";
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

const densityClass = {
  compact: "py-1.5",
  default: "py-2.5",
  comfortable: "py-3.5",
} as const;

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * DataList — tabela primitiva do app (substitui tabelas ad-hoc; DESIGN_SYSTEM §13).
 * Conecta a preferência global `visual.density`, ativa rolagem horizontal segura
 * para 4+ colunas e dispara feedback tátil `"selection"` em linhas clicáveis.
 */
export function DataList<T>({
  columns,
  rows,
  rowKey,
  density,
  emptyMessage = "Nenhum registro encontrado.",
  className,
  onRowClick,
}: DataListProps<T>) {
  const visual = useVisualCustomization();
  const effectiveDensity: keyof typeof densityClass =
    density ??
    (visual.density === "compact"
      ? "compact"
      : visual.density === "comfortable"
        ? "comfortable"
        : "default");

  const hasWideColumns = columns.length >= 4;

  const handleRowActivate = (row: T) => {
    if (!onRowClick) return;
    triggerSensory("selection");
    onRowClick(row);
  };

  return (
    <div
      className={cn(
        "overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs",
        className,
      )}
    >
      <div
        role="table"
        aria-label="Lista de dados"
        className={cn(hasWideColumns ? "w-max min-w-full" : "min-w-full")}
      >
        <div role="row" className="flex items-center gap-3 border-b border-border/80 px-4 py-2.5">
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={cn(
                "flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                hasWideColumns && "min-w-[110px]",
                alignClass[column.align ?? "left"],
                column.className,
              )}
            >
              {column.header}
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          rows.map((row, index) => (
            <div
              key={rowKey(row, index)}
              role="row"
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => handleRowActivate(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowActivate(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex items-center gap-3 border-b border-border/80 px-4 transition-colors last:border-b-0",
                onRowClick
                  ? "min-h-11 sm:min-h-0 cursor-pointer hover:bg-muted/60 active:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
                  : "hover:bg-muted/40",
                densityClass[effectiveDensity],
              )}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  role="cell"
                  className={cn(
                    "flex-1 text-sm text-foreground",
                    hasWideColumns && "min-w-[110px]",
                    alignClass[column.align ?? "left"],
                    column.className,
                  )}
                >
                  {column.cell(row, index)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
