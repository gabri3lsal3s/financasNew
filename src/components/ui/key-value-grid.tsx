import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KeyValueItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  fullWidth?: boolean;
}

export interface KeyValueGridProps extends HTMLAttributes<HTMLDivElement> {
  items: readonly KeyValueItem[];
  columns?: 1 | 2;
  variant?: "surface" | "borderless";
}

/**
 * Grid padronizado para exibição de dados e metadados Chave / Valor (DRY).
 * Unifica telas de auditoria, detalhes de transação, fichas e cabeçalhos de chamados.
 */
export function KeyValueGrid({
  items,
  columns = 2,
  variant = "surface",
  className,
  ...props
}: KeyValueGridProps) {
  const isSurface = variant === "surface";

  return (
    <div
      className={cn(
        "grid gap-2.5 sm:gap-3 text-xs",
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        isSurface && "p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface/80",
        className,
      )}
      {...props}
    >
      {items.map((item, index) => {
        const itemKey = item.key ?? (typeof item.label === "string" ? item.label : String(index));

        return (
          <div
            key={itemKey}
            className={cn(
              "flex flex-col gap-0.5 min-w-0",
              item.fullWidth && columns === 2 && "sm:col-span-2",
            )}
          >
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              {item.icon}
              <span>{item.label}</span>
            </span>
            <div className="font-semibold text-foreground min-w-0 break-words leading-relaxed">
              {item.value}
            </div>
            {item.hint && (
              <span className="text-[10px] text-muted-foreground">{item.hint}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
