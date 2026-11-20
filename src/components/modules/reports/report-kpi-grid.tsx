import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportKpiItem {
  key?: string;
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: LucideIcon;
  tone?: "positive" | "negative" | "warning" | "default" | "primary" | "accent" | "portfolio";
}

export interface ReportKpiGridProps {
  items: readonly ReportKpiItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const TONE_STYLES: Record<NonNullable<ReportKpiItem["tone"]>, { iconColor: string; bgSoft: string }> = {
  default: { iconColor: "text-muted-foreground", bgSoft: "bg-muted/30" },
  primary: { iconColor: "text-primary-strong", bgSoft: "bg-primary/10" },
  positive: { iconColor: "text-positive-strong", bgSoft: "bg-positive/10" },
  negative: { iconColor: "text-negative-strong", bgSoft: "bg-negative/10" },
  warning: { iconColor: "text-warning-strong", bgSoft: "bg-warning/15" },
  accent: { iconColor: "text-accent-foreground", bgSoft: "bg-accent/15" },
  portfolio: { iconColor: "text-portfolio", bgSoft: "bg-portfolio/10" },
};

/**
 * Grade Executiva de Indicadores-Chave (Universal KPI Strip) para Relatórios A4 / PDF.
 *
 * Características canônicas (AGENTS.md Regras 10, 11 e 13):
 * - Grid simétrico com colunas iguais (2, 3 ou 4 colunas);
 * - Ícones sóbrios em padrão icon-only no impresso (Nível 1, sem caixas decorativas);
 * - Alinhamento óptico absoluto da linha de base dos valores com font-mono e tabular-nums;
 * - Prevenção de quebra de página interna (break-inside: avoid).
 */
export function ReportKpiGrid({
  items,
  columns = 4,
  className,
}: ReportKpiGridProps) {
  const colClass =
    columns === 2
      ? "grid-cols-2 print:grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3 print:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4 print:grid-cols-4";

  return (
    <section
      aria-label="Grade de Indicadores Chave"
      className={cn("grid gap-2.5 sm:gap-3 break-inside-avoid", colClass, className)}
    >
      {items.map((item, index) => {
        const tone = item.tone ?? "default";
        const toneStyle = TONE_STYLES[tone];
        const Icon = item.icon;

        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            className="rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 flex flex-col justify-between gap-1.5 break-inside-avoid print:bg-surface print:border-border print:p-2.5 shadow-xs"
          >
            {/* Camada 1: Rótulo UPPERCASE e Ícone Sóbrio */}
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider line-clamp-1 truncate print:text-[9.5pt]">
                {item.label}
              </span>
              {Icon && (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center shrink-0 print:size-auto print:bg-transparent print:border-0",
                    toneStyle.iconColor,
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-3.5 print:size-3" aria-hidden="true" />
                </span>
              )}
            </div>

            {/* Camada 2 e 3: Grande Número de Destaque + Metadado de Apoio */}
            <div className="flex flex-col min-w-0">
              <div className="num font-mono text-base sm:text-lg font-bold text-foreground print:text-base tabular-nums tracking-tight leading-tight whitespace-nowrap">
                {item.value}
              </div>
              {item.subtext && (
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5 line-clamp-1 truncate print:text-[9.5pt] leading-tight">
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
