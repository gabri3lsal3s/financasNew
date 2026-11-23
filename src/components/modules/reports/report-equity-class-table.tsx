import { MoneyText } from "@/components/ui/money-text";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatFxRate } from "@/services/masks";
import { formatSignedPct } from "@/services/masks/percent";
import {
  ReportAssetGovernanceBadges,
  ReportClassTableBanner,
  type ReportClassGroup,
} from "./report-class-table-parts";

/**
 * Tabela de custódia unificada para Ações, FIIs, ETFs, Cripto e Internacional (8 colunas).
 *
 * Características canônicas:
 * - Banner de grupo posicionado fora do <thead>, impedindo repetições em quebras de página;
 * - Unidades monetárias movidas para o <thead> para ativos internacionais (evitando colisões);
 * - Padding balanceado e nowrap estrito em valores numéricos.
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
  const hasUsdAssets =
    group.items.length > 0 &&
    group.items.some((item) => (item.currency ?? "BRL") === "USD");
  const hasBrlAssets =
    group.items.length > 0 &&
    group.items.some((item) => (item.currency ?? "BRL") !== "USD");
  const isAllUsd = group.items.length > 0 && hasUsdAssets && !hasBrlAssets;
  const isMixedCurrency = hasUsdAssets && hasBrlAssets;
  const hasQuoteFlags = group.items.some((item) => Boolean(item.quoteStatusFlag));
  const fxSourceText =
    group.fxSourceLabel ??
    (group.usdRate && Math.abs(group.usdRate - FALLBACK_USD_RATE) < 0.0001
      ? "Taxa Estimada (Fallback)"
      : "Cotação de Referência");

  return (
    <div className="w-full min-w-0 rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden print:overflow-visible print:border-none print:shadow-none print:rounded-none print:block">
      {/* Banner de Identificação da Classe (Fora do Thead para prevenir cabeçalhos órfãos) */}
      <ReportClassTableBanner group={group} />

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
        <table className="w-full min-w-[640px] print:min-w-0 text-left text-xs border-collapse table-fixed">
          <colgroup>
            <col className={isInternacional ? "w-[12%]" : "w-[12%]"} />
            <col className={isInternacional ? "w-[15%]" : "w-[16%]"} />
            <col className={isInternacional ? "w-[9%]" : "w-[9%]"} />
            <col className={isInternacional ? "w-[12%]" : "w-[11%]"} />
            <col className={isInternacional ? "w-[12%]" : "w-[11%]"} />
            <col className={isInternacional ? "w-[16%]" : "w-[16%]"} />
            <col className={isInternacional ? "w-[11%]" : "w-[12%]"} />
            <col className={isInternacional ? "w-[13%]" : "w-[13%]"} />
          </colgroup>
          <thead className="print:[break-inside:avoid] print:[break-after:avoid]">
            <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider print:[break-after:avoid] print:[break-inside:avoid]">
              <th className="py-2 px-2.5">Ticker</th>
              <th className="py-2 px-2">
                {isInternacional ? "Classe / Tema" : "Setor / Segmento"}
              </th>
              <th className="py-2 px-1.5 text-right">Qtd</th>
              <th className="py-2 px-2 text-right whitespace-nowrap">
                {isAllUsd ? "PM (US$)" : isMixedCurrency ? "PM" : "PM (R$)"}
              </th>
              <th className="py-2 px-2 text-right whitespace-nowrap">
                {isAllUsd ? "Cotação (US$)" : isMixedCurrency ? "Cotação" : "Cotação (R$)"}
              </th>
              <th className="py-2 px-2.5 text-right whitespace-nowrap">Total (R$)</th>
              <th className="py-2 px-2 text-right whitespace-nowrap">
                {isAllUsd ? "Var. (USD)" : "Var. Cota"}
              </th>
              <th className="py-2 px-2.5 text-right whitespace-nowrap">
                {isAllUsd ? "Ret. (BRL)" : "Ret. Total"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {group.items.map((item) => {
              const priceVarPct = item.pricePnlPct ?? item.pnlPct;
              const totalRetPct = item.pnlPct;
              const currency = (item.currency as "BRL" | "USD") ?? "BRL";

              return (
                <tr key={item.ticker} className="even:bg-muted/20 print:even:bg-muted/20 break-inside-avoid">
                  <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{sanitizeReportText(item.ticker)}</span>
                      <ReportAssetGovernanceBadges score={item.score} status={item.status} />
                    </div>
                  </td>
                  <td className="py-1.5 px-2 leading-tight text-muted-foreground text-[10px] whitespace-normal break-words">
                    {sanitizeReportText(item.sector || " — ")}
                  </td>
                  <td className="py-1.5 px-1.5 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap text-[10px]">
                    {formatAssetQuantity(item.quantity, group.className)}
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap text-[10.5px]">
                    <MoneyText cents={item.avgPriceCents} currency={currency} tone="default" hideCurrency={!isMixedCurrency} />
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-foreground whitespace-nowrap text-[10.5px]">
                    <span className="inline-flex items-center justify-end gap-1">
                      <MoneyText cents={item.currentPriceCents} currency={currency} tone="default" hideCurrency={!isMixedCurrency} />
                      {item.quoteStatusFlag ? (
                        <span
                          className={cn(
                            "text-[8.5px] font-bold px-1 rounded-xs leading-tight",
                            item.quoteStatusFlag === "manual"
                              ? "text-portfolio bg-portfolio/10"
                              : "text-warning-strong bg-warning/15",
                          )}
                          title={
                            item.quoteStatusFlag === "manual"
                              ? "Cotação definida manualmente"
                              : item.quoteStatusFlag === "stale"
                                ? "Cotação defasada na data de emissão"
                                : "Cotação estimada (fallback)"
                          }
                        >
                          {item.quoteStatusFlag === "manual"
                            ? "[M]"
                            : item.quoteStatusFlag === "stale"
                              ? "[D]"
                              : "[E]"}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-1.5 px-2.5 text-right num font-mono tabular-nums font-bold text-foreground whitespace-nowrap text-[11px]">
                    <MoneyText cents={item.totalCents} tone="default" hideCurrency />
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono tabular-nums text-muted-foreground whitespace-nowrap text-[10.5px]">
                    <span className="whitespace-nowrap tabular-nums">{formatSignedPct(priceVarPct)}</span>
                  </td>
                  <td
                    className={cn(
                      "py-1.5 px-2.5 text-right num font-mono tabular-nums font-bold whitespace-nowrap text-[11px]",
                      totalRetPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    <span className="whitespace-nowrap tabular-nums">{formatSignedPct(totalRetPct)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground print:bg-muted/30 break-inside-avoid">
            <tr>
              <td
                colSpan={5}
                className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold"
              >
                Subtotal {group.className}
                {group.totalCostCents !== undefined && (
                  <span className="font-normal normal-case text-muted-foreground ml-1.5">
                    (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                  </span>
                )}
              </td>
              <td className="py-1.5 px-2.5 text-right num font-mono tabular-nums text-[11px] font-bold text-foreground whitespace-nowrap">
                <MoneyText cents={group.totalCents} tone="default" hideCurrency />
              </td>
              <td
                className={cn(
                  "py-1.5 px-2 text-right num font-mono tabular-nums text-[10.5px]",
                  subtotalPriceVarPct !== null && subtotalPriceVarPct >= 0
                    ? "text-positive-strong"
                    : "text-negative-strong",
                )}
              >
                {(isInternacional || hasUsdAssets) && group.subtotalPriceVarPctUSD !== undefined ? (
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
      {(hasUsdAssets || hasQuoteFlags) && (
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/80 flex flex-col gap-0.5">
          {hasUsdAssets ? (
            <>
              <div>
                * <strong>Var. (USD)</strong> refere-se à valorização da cota na moeda original (USD).{" "}
                <strong>Ret. (BRL)</strong> consolida oscilação em dólar, variação cambial BRL/USD e proventos creditados.
              </div>
              {group.usdRate && group.usdRate > 0 && (
                <div className="font-mono text-[9px] text-muted-foreground/90">
                  Conversão USD/BRL ({fxSourceText}): R$ {formatFxRate(group.usdRate)}
                </div>
              )}
            </>
          ) : null}
          {hasQuoteFlags ? (
            <div className="font-mono text-[9px] text-muted-foreground/90">
              Marcadores de cotação: [E] Estimada por fallback · [D] Defasada em relação ao pregão/operação · [M] Override manual.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
