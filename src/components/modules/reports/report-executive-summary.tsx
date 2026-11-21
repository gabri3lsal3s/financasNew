import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ReportExecutiveSummaryItem {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
}

export interface ReportExecutiveSummaryProps {
  items: readonly ReportExecutiveSummaryItem[];
  narrative?: string | ReactNode;
  title?: string;
  className?: string;
}

/**
 * Faixa de Resumo Executivo Institucional para Relatórios A4/PDF.
 *
 * Adota a anatomia editorial canônica:
 * - Em tela: card elevado suave com border-border/80;
 * - Em impressão: contêiner limpo delimitado por filetes horizontais superior e inferior (sem caixas pesadas);
 * - Alinhamento óptico absoluto da linha de base dos 4 KPIs com algarismos tabulares;
 * - Texto narrativo explicativo alinhado estritamente à esquerda (nunca justificado).
 */
export function ReportExecutiveSummary({
  items,
  narrative,
  title = "SÍNTESE PATRIMONIAL & DESEMPENHO",
  className,
}: ReportExecutiveSummaryProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "break-inside-avoid flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs print:p-2.5 print:gap-2 print:bg-transparent print:border-y print:border-x-0 print:border-border/80 print:rounded-none print:shadow-none",
        className,
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/80 pb-1 flex items-center justify-between">
        <span>{title}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-4 py-0.5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[7.5pt] sm:text-[8pt] uppercase font-bold tracking-wider text-muted-foreground truncate print:text-[7.5pt] print:leading-tight">
              {item.label}
            </span>
            <div className="text-sm sm:text-base font-bold font-mono num tabular-nums tracking-tight text-foreground leading-snug">
              {item.value}
            </div>
            {item.subtext && (
              <span className="text-[10px] text-muted-foreground font-medium leading-tight truncate print:text-[7.5pt] print:leading-tight">
                {item.subtext}
              </span>
            )}
          </div>
        ))}
      </div>

      {narrative && (
        <div className="pt-2 border-t border-border/80 text-[10.5pt] print:text-[9pt] print:leading-normal print:pt-1.5 leading-relaxed text-foreground text-left">
          {typeof narrative === "string" ? (
            <p className="m-0 font-normal">{narrative}</p>
          ) : (
            narrative
          )}
        </div>
      )}
    </section>
  );
}
