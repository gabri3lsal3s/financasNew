import { MoneyText } from "@/components/ui/money-text";
import { sanitizeReportText } from "@/domain/reports";
import { formatDateBR, formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatSignedPct } from "@/services/masks/percent";
import {
  ReportAssetGovernanceBadges,
  ReportClassTableBanner,
  type ReportClassGroup,
} from "./report-class-table-parts";

function formatMaturityMonth(isoDate: string): string {
  const ym = isoDate.slice(0, 7);
  const formatted = formatMonthYear(ym);
  return formatted !== ym ? formatted : formatDateBR(isoDate);
}

/** Tabela de custódia especializada para Renda Fixa & Tesouro Direto. */
export function ReportFixedIncomeClassTable({ group }: { group: ReportClassGroup }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible">
      <table className="w-full min-w-[560px] print:min-w-0 text-left text-xs border-collapse print:table-fixed">
        <thead>
          <ReportClassTableBanner group={group} colSpan={5} />
          <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
            <th className="py-1.5 px-2.5 print:w-[35%]">Título / Emissor</th>
            <th className="py-1.5 px-2 print:w-[27%]">Indexador / Vencimento</th>
            <th className="py-1.5 px-1.5 text-right print:w-[7%]">Qtd</th>
            <th className="py-1.5 px-2 text-right print:w-[18%]">Saldo Atual</th>
            <th className="py-1.5 px-2.5 text-right print:w-[13%]">Rendimento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {group.items.map((item) => (
            <tr key={item.ticker} className="even:bg-muted/20 print:even:bg-muted/20 break-inside-avoid">
              <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>{sanitizeReportText(item.ticker)}</span>
                  <ReportAssetGovernanceBadges score={item.score} status={item.status} />
                </div>
              </td>
              <td className="py-1.5 px-2 whitespace-normal break-words leading-tight text-[10px]">
                {item.indexType ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">{sanitizeReportText(item.indexType)}</span>
                    {item.maturityDate && (
                      <span className="text-muted-foreground font-normal">
                        Venc. {formatMaturityMonth(item.maturityDate)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {sanitizeReportText(item.sector || "Renda Fixa")}
                  </span>
                )}
              </td>
              <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
                {formatAssetQuantity(item.quantity, group.className)}
              </td>
              <td className="py-1.5 px-2 text-right num font-mono tabular-nums font-bold text-foreground text-[11px] whitespace-nowrap">
                <MoneyText cents={item.totalCents} tone="default" />
              </td>
              <td
                className={cn(
                  "py-1.5 px-2.5 text-right num font-mono tabular-nums font-bold text-[10px] whitespace-nowrap",
                  item.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                )}
              >
                {formatSignedPct(item.pnlPct)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground print:bg-muted/30 break-inside-avoid">
          <tr>
            <td colSpan={3} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Subtotal {group.className}
              {group.totalCostCents !== undefined && (
                <span className="font-normal normal-case text-muted-foreground ml-1.5">
                  (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                </span>
              )}
            </td>
            <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-[11px] font-bold text-foreground whitespace-nowrap">
              <MoneyText cents={group.totalCents} tone="default" />
            </td>
            <td
              className={cn(
                "py-1.5 px-2.5 text-right num font-mono tabular-nums text-[11px] font-bold whitespace-nowrap",
                group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {formatSignedPct(group.pnlPct)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
