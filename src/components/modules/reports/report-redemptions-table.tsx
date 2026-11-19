import { ArrowDownLeft } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { sanitizeReportText, type PeriodRedemptionItem } from "@/domain/reports";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";

export interface ReportRedemptionsTableProps {
  items: readonly PeriodRedemptionItem[];
  periodLabel?: string;
}

/**
 * Tabela de Posições Encerradas e Resgates Realizados para Relatórios A4/PDF.
 */
export function ReportRedemptionsTable({
  items,
  periodLabel,
}: ReportRedemptionsTableProps) {
  if (!items || items.length === 0) return null;

  const totalAppliedBRL = items.reduce((acc, i) => acc + i.appliedCostBRL, 0);
  const totalNetRedeemedBRL = items.reduce((acc, i) => acc + i.redeemedValueBRL, 0);
  const totalNetRealizedPnlBRL = items.reduce((acc, i) => acc + i.realizedPnlBRL, 0);
  const totalTaxBRL = items.reduce((acc, i) => acc + i.taxAmountBRL, 0);
  const totalReturnPct =
    totalAppliedBRL > 0 ? (totalNetRealizedPnlBRL / totalAppliedBRL) * 100 : null;

  return (
    <section
      aria-label="Posições Encerradas e Resgates do Período"
      className="flex flex-col gap-1.5 break-inside-avoid print:break-inside-avoid"
    >
      <div className="report-group-header flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/80 text-xs font-bold text-foreground print:bg-muted/40 print:border-border break-inside-avoid break-after-avoid">
        <div className="flex items-center gap-2">
          <ArrowDownLeft className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span className="uppercase tracking-wider">
            Posições Encerradas &amp; Resgates Realizados ({items.length}{" "}
            {items.length === 1 ? "título" : "títulos"})
          </span>
        </div>
        {periodLabel ? (
          <div className="text-[11px] font-normal text-muted-foreground font-mono num">
            Período: {periodLabel}
          </div>
        ) : null}
      </div>

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible">
        <table className="w-full min-w-[580px] print:min-w-0 text-left text-xs border-collapse print:table-fixed">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
              <th className="py-1.5 px-3 print:w-[32%] w-[32%]">Título / Ativo</th>
              <th className="py-1.5 px-2 print:w-[24%] w-[24%]">Classe / Categoria</th>
              <th className="py-1.5 px-2 text-center print:w-[14%] w-[14%]">Data Resgate</th>
              <th className="py-1.5 px-3 text-right print:w-[16%] w-[16%]">Valor Resgatado</th>
              <th className="py-1.5 px-3 text-right print:w-[14%] w-[14%]">Resultado Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {items.map((item) => {
              const isPositive = item.realizedPnlBRL >= 0;
              return (
                <tr key={item.id} className="even:bg-muted/20 print:even:bg-muted/20 break-inside-avoid">
                  <td className="py-2 px-3 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                    {sanitizeReportText(item.ticker)}
                    {item.name && item.name !== item.ticker ? (
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        {sanitizeReportText(item.name)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[10px]">
                    <span className="font-medium text-foreground">{sanitizeReportText(item.assetClass)}</span>
                    {item.sector ? (
                      <span className="block text-[10px] text-muted-foreground">
                        {sanitizeReportText(item.sector)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 px-2 text-center num font-mono text-muted-foreground text-[11px] whitespace-nowrap tabular-nums">
                    {formatDateBR(item.redemptionDate)}
                  </td>
                  <td className="py-2 px-3 text-right num font-mono text-foreground font-bold text-[11px] whitespace-nowrap tabular-nums">
                    <div>
                      <MoneyText cents={numberToCents(item.redeemedValueBRL)} tone="default" />
                    </div>
                    {item.taxAmountBRL > 0 ? (
                      <span className="block text-[10px] font-normal text-muted-foreground font-mono tracking-tight mt-0.5">
                        IR: −<MoneyText cents={numberToCents(item.taxAmountBRL)} tone="default" className="inline text-[10px]" /> ({item.taxRatePct !== null ? `${formatPercent(item.taxRatePct)}%` : "0%"})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 px-3 text-right num font-mono font-bold text-[11px] whitespace-nowrap tabular-nums">
                    <div>
                      <MoneyText
                        cents={numberToCents(item.realizedPnlBRL)}
                        tone={isPositive ? "positive" : "negative"}
                        sign="explicit"
                      />
                    </div>
                    <span
                      className={cn(
                        "block text-[10px] font-bold font-mono tracking-tight mt-0.5",
                        isPositive ? "text-positive-strong" : "text-negative-strong",
                      )}
                    >
                      {item.finalReturnPct !== null ? `${formatSignedPct(item.finalReturnPct, 1)} líq.` : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-muted/40 font-bold text-[11px] print:bg-muted/40">
              <td colSpan={3} className="py-2 px-3 text-foreground uppercase tracking-wider text-[10px]">
                Total Resgates do Período ({items.length})
                {totalTaxBRL > 0 ? (
                  <span className="ml-2 font-normal text-muted-foreground text-[10px] normal-case">
                    (IR Total retido: <MoneyText cents={numberToCents(totalTaxBRL)} tone="default" className="inline text-[10px]" />)
                  </span>
                ) : null}
              </td>
              <td className="py-2 px-3 text-right num font-mono text-foreground font-bold whitespace-nowrap tabular-nums">
                <MoneyText cents={numberToCents(totalNetRedeemedBRL)} tone="default" />
              </td>
              <td className="py-2 px-3 text-right num font-mono font-bold whitespace-nowrap tabular-nums">
                <div>
                  <MoneyText
                    cents={numberToCents(totalNetRealizedPnlBRL)}
                    tone={totalNetRealizedPnlBRL >= 0 ? "positive" : "negative"}
                    sign="explicit"
                  />
                </div>
                {totalReturnPct !== null ? (
                  <span
                    className={cn(
                      "block text-[10px] font-bold font-mono tracking-tight",
                      totalNetRealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    {formatSignedPct(totalReturnPct)} líq.
                  </span>
                ) : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
