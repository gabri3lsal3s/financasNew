import { MoneyText } from "@/components/ui/money-text";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatSignedPct } from "@/services/masks/percent";
import {
  ReportAssetGovernanceBadges,
  ReportClassTableBanner,
  type ReportClassGroup,
} from "./report-class-table-parts";

/**
 * Tabela de custódia unificada para Ações, FIIs, ETFs, Cripto e Internacional (8 colunas).
 */
export function ReportEquityClassTable({
  group,
  isInternacional,
  subtotalPriceVarPct,
}: {
  group: ReportClassGroup;
  isInternacional: boolean;
  subtotalPriceVarPct: number | null;
}) {
  return (
    <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible">
      <table className="w-full min-w-[600px] print:min-w-0 text-left text-xs border-collapse print:table-fixed">
        <thead>
          <ReportClassTableBanner group={group} colSpan={8} />
          <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
            <th className="py-1.5 px-2.5 print:w-[12%]">Ticker</th>
            <th className="py-1.5 px-2 print:w-[18%]">
              {isInternacional ? "Classe / Tema" : "Setor / Segmento"}
            </th>
            <th className="py-1.5 px-1.5 text-right print:w-[7%]">Qtd</th>
            <th className="py-1.5 px-1.5 text-right print:w-[14%]">Preço Médio</th>
            <th className="py-1.5 px-1.5 text-right print:w-[14%]">Cotação</th>
            <th className="py-1.5 px-2 text-right print:w-[17%]">Total (R$)</th>
            <th className="py-1.5 px-1.5 text-right print:w-[8%]">Var. Cota</th>
            <th className="py-1.5 px-2.5 text-right print:w-[10%]">Ret. Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {group.items.map((item) => {
            const priceVarPct = item.pricePnlPct ?? item.pnlPct;
            const totalRetPct = item.pnlPct;
            const currency = isInternacional
              ? ((item.currency as "BRL" | "USD") ?? "BRL")
              : "BRL";

            return (
              <tr key={item.ticker} className="even:bg-muted/20 print:even:bg-muted/20 break-inside-avoid">
                <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{sanitizeReportText(item.ticker)}</span>
                    <ReportAssetGovernanceBadges score={item.score} status={item.status} />
                  </div>
                </td>
                <td className="py-1.5 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[10px]">
                  {sanitizeReportText(item.sector || " — ")}
                </td>
                <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
                  {formatAssetQuantity(item.quantity, group.className)}
                </td>
                <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
                  <MoneyText cents={item.avgPriceCents} currency={currency} tone="default" />
                </td>
                <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-foreground text-[10px] whitespace-nowrap">
                  <MoneyText cents={item.currentPriceCents} currency={currency} tone="default" />
                </td>
                <td className="py-1.5 px-2 text-right num font-mono tabular-nums font-bold text-foreground text-[11px] whitespace-nowrap">
                  <MoneyText cents={item.totalCents} tone="default" />
                </td>
                <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
                  {formatSignedPct(priceVarPct)}
                </td>
                <td
                  className={cn(
                    "py-1.5 px-2.5 text-right num font-mono tabular-nums font-bold text-[11px] whitespace-nowrap",
                    totalRetPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                  )}
                >
                  {formatSignedPct(totalRetPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground print:bg-muted/30 break-inside-avoid">
          <tr>
            <td colSpan={5} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
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
                "py-1.5 px-1.5 text-right num font-mono tabular-nums text-[10px] whitespace-nowrap",
                subtotalPriceVarPct !== null && subtotalPriceVarPct >= 0
                  ? "text-positive-strong"
                  : "text-negative-strong",
              )}
            >
              {isInternacional && group.subtotalPriceVarPctUSD !== undefined ? (
                <span>
                  {formatSignedPct(group.subtotalPriceVarPctUSD)} (USD) / {formatSignedPct(subtotalPriceVarPct)} (BRL)
                </span>
              ) : subtotalPriceVarPct !== null ? (
                formatSignedPct(subtotalPriceVarPct)
              ) : (
                "—"
              )}
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
      {isInternacional && (
        <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/80 flex flex-col gap-0.5">
          <div>
            * <strong>Var. Cota</strong> refere-se à valorização da cota na moeda original (USD).{" "}
            <strong>Ret. Total</strong> consolida oscilação em dólar, variação cambial BRL/USD e proventos creditados.
          </div>
          {group.usdRate && group.usdRate > 0 && (
            <div className="font-mono text-[9px] text-muted-foreground/90">
              Conversão USD/BRL pela PTAX Oficial BCB de referência: R$ {group.usdRate.toFixed(4).replace(".", ",")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
