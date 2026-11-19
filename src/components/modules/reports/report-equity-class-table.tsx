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
    <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible print:border-none print:shadow-none print:rounded-none print:block">
      <table className="w-full min-w-[640px] print:min-w-0 text-left text-xs border-collapse table-fixed">
        <colgroup>
          <col className={isInternacional ? "w-[8.5%]" : "w-[11%]"} />
          <col className={isInternacional ? "w-[13%]" : "w-[14%]"} />
          <col className={isInternacional ? "w-[8%]" : "w-[5%]"} />
          <col className={isInternacional ? "w-[11.5%]" : "w-[11%]"} />
          <col className={isInternacional ? "w-[10.5%]" : "w-[9%]"} />
          <col className={isInternacional ? "w-[17%]" : "w-[18%]"} />
          <col className={isInternacional ? "w-[18%]" : "w-[17%]"} />
          <col className={isInternacional ? "w-[13.5%]" : "w-[15%]"} />
        </colgroup>
        <thead className="print:[break-inside:avoid] print:[break-after:avoid]">
          <ReportClassTableBanner group={group} colSpan={8} />
          <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider print:[break-after:avoid] print:[break-inside:avoid]">
            <th className={cn("py-1.5", isInternacional ? "px-1.5 text-[9.5px]" : "px-2.5")}>Ticker</th>
            <th className={cn("py-1.5", isInternacional ? "px-1.5 text-[9.5px]" : "px-2")}>
              {isInternacional ? "Classe / Tema" : "Setor / Segmento"}
            </th>
            <th className={cn("py-1.5 text-right", isInternacional ? "px-1 text-[9.5px]" : "px-1")}>Qtd</th>
            <th className={cn("py-1.5 text-right", isInternacional ? "px-1 text-[9.5px] leading-tight" : "px-1.5 whitespace-nowrap")}>
              {isInternacional ? (
                <div className="flex flex-col items-end leading-tight">
                  <span>Preço</span>
                  <span>Médio</span>
                </div>
              ) : (
                "Preço Médio"
              )}
            </th>
            <th className={cn("py-1.5 text-right whitespace-nowrap", isInternacional ? "px-1 text-[9.5px]" : "px-1.5")}>Cotação</th>
            <th className={cn("py-1.5 text-right whitespace-nowrap", isInternacional ? "px-1.5 text-[9.5px]" : "px-2 pr-3")}>Total (R$)</th>
            <th className={cn("py-1.5 text-right whitespace-nowrap", isInternacional ? "px-1 text-[9.5px]" : "px-1.5 pl-2")}>Var. Cota</th>
            <th className={cn("py-1.5 text-right whitespace-nowrap", isInternacional ? "px-1.5 text-[9.5px]" : "px-2.5")}>Ret. Total</th>
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
                <td className={cn(
                  "py-1.5 font-semibold text-foreground whitespace-normal break-words leading-tight",
                  isInternacional ? "px-1.5 text-[10px]" : "px-2.5 text-[11px]"
                )}>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span>{sanitizeReportText(item.ticker)}</span>
                    <ReportAssetGovernanceBadges score={item.score} status={item.status} />
                  </div>
                </td>
                <td className={cn(
                  "py-1.5 leading-tight text-muted-foreground",
                  isInternacional
                    ? "px-1.5 text-[9.5px] whitespace-normal break-normal"
                    : "px-2 text-[10px] whitespace-normal break-words"
                )}>
                  {sanitizeReportText(item.sector || " — ")}
                </td>
                <td className={cn(
                  "py-1.5 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap",
                  isInternacional ? "px-1 text-[9px]" : "px-1 text-[10px]"
                )}>
                  {formatAssetQuantity(item.quantity, group.className)}
                </td>
                <td className={cn(
                  "py-1.5 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap",
                  isInternacional ? "px-1 text-[9px]" : "px-1.5 text-[10px]"
                )}>
                  <MoneyText cents={item.avgPriceCents} currency={currency} tone="default" />
                </td>
                <td className={cn(
                  "py-1.5 text-right num font-mono tabular-nums text-foreground whitespace-nowrap",
                  isInternacional ? "px-1 text-[9px]" : "px-1.5 text-[10px]"
                )}>
                  <MoneyText cents={item.currentPriceCents} currency={currency} tone="default" />
                </td>
                <td className={cn(
                  "py-1.5 text-right num font-mono tabular-nums font-bold text-foreground whitespace-nowrap",
                  isInternacional ? "px-1.5 text-[10px]" : "px-2 pr-3 text-[11px]"
                )}>
                  <MoneyText cents={item.totalCents} tone="default" />
                </td>
                <td className={cn(
                  "py-1.5 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap",
                  isInternacional ? "px-1 text-[9.5px]" : "px-1.5 pl-2 text-[10px]"
                )}>
                  {formatSignedPct(priceVarPct)}
                </td>
                <td
                  className={cn(
                    "py-1.5 text-right num font-mono tabular-nums font-bold whitespace-nowrap",
                    isInternacional ? "px-1.5 text-[10px]" : "px-2.5 text-[11px]",
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
            <td
              colSpan={5}
              className={cn(
                "py-1.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold",
                isInternacional ? "px-2" : "px-2.5",
              )}
            >
              Subtotal {group.className}
              {group.totalCostCents !== undefined && (
                <span className="font-normal normal-case text-muted-foreground ml-1.5">
                  (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                </span>
              )}
            </td>
            <td className={cn(
              "py-1.5 text-right num font-mono tabular-nums text-[10.5px] font-bold text-foreground whitespace-nowrap",
              isInternacional ? "px-1.5" : "px-2 pr-3 text-[11px]"
            )}>
              <MoneyText cents={group.totalCents} tone="default" />
            </td>
            <td
              className={cn(
                "py-1.5 text-right num font-mono tabular-nums",
                isInternacional ? "px-1 text-[9.5px]" : "px-1.5 pl-2 text-[10px]",
                subtotalPriceVarPct !== null && subtotalPriceVarPct >= 0
                  ? "text-positive-strong"
                  : "text-negative-strong",
              )}
            >
              {isInternacional && group.subtotalPriceVarPctUSD !== undefined ? (
                <div className="flex flex-col items-end leading-tight gap-0.5 text-right">
                  <span className="font-semibold text-foreground font-mono tabular-nums text-[9.5px] whitespace-nowrap">
                    {formatSignedPct(group.subtotalPriceVarPctUSD)} (USD)
                  </span>
                  <span className="text-[9px] text-muted-foreground font-normal font-mono tabular-nums whitespace-nowrap">
                    {formatSignedPct(subtotalPriceVarPct)} (BRL)
                  </span>
                </div>
              ) : subtotalPriceVarPct !== null ? (
                <span className="whitespace-nowrap font-mono tabular-nums">{formatSignedPct(subtotalPriceVarPct)}</span>
              ) : (
                "—"
              )}
            </td>
            <td
              className={cn(
                "py-1.5 text-right num font-mono tabular-nums text-[10.5px] font-bold whitespace-nowrap",
                isInternacional ? "px-1.5" : "px-2.5 text-[11px]",
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
