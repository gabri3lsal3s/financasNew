import { MoneyText } from "@/components/ui/money-text";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";

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
  items: readonly ReportClassTableItem[];
}

export interface ReportClassTablesProps {
  groups: readonly ReportClassGroup[];
}

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/**
 * Tabelas de Custódia Especializadas por Classe de Ativo para Relatórios A4/PDF.
 * Renderiza seções distintas com colunas específicas para cada classe:
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

        return (
          <section
            key={group.className}
            aria-label={`Posições de ${group.className}`}
            className="flex flex-col gap-1.5 break-inside-auto print:break-inside-auto"
          >
            {/* Cabeçalho da Classe com Subtotais */}
            <div className="report-group-header flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-lg border border-border/80 text-xs font-bold text-foreground print:bg-slate-100 print:border-slate-300">
              <span className="uppercase tracking-wider">
                {group.className} ({group.items.length}{" "}
                {group.items.length === 1 ? "ativo" : "ativos"})
              </span>
              <div className="flex items-center gap-3 font-mono num text-xs">
                <span>
                  Total: <MoneyText cents={group.totalCents} tone="default" className="font-bold" />
                </span>
                <span
                  className={
                    group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }
                >
                  {formatSignedPct(group.pnlPct)}
                </span>
                <span className="text-muted-foreground font-normal">
                  {formatPercent(group.sharePct)}% da carteira
                </span>
              </div>
            </div>

            {/* Tabela Especializada */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs border border-border/80 rounded-lg border-separate border-spacing-0 shadow-2xs print:table-fixed">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground font-bold text-[9.5px] uppercase tracking-wider">
                    {isRendaFixa ? (
                      <>
                        <th className="py-1.5 px-2.5 border-b border-border/70 print:w-[35%] first:rounded-tl-[7px]">Título / Emissor</th>
                        <th className="py-1.5 px-2 border-b border-border/70 print:w-[27%]">Indexador / Vencimento</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[8%]">Qtd</th>
                        <th className="py-1.5 px-2 border-b border-border/70 text-right print:w-[18%]">Saldo Atual</th>
                        <th className="py-1.5 px-2.5 border-b border-border/70 text-right print:w-[12%] last:rounded-tr-[7px]">Rendimento</th>
                      </>
                    ) : isInternacional ? (
                      <>
                        <th className="py-1.5 px-2.5 border-b border-border/70 print:w-[13%] first:rounded-tl-[7px]">Ticker</th>
                        <th className="py-1.5 px-2 border-b border-border/70 print:w-[20%]">Classe / Tema</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[13%]">Preço Médio</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[13%]">Cotação</th>
                        <th className="py-1.5 px-2 border-b border-border/70 text-right print:w-[15%]">Total (R$)</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[9%]">Var. Cota</th>
                        <th className="py-1.5 px-2.5 border-b border-border/70 text-right print:w-[10%] last:rounded-tr-[7px]">Ret. Total</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1.5 px-2.5 border-b border-border/70 print:w-[13%] first:rounded-tl-[7px]">Ticker</th>
                        <th className="py-1.5 px-2 border-b border-border/70 print:w-[20%]">Setor / Segmento</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[12%]">Preço Médio</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[12%]">Cotação</th>
                        <th className="py-1.5 px-2 border-b border-border/70 text-right print:w-[15%]">Total (R$)</th>
                        <th className="py-1.5 px-1.5 border-b border-border/70 text-right print:w-[9%]">Var. Cota</th>
                        <th className="py-1.5 px-2.5 border-b border-border/70 text-right print:w-[12%] last:rounded-tr-[7px]">Ret. Total</th>
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
                            <td className="py-1.5 px-2.5 font-semibold text-foreground truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground text-[10px] truncate">
                              {sanitizeReportText(
                                item.sector || item.indexType || "Renda Fixa",
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right num font-mono font-bold text-[10px] ${
                                item.pnlPct >= 0
                                  ? "text-positive-strong"
                                  : "text-negative-strong"
                              }`}
                            >
                              {formatSignedPct(item.pnlPct)}
                            </td>
                          </>
                        ) : isInternacional ? (
                          <>
                            <td className="py-1.5 px-2.5 font-semibold text-foreground truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground text-[10px] truncate">
                              {sanitizeReportText(item.sector || " — ")}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              <MoneyText cents={item.avgPriceCents} currency={(item.currency as "BRL" | "USD") ?? "BRL"} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-foreground text-[10px]">
                              <MoneyText cents={item.currentPriceCents} currency={(item.currency as "BRL" | "USD") ?? "BRL"} tone="default" />
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground/80 text-[10px]">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right num font-mono font-bold text-[10.5px] ${
                                totalRetPct >= 0
                                  ? "text-positive-strong"
                                  : "text-negative-strong"
                              }`}
                            >
                              {formatSignedPct(totalRetPct)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 px-2.5 font-semibold text-foreground truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground text-[10px] truncate">
                              {sanitizeReportText(item.sector || " — ")}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground text-[10px]">
                              <MoneyText cents={item.avgPriceCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-foreground text-[10px]">
                              <MoneyText cents={item.currentPriceCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground/80 text-[10px]">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right num font-mono font-bold text-[10.5px] ${
                                totalRetPct >= 0
                                  ? "text-positive-strong"
                                  : "text-negative-strong"
                              }`}
                            >
                              {formatSignedPct(totalRetPct)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
