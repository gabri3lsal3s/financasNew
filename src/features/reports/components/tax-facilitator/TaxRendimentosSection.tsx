import { PiggyBank } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { sanitizeReportText } from "@/domain/reports";
import type { TaxDividendAssetSummary } from "./tax-facilitator-utils";

export interface TaxRendimentosSectionProps {
  items: readonly TaxDividendAssetSummary[];
  totalRendimentosBRL: number;
  calendarYear: number;
}

export function TaxRendimentosSection({
  items,
  totalRendimentosBRL,
  calendarYear,
}: TaxRendimentosSectionProps) {
  return (
    <section aria-label="Rendimentos Recebidos" className="flex flex-col gap-2.5 pt-1 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
        <div className="flex items-center gap-2">
          <PiggyBank className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Ficha: Rendimentos Isentos &amp; Exclusivos ({calendarYear})
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono num">
          Total Recebido:{" "}
          <MoneyText
            cents={numberToCents(totalRendimentosBRL)}
            tone="positive"
            className="font-bold inline"
          />
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground italic print:bg-surface print:border-border">
          Nenhum rendimento isento ou tributado exclusivamente na fonte apurado no ano-base {calendarYear}.
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 print:overflow-visible">
          <table className="w-full min-w-[440px] sm:min-w-0 text-left text-xs border-collapse print:table-fixed">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3 print:w-[20%]">Ticker</th>
                <th className="py-2 px-3 print:w-[50%]">Tipo / Ficha da Declaração</th>
                <th className="py-2 px-3 text-right print:w-[30%]">Total Recebido (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map(({ asset, tipoRendimento, amountBRL }) => (
                <tr key={`div-${asset.id}`} className="hover:bg-muted/20 break-inside-avoid even:bg-muted/20 print:even:bg-muted/20">
                  <td className="py-1.5 px-3 font-semibold text-foreground whitespace-nowrap">
                    {sanitizeReportText(asset.ticker)}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground">{tipoRendimento}</td>
                  <td className="py-1.5 px-3 text-right num font-mono font-bold text-positive-strong whitespace-nowrap">
                    <MoneyText cents={numberToCents(amountBRL)} tone="positive" />
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40 border-t border-border/80 font-bold break-inside-avoid">
                <td colSpan={2} className="py-2 px-3 text-foreground uppercase text-[10px] tracking-wider">
                  Total de Rendimentos no Exercício
                </td>
                <td className="py-2 px-3 text-right num font-mono text-positive-strong whitespace-nowrap">
                  <MoneyText cents={numberToCents(totalRendimentosBRL)} tone="positive" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
