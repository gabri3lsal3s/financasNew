import type { ReactNode } from "react";

export interface ReportExecutiveSummaryItem {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  tone?: "positive" | "negative" | "primary" | "portfolio" | "default";
}

export interface ReportExecutiveSummaryProps {
  items: readonly ReportExecutiveSummaryItem[];
  narrative?: string | ReactNode;
  title?: string;
}

/**
 * Faixa de Resumo Executivo Institucional para Relatórios A4/PDF.
 * Apresenta as métricas-chave em linha única e um parágrafo narrativo de síntese
 * com tipografia nobre e divisores sutis, sem molduras de caixas cinzas pesadas.
 */
export function ReportExecutiveSummary({
  items,
  narrative,
  title = "SÍNTESE PATRIMONIAL & DESEMPENHO",
}: ReportExecutiveSummaryProps) {
  return (
    <section
      aria-label={title}
      className="break-inside-avoid flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-4.5 print:p-4 print:bg-white print:border-slate-200/90 shadow-2xs"
    >
      {/* Título de Seção Sutil */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/70 pb-1.5 flex items-center justify-between">
        <span>{title}</span>
      </div>

      {/* Grade Horizontal de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3.5 sm:gap-4 print:gap-4 py-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
              {item.label}
            </span>
            <div className="text-sm sm:text-base font-bold font-mono num tracking-tight text-foreground leading-snug">
              {item.value}
            </div>
            {item.subtext && (
              <span className="text-[10.5px] text-muted-foreground font-medium leading-tight">
                {item.subtext}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Parecer / Contexto Narrativo */}
      {narrative && (
        <div className="pt-2.5 border-t border-border/70 text-[11px] leading-relaxed text-foreground print:text-slate-900">
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
