import { MoneyText } from "@/components/ui/money-text";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";

export interface ReportClassTableItem {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  quantity: number;
  avgPriceCents: number;
  currentPriceCents: number;
  totalCents: number;
  pnlPct: number;
  pricePnlPct?: number | null;
  dividendsCents?: number | null;
  yocPct?: number | null;
  currency?: string | null;
  indexType?: string | null;
  maturityDate?: string | null;
}

export interface ReportClassGroup {
  className: string;
  totalCents: number;
  sharePct: number;
  pnlPct: number;
  totalCostCents?: number;
  totalDividendsCents?: number;
  topAssetTicker?: string;
  topAssetSharePct?: number;
  color?: string;
  items: readonly ReportClassTableItem[];
}

export interface ReportClassTablesProps {
  groups: readonly ReportClassGroup[];
}

const DEFAULT_CLASS_COLORS: Record<string, string> = {
  acao: "#1b6b62",
  acoes: "#1b6b62",
  fii: "#dda726",
  fiis: "#dda726",
  etf: "#0284c7",
  etfs: "#0284c7",
  "renda fixa": "#2dd4bf",
  renda_fixa: "#2dd4bf",
  internacional: "#38bdf8",
  cripto: "#a855f7",
  outros: "#64748b",
};

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/**
 * Tabelas de Custódia Especializadas por Classe de Ativo para Relatórios A4/PDF.
 * Renderiza seções de custódia com cabeçalho leve e linha de subtotais contábeis no tfoot:
 * - Ações / FIIs: Ticker, Setor, Qtd, PM, Cotação, Total, Var. Cota %, Retorno Total %;
 * - Renda Fixa: Título / Emissor, Indexador / Vencimento, Qtd, Saldo Atual, Rendimento %;
 * - Internacional: Ticker, Tema, Qtd, Custo Médio, Cotação USD, Total, Var. Cota %, Retorno Total %.
 */
