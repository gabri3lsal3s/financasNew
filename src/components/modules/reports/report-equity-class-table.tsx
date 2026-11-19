import { MoneyText } from "@/components/ui/money-text";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
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
      <table className="w-full min-w-[640px] print:min-w-0 text-left text-xs border-collapse table-fixed">
        <thead className="print:[break-inside:avoid] print:[break-after:avoid]">
          <ReportClassTableBanner group={group} colSpan={8} />
          <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider print:[break-after:avoid] print:[break-inside:avoid]">
            <th className="py-1.5 px-2.5 w-[12%]">Ticker</th>
            <th className="py-1.5 px-2 w-[15%]">
              {isInternacional ? "Classe / Tema" : "Setor / Segmento"}
            </th>
            <th className="py-1.5 px-1 text-right w-[5%]">Qtd</th>
            <th className="py-1.5 px-1.5 text-right w-[11%]">Preço Médio</th>
            <th className="py-1.5 px-1.5 text-right w-[11%]">Cotação</th>
            <th className="py-1.5 px-2 text-right w-[18%]">Total (R$)</th>
            <th className="py-1.5 px-2 text-right w-[15%]">Var. Cota</th>
            <th className="py-1.5 px-2.5 text-right w-[13%]">Ret. Total</th>
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
                <td className="py-1.5 px-1 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
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
                <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">
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
            <td colSpan={5} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold w-[54%]">
              Subtotal {group.className}
              {group.totalCostCents !== undefined && (
                <span className="font-normal normal-case text-muted-foreground ml-1.5">
                  (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                </span>
              )}
            </td>
            <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-[11px] font-bold text-foreground whitespace-nowrap w-[18%]">
              <MoneyText cents={group.totalCents} tone="default" />
            </td>
            <td
              className={cn(
                "py-1.5 px-2 text-right num font-mono tabular-nums text-[10px] w-[15%]",
                subtotalPriceVarPct !== null && subtotalPriceVarPct >= 0
                  ? "text-positive-strong"
                  : "text-negative-strong",
              )}
            >
              {isInternacional && group.subtotalPriceVarPctUSD !== undefined ? (
                <div className="flex flex-col items-end leading-tight whitespace-nowrap pl-1">
                  <span className="font-semibold text-foreground">{formatSignedPct(group.subtotalPriceVarPctUSD)} (USD)</span>
                  <span className="text-[9px] text-muted-foreground font-normal">
                    {formatSignedPct(subtotalPriceVarPct)} (BRL)
                  </span>
                </div>
              ) : subtotalPriceVarPct !== null ? (
                <span className="whitespace-nowrap">{formatSignedPct(subtotalPriceVarPct)}</span>
              ) : (
                "—"
              )}
            </td>
            <td
              className={cn(
                "py-1.5 px-2.5 text-right num font-mono tabular-nums text-[11px] font-bold whitespace-nowrap w-[13%]",
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
            Para ativos cadastrados retroativamente sem câmbio médio de aquisição informado, o custo em BRL é estimado pela PTAX oficial do BCB, refletindo a variação na moeda original mais proventos.
          </div>
          {group.usdRate && group.usdRate > 0 && (
            <div className="font-mono text-[9px] text-muted-foreground/90">
              {Math.abs(group.usdRate - FALLBACK_USD_RATE) < 0.0001
                ? `Conversão USD/BRL pelo câmbio de referência estimado (fallback): R$ ${group.usdRate.toFixed(4).replace(".", ",")}`
                : `Conversão USD/BRL pela PTAX Oficial BCB de referência: R$ ${group.usdRate.toFixed(4).replace(".", ",")}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
