import type { ReactNode } from "react";
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
 * O número de linhas é grande demais para usar `<table>` com legibilidade em telas
 * pequenas, então usa grid semântico com `role="table"`.
 */
export function DataList<T>({
  columns,
  rows,
  rowKey,
  density = "default",
  emptyMessage = "Nenhum registro encontrado.",
  className,
}: DataListProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-surface shadow-sm", className)}>
      <div role="table" aria-label="Lista de dados" className="min-w-full">
        <div role="row" className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={cn(
                "flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
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
              className={cn(
                "flex items-center gap-3 border-b border-border/60 px-4 transition-colors last:border-b-0 hover:bg-muted/40",
                densityClass[density],
              )}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  role="cell"
                  className={cn(
                    "flex-1 text-sm text-foreground",
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
