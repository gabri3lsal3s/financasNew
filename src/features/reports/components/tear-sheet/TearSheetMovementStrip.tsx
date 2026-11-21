import { Calendar } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { MonthFlowSummary } from "@/domain/reports";

export interface TearSheetMovementStripProps {
  monthSummary: MonthFlowSummary;
}

export function TearSheetMovementStrip({ monthSummary }: TearSheetMovementStripProps) {
  const hasExternalFlow =
    Math.abs(monthSummary.netFlowBRL) > 0.001 ||
    (monthSummary.externalContributionsBRL != null && monthSummary.externalContributionsBRL > 0) ||
    (monthSummary.cashDepositsBRL != null && monthSummary.cashDepositsBRL > 0);

  const isEmpty =
    monthSummary.buysBRL === 0 &&
    monthSummary.sellsBRL === 0 &&
    monthSummary.dividendsBRL === 0 &&
    !hasExternalFlow;

  const displayCompras =
    monthSummary.buysBRL > 0
      ? monthSummary.buysBRL
      : monthSummary.netFlowBRL > 0
        ? monthSummary.netFlowBRL
        : 0;

  return (
    <div className="bg-muted/30 rounded-xl border border-border/80 px-4 py-2.5 print:py-1.5 print:px-3 flex flex-wrap items-center justify-between gap-2.5 print:gap-1.5 text-xs print:bg-surface print:border-border shadow-xs">
      <div className="flex items-center gap-1.5 text-foreground font-bold uppercase tracking-wider text-[10px]">
        <Calendar className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
        <span>Movimentação do Período ({monthSummary.monthLabel}):</span>
      </div>
      {isEmpty ? (
        <span className="text-muted-foreground text-[11px] italic">
          Sem movimentações financeiras registradas na competência
        </span>
      ) : (
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 font-mono text-[11px] num w-full sm:w-auto">
          <span>
            Compras:{" "}
            <strong className="text-foreground">
              <MoneyText cents={numberToCents(displayCompras)} />
            </strong>
          </span>
          <span>
            Vendas:{" "}
            <strong className="text-foreground">
              <MoneyText cents={numberToCents(monthSummary.sellsBRL)} />
            </strong>
          </span>
          <span>
            Proventos:{" "}
            <strong className="text-positive-strong">
              <MoneyText cents={numberToCents(monthSummary.dividendsBRL)} tone="positive" />
            </strong>
          </span>
          <span>
            Líquido:{" "}
            <strong className={monthSummary.netFlowBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}>
              <MoneyText
                cents={numberToCents(monthSummary.netFlowBRL)}
                tone={monthSummary.netFlowBRL >= 0 ? "positive" : "negative"}
                sign="explicit"
              />
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
