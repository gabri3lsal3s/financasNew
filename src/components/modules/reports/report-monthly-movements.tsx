import type { ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export interface ReportMonthlyMovementsProps {
  monthBuysBRL: number;
  monthSellsBRL: number;
  monthDividendsBRL: number;
  monthNetContributionBRL: number;
  transactionsCount?: number;
  dividendsCount?: number;
  pqs?: number | null;
  variant?: "grid" | "strip";
  title?: string;
  className?: string;
  footnote?: ReactNode;
}

/**
 * Painel de Movimentações e Fluxo de Caixa da Competência para Relatórios A4/PDF.
 * Suporta o modo fita linear horizontal unificada (`variant="strip"`) e o modo grade detalhada (`variant="grid"`).
 */
export function ReportMonthlyMovements({
  monthBuysBRL,
  monthSellsBRL,
  monthDividendsBRL,
  monthNetContributionBRL,
  transactionsCount,
  dividendsCount,
  pqs,
  variant = "grid",
  title = "MOVIMENTAÇÕES DA COMPETÊNCIA",
  className,
  footnote,
}: ReportMonthlyMovementsProps) {
  const hasCounts = transactionsCount !== undefined || dividendsCount !== undefined;
  const isNetPositive = monthNetContributionBRL > 0;
  const isNetNegative = monthNetContributionBRL < 0;

  // Invariante de Fluxo Externo: Se houve aporte líquido externo injetado, não pode exibir "0 operações"
  const effectiveTransactionsCount =
    (transactionsCount ?? 0) === 0 && Math.abs(monthNetContributionBRL) > 0.001
      ? 1
      : transactionsCount ?? 0;

  const countsText = `${effectiveTransactionsCount} ${effectiveTransactionsCount === 1 ? "operação" : "operações"} · ${dividendsCount ?? 0} ${dividendsCount === 1 ? "provento" : "proventos"}`;

  if (variant === "strip") {
    return (
      <section
        aria-label={title}
        className={cn(
          "break-inside-avoid rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2.5 print:bg-surface print:border-border shadow-xs",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground mr-1">
            <ArrowLeftRight className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>{title}</span>
          </div>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            <span>Compras do Mês</span>: <MoneyText cents={numberToCents(monthBuysBRL)} tone="portfolio" className="font-bold text-foreground inline" />
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            <span>Vendas do Mês</span>: <MoneyText cents={numberToCents(monthSellsBRL)} tone="portfolio" className="font-bold text-foreground inline" />
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            <span>Proventos do Mês</span>: <MoneyText cents={numberToCents(monthDividendsBRL)} tone={monthDividendsBRL > 0 ? "positive" : "portfolio"} className="font-bold inline" />
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            <span>Aporte Líquido Injetado</span>:{" "}
            <MoneyText
              cents={numberToCents(monthNetContributionBRL)}
              sign="explicit"
              tone={isNetPositive ? "positive" : isNetNegative ? "negative" : "portfolio"}
              className="font-bold inline"
            />
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          {pqs !== null && pqs !== undefined && (
            <span className="font-semibold text-foreground">
              Score PQS: {pqs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10
            </span>
          )}
          {hasCounts && (
            <span>{countsText}</span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn(
        "break-inside-avoid flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 print:p-4 print:bg-surface print:border-border shadow-xs",
        className,
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/80 pb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {hasCounts && (
          <span className="font-mono num text-[11px] text-muted-foreground font-normal normal-case tabular-nums">
            {countsText}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3.5 sm:gap-4 print:gap-4 py-0.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Compras do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tabular-nums tracking-tight text-foreground leading-snug">
            <MoneyText cents={numberToCents(monthBuysBRL)} tone="portfolio" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">
            Aquisições de ativos
          </span>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Vendas do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tabular-nums tracking-tight text-foreground leading-snug">
            <MoneyText cents={numberToCents(monthSellsBRL)} tone="portfolio" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">
            Alienações e resgates
          </span>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Proventos do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tabular-nums tracking-tight text-foreground leading-snug">
            <MoneyText
              cents={numberToCents(monthDividendsBRL)}
              tone={monthDividendsBRL > 0 ? "positive" : "portfolio"}
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">
            Dividendos e rendimentos
          </span>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Aporte Líquido Injetado
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tabular-nums tracking-tight leading-snug">
            <MoneyText
              cents={numberToCents(monthNetContributionBRL)}
              sign="explicit"
              tone={isNetPositive ? "positive" : isNetNegative ? "negative" : "portfolio"}
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">
            Fluxo externo líquido
          </span>
        </div>
      </div>

      {footnote && (
        <div className="pt-2 border-t border-border/80 text-[11px] text-muted-foreground leading-relaxed">
          {footnote}
        </div>
      )}
    </section>
  );
}
