import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportKpiItem {
  key?: string;
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: LucideIcon;
  tone?: "positive" | "negative" | "warning" | "default" | "primary" | "accent";
}

export interface ReportKpiGridProps {
  items: readonly ReportKpiItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const TONE_STYLES: Record<NonNullable<ReportKpiItem["tone"]>, { iconColor: string; bgSoft: string }> = {
  default: { iconColor: "text-foreground", bgSoft: "bg-muted/30" },
  primary: { iconColor: "text-primary-strong", bgSoft: "bg-primary/5" },
  positive: { iconColor: "text-positive-strong", bgSoft: "bg-positive/5" },
  negative: { iconColor: "text-negative-strong", bgSoft: "bg-negative/5" },
  warning: { iconColor: "text-warning-strong", bgSoft: "bg-warning/5" },
  accent: { iconColor: "text-accent-foreground", bgSoft: "bg-accent/10" },
};

/**
 * Grade Executiva de KPIs para Relatórios A4 / PDF.
 *
 * Padroniza os blocos de resumo de métricas:
 * - Tipografia mono tabular (.num);
 * - Bordas uniformes de alta definição (print-friendly);
 * - Ícones semânticos com fundo sutil.
 */
export function ReportKpiGrid({
  items,
  columns = 4,
  className,
}: ReportKpiGridProps) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";

  return (
    <section
      aria-label="Grade de Indicadores Chave"
      className={cn("grid gap-3", colClass, className)}
    >
      {items.map((item, index) => {
        const tone = item.tone ?? "default";
        const toneStyle = TONE_STYLES[tone];
        const Icon = item.icon;

        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            className="rounded-xl border border-border/80 bg-muted/20 p-3.5 flex flex-col justify-between gap-1.5 break-inside-avoid print:bg-white print:border-border print:p-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider line-clamp-1 print:text-[10px]">
                {item.label}
              </span>
              {Icon && (
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md shrink-0 print:border print:border-border/60",
                    toneStyle.bgSoft,
                    toneStyle.iconColor,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="num font-mono text-base sm:text-lg font-bold text-foreground print:text-base">
                {item.value}
              </div>
              {item.subtext && (
                <div className="text-[11px] text-muted-foreground mt-0.5 print:text-[10px]">
                  {item.subtext}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