export function ReportClassTables({ groups }: ReportClassTablesProps) {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-4.5 w-full">
      {groups.map((group) => {
        const isRendaFixa =
          group.className.toLowerCase().includes("fixa") ||
          group.className.toLowerCase().includes("tesouro");
        const isInternacional =
          group.className.toLowerCase().includes("internacional") ||
          group.className.toLowerCase().includes("global");

        const normKey = group.className
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        const classColor =
          group.color ??
          DEFAULT_CLASS_COLORS[normKey] ??
          (normKey.includes("acao") || normKey.includes("acoes")
            ? "#1b6b62"
            : normKey.includes("fii")
              ? "#dda726"
              : normKey.includes("internacional") || normKey.includes("global")
                ? "#38bdf8"
                : normKey.includes("renda fixa") || normKey.includes("tesouro") || normKey.includes("cdb")
                  ? "#2dd4bf"
                  : "#64748b");

        return (
          <section
            key={group.className}
            aria-label={`Posições de ${group.className}`}
            className="flex flex-col gap-1.5 break-inside-auto print:break-inside-auto"
          >
            {/* Tabela de Custódia com Cabeçalho de Classe no thead e Totais Contábeis no tfoot */}
            <div className="rounded-lg border border-border/80 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse print:table-fixed">
                <thead>
                  {/* Linha de Identificação da Classe (Repete automaticamente em quebra de página A4) */}
                  <tr className="border-b border-border/70 bg-muted/60 text-foreground font-bold text-[9.5px] uppercase tracking-wider print:bg-slate-100">
                    <th colSpan={isRendaFixa ? 5 : 8} className="py-1.5 px-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-1 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: classColor }}
                            aria-hidden="true"
                          />
                          <span className="font-bold tracking-wider text-foreground">
                            {group.className} ({group.items.length}{" "}
                            {group.items.length === 1 ? "ativo" : "ativos"})
                          </span>
                        </div>
                        <span className="font-mono num font-normal text-muted-foreground text-[9.5px] normal-case">
                          {formatPercent(group.sharePct)}% da carteira
                        </span>
                      </div>
                    </th>
                  </tr>
                  <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[9px] uppercase tracking-wider">
                    {isRendaFixa ? (
                      <>
                        <th className="py-1.5 px-2.5 print:w-[35%]">Título / Emissor</th>
                        <th className="py-1.5 px-2 print:w-[27%]">Indexador / Vencimento</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1.5 px-2 text-right print:w-[18%]">Saldo Atual</th>
                        <th className="py-1.5 px-2.5 text-right print:w-[13%]">Rendimento</th>
                      </>
                    ) : isInternacional ? (
                      <>
                        <th className="py-1.5 px-2.5 print:w-[12%]">Ticker</th>
                        <th className="py-1.5 px-2 print:w-[17%]">Classe / Tema</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[15%]">Preço Médio</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[15%]">Cotação</th>
                        <th className="py-1.5 px-2 text-right print:w-[17%]">Total (R$)</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[8%]">Var. Cota</th>
                        <th className="py-1.5 px-2.5 text-right print:w-[9%]">Ret. Total</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1.5 px-2.5 print:w-[12%]">Ticker</th>
                        <th className="py-1.5 px-2 print:w-[18%]">Setor / Segmento</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[14%]">Preço Médio</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[14%]">Cotação</th>
                        <th className="py-1.5 px-2 text-right print:w-[17%]">Total (R$)</th>
                        <th className="py-1.5 px-1.5 text-right print:w-[8%]">Var. Cota</th>
                        <th className="py-1.5 px-2.5 text-right print:w-[10%]">Ret. Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {group.items.map((item) => {
                    const priceVarPct = item.pricePnlPct ?? item.pnlPct;
                    const totalRetPct = item.pnlPct;

                    return (
                      <tr
                        key={item.ticker}
                        className="even:bg-muted/20 print:even:bg-slate-50/50 break-inside-avoid"
                      >
                        {isRendaFixa ? (
                          <>
                            <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[10.5px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[9.5px]">
                              {sanitizeReportText(
                                item.sector || item.indexType || "Renda Fixa",
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px] whitespace-nowrap">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td
                              className={cn(
                                "py-1.5 px-2.5 text-right num font-mono font-bold text-[10px] whitespace-nowrap",
                                item.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                              )}
                            >
                              {formatSignedPct(item.pnlPct)}
                            </td>
                          </>
                        ) : isInternacional ? (
                          <>
                            <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[9.5px]">
                              {sanitizeReportText(item.sector || " — ")}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px] whitespace-nowrap">
                              <MoneyText cents={item.avgPriceCents} currency={(item.currency as "BRL" | "USD") ?? "BRL"} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-foreground text-[10px] whitespace-nowrap">
                              <MoneyText cents={item.currentPriceCents} currency={(item.currency as "BRL" | "USD") ?? "BRL"} tone="default" />
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px] whitespace-nowrap">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground/80 text-[10px] whitespace-nowrap">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 px-2.5 text-right num font-mono font-bold text-[10.5px] whitespace-nowrap",
                                totalRetPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                              )}
                            >
                              {formatSignedPct(totalRetPct)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[9.5px]">
                              {sanitizeReportText(item.sector || " — ")}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px] whitespace-nowrap">
                              <MoneyText cents={item.avgPriceCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-foreground text-[10px] whitespace-nowrap">
                              <MoneyText cents={item.currentPriceCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px] whitespace-nowrap">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground/80 text-[10px] whitespace-nowrap">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 px-2.5 text-right num font-mono font-bold text-[10.5px] whitespace-nowrap",
                                totalRetPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                              )}
                            >
                              {formatSignedPct(totalRetPct)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground print:bg-slate-100/90 break-inside-avoid">
                  {isRendaFixa ? (
                    <tr>
                      <td colSpan={3} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold first:rounded-bl-[7px]">
                        Subtotal {group.className}
                        {group.totalCostCents !== undefined && (
                          <span className="font-normal normal-case text-muted-foreground ml-1.5">
                            (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right num font-mono text-[11px] font-bold text-foreground whitespace-nowrap">
                        <MoneyText cents={group.totalCents} tone="default" />
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2.5 text-right num font-mono text-[10.5px] font-bold whitespace-nowrap last:rounded-br-[7px]",
                          group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                        )}
                      >
                        {formatSignedPct(group.pnlPct)}
                      </td>
                    </tr>
                  ) : isInternacional ? (
                    <tr>
                      <td colSpan={5} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold first:rounded-bl-[7px]">
                        Subtotal {group.className}
                        {group.totalCostCents !== undefined && (
                          <span className="font-normal normal-case text-muted-foreground ml-1.5">
                            (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right num font-mono text-[11px] font-bold text-foreground whitespace-nowrap">
                        <MoneyText cents={group.totalCents} tone="default" />
                      </td>
                      <td className="py-1.5 px-1.5 text-right num font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        —
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2.5 text-right num font-mono text-[10.5px] font-bold whitespace-nowrap last:rounded-br-[7px]",
                          group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                        )}
                      >
                        {formatSignedPct(group.pnlPct)}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-1.5 px-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold first:rounded-bl-[7px]">
                        Subtotal {group.className}
                        {group.totalCostCents !== undefined && (
                          <span className="font-normal normal-case text-muted-foreground ml-1.5">
                            (Custo: <MoneyText cents={group.totalCostCents} tone="default" className="inline font-semibold text-[10px]" />)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right num font-mono text-[11px] font-bold text-foreground whitespace-nowrap">
                        <MoneyText cents={group.totalCents} tone="default" />
                      </td>
                      <td className="py-1.5 px-1.5 text-right num font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        —
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2.5 text-right num font-mono text-[10.5px] font-bold whitespace-nowrap last:rounded-br-[7px]",
                          group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                        )}
                      >
                        {formatSignedPct(group.pnlPct)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
