import { ArrowDownRight, ArrowUpRight, PiggyBank } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface ReportWaterfallStep {
  key: string;
  label: string;
  amountCents: number;
  pctOfTotal: number;
  type: "income" | "expense" | "savings";
}

export interface ReportWaterfallBarProps {
  title?: string;
  grossIncomeCents: number;
  steps: readonly ReportWaterfallStep[];
  className?: string;
}

/**
 * Cascata Visual de Fluxo Financeiro (DRE Waterfall) para Relatórios A4 / PDF.
 *
 * Apresenta o fluxo em degraus proporcionais:
 * Receitas Brutas -> Custos Essenciais -> Estilo de Vida -> Poupança & Investimentos.
 */
export function ReportWaterfallBar({
  title = "Fluxo Contábil & Destinação da Renda (Cascata DRE)",
  grossIncomeCents,
  steps,
  className,
}: ReportWaterfallBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/10 p-4 break-inside-avoid print:bg-white print:border-border",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h4>
        <span className="text-xs text-muted-foreground">
          Base: <MoneyText cents={grossIncomeCents} className="font-bold text-foreground" /> (100%)
        </span>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        {steps.map((step) => {
          const isIncome = step.type === "income";
          const isSavings = step.type === "savings";
          const isExpense = step.type === "expense";

          return (
            <div key={step.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  {isIncome ? (
                    <ArrowUpRight className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                  ) : isSavings ? (
                    <PiggyBank className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3.5 text-negative-strong shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-foreground">{step.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  <MoneyText
                    cents={step.amountCents}
                    tone={isIncome || isSavings ? "positive" : "negative"}
                    className="font-bold font-mono num"
                  />
                  <span className="num font-mono text-[11px] text-muted-foreground w-12 text-right">
                    {step.pctOfTotal.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Barra de Progresso do Degrau */}
              <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden border border-border/40">
                <div
                  style={{ width: `${Math.min(Math.max(step.pctOfTotal, 0), 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    isIncome && "bg-positive-strong",
                    isExpense && "bg-negative-strong",
                    isSavings && "bg-primary-strong",
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
