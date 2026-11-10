import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KpiGridProps extends ComponentPropsWithoutRef<"div"> {
  /** Número máximo de colunas no desktop largo (`2`, `3` ou `4`). Padrão: `3`. */
  columns?: 2 | 3 | 4;
  children: ReactNode;
}

const columnStyles: Record<2 | 3 | 4, string> = {
  2: "grid grid-cols-2 gap-3 sm:gap-3.5",
  3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5",
  4: "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5",
};

/**
 * Grid canônico para métricas financeiras (Regra 10 e Regra 24 do AGENTS.md).
 * Garante:
 * - Mobile-first adaptativo, proibindo `grid-cols-3` rígido em smartphones.
 * - Espaçamentos canônicos e alinhamento uniforme para cartões `<KpiCard />`.
 */
export function KpiGrid({ columns = 3, className, children, ...props }: KpiGridProps) {
  return (
    <div className={cn(columnStyles[columns], "w-full min-w-0", className)} {...props}>
      {children}
    </div>
  );
}
