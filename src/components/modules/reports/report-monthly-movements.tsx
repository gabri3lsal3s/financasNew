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
  title?: string;
  className?: string;
  footnote?: ReactNode;
}

/**
 * Painel de Movimentações e Fluxo de Caixa da Competência para Relatórios A4/PDF (§F40/F51).
 *
 * Apresenta o fluxo do período em 4 quadrantes executivos:
 * 1. Compras do Mês (aquisições de ativos / turnover de compra)
 * 2. Vendas do Mês (alienações de ativos / turnover de venda)
 * 3. Proventos do Mês (dividendos, JCP e rendimentos creditados)
 * 4. Aporte Líquido Injetado (fluxo externo de capital do bolso)
 */
export function ReportMonthlyMovements({
  monthBuysBRL,
  monthSellsBRL,
  monthDividendsBRL,
  monthNetContributionBRL,
  transactionsCount,
  dividendsCount,
  title = "MOVIMENTAÇÕES DA COMPETÊNCIA",
  className,
  footnote,
}: ReportMonthlyMovementsProps) {
  const hasCounts = transactionsCount !== undefined || dividendsCount !== undefined;
  const isNetPositive = monthNetContributionBRL > 0;
  const isNetNegative = monthNetContributionBRL < 0;

  return (
    <section
      aria-label={title}
      className={cn(
        "break-inside-avoid flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-4.5 print:p-4 print:bg-white print:border-slate-200/90 shadow-2xs",
        className,
      )}
    >
      {/* Título de Seção Sutil com Ícone Nível 1 (Icon-Only) */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/70 pb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {hasCounts && (
          <span className="font-mono num text-[10.5px] text-muted-foreground font-normal normal-case">
            {transactionsCount ?? 0} {transactionsCount === 1 ? "operação" : "operações"} ·{" "}
            {dividendsCount ?? 0} {dividendsCount === 1 ? "provento" : "proventos"}
          </span>
        )}
      </div>

      {/* Grade Horizontal de 4 Métricas de Movimentação */}
      <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3.5 sm:gap-4 print:gap-4 py-0.5">
        {/* 1. Compras */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Compras do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tracking-tight text-foreground leading-snug">
            <MoneyText cents={numberToCents(monthBuysBRL)} tone="portfolio" />
          </div>
          <span className="text-[10.5px] text-muted-foreground font-medium leading-tight">
            Aquisições de ativos
          </span>
        </div>

        {/* 2. Vendas */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Vendas do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tracking-tight text-foreground leading-snug">
            <MoneyText cents={numberToCents(monthSellsBRL)} tone="portfolio" />
          </div>
          <span className="text-[10.5px] text-muted-foreground font-medium leading-tight">
            Alienações e resgates
          </span>
        </div>

        {/* 3. Proventos */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Proventos do Mês
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tracking-tight text-foreground leading-snug">
            <MoneyText
              cents={numberToCents(monthDividendsBRL)}
              tone={monthDividendsBRL > 0 ? "positive" : "portfolio"}
            />
          </div>
          <span className="text-[10.5px] text-muted-foreground font-medium leading-tight">
            Dividendos e rendimentos
          </span>
        </div>

        {/* 4. Aporte Líquido */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
            Aporte Líquido Injetado
          </span>
          <div className="text-sm sm:text-base font-bold font-mono num tracking-tight leading-snug">
            <span
              className={
                isNetPositive
                  ? "text-positive-strong"
                  : isNetNegative
                    ? "text-negative-strong"
                    : "text-foreground"
              }
            >
              <MoneyText
                cents={numberToCents(monthNetContributionBRL)}
                sign="explicit"
                tone={isNetPositive ? "positive" : isNetNegative ? "negative" : "portfolio"}
              />
            </span>
          </div>
          <span className="text-[10.5px] text-muted-foreground font-medium leading-tight">
            Fluxo externo líquido
          </span>
        </div>
      </div>

      {/* Nota / Rodapé Explicativo */}
      {footnote && (
        <div className="pt-2 border-t border-border/70 text-[10.5px] text-muted-foreground leading-relaxed">
          {footnote}
        </div>
      )}
    </section>
  );
}
