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
    <div className="flex flex-col gap-4 w-full">
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
            className="flex flex-col gap-1.5 break-inside-avoid print:break-inside-avoid"
          >
            {/* Cabeçalho da Classe com Subtotais */}
            <div className="flex items-center justify-between bg-slate-100/95 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 print:bg-slate-100 print:border-slate-300">
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
                <span className="text-slate-500 font-normal">
                  {formatPercent(group.sharePct)} da carteira
                </span>
              </div>
            </div>

            {/* Tabela Especializada */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible shadow-2xs">
              <table className="w-full text-left text-xs border-collapse print:table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold text-[9px] uppercase tracking-wider">
                    {isRendaFixa ? (
                      <>
                        <th className="py-1 px-2 print:w-[36%]">Título / Emissor</th>
                        <th className="py-1 px-1.5 print:w-[26%]">Indexador / Vencimento</th>
                        <th className="py-1 px-1.5 text-right print:w-[8%]">Qtd</th>
                        <th className="py-1 px-1.5 text-right print:w-[18%]">Saldo Atual</th>
                        <th className="py-1 px-2 text-right print:w-[12%]">Rendimento</th>
                      </>
                    ) : isInternacional ? (
                      <>
                        <th className="py-1 px-2 print:w-[13%]">Ticker</th>
                        <th className="py-1 px-1.5 print:w-[20%]">Classe / Tema</th>
                        <th className="py-1 px-1.5 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1 px-1.5 text-right print:w-[13%]">Preço Médio</th>
                        <th className="py-1 px-1.5 text-right print:w-[13%]">Cotação USD</th>
                        <th className="py-1 px-1.5 text-right print:w-[15%]">Total (R$)</th>
                        <th className="py-1 px-1.5 text-right print:w-[9%]">Var. Cota</th>
                        <th className="py-1 px-2 text-right print:w-[10%]">Ret. Total</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1 px-2 print:w-[13%]">Ticker</th>
                        <th className="py-1 px-1.5 print:w-[20%]">Setor / Segmento</th>
                        <th className="py-1 px-1 text-right print:w-[7%]">Qtd</th>
                        <th className="py-1 px-1.5 text-right print:w-[12%]">Preço Médio</th>
                        <th className="py-1 px-1.5 text-right print:w-[12%]">Cotação</th>
                        <th className="py-1 px-1.5 text-right print:w-[15%]">Total (R$)</th>
                        <th className="py-1 px-1.5 text-right print:w-[9%]">Var. Cota</th>
                        <th className="py-1 px-2 text-right print:w-[12%]">Ret. Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.items.map((item) => {
                    const priceVarPct = item.pricePnlPct ?? item.pnlPct;
                    const totalRetPct = item.pnlPct;

                    return (
                      <tr
                        key={item.ticker}
                        className="even:bg-slate-50/50 print:even:bg-slate-50/50 break-inside-avoid"
                      >
                        {isRendaFixa ? (
                          <>
                            <td className="py-1 px-2 font-semibold text-slate-900 truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-600 text-[10px] truncate">
                              {sanitizeReportText(
                                item.sector || item.indexType || "Renda Fixa Geral",
                              )}
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-700 text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono font-bold text-slate-900 text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td
                              className={`py-1 px-2 text-right num font-mono font-bold text-[10px] ${
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
                            <td className="py-1 px-2 font-semibold text-slate-900 truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-600 text-[10px] truncate">
                              {sanitizeReportText(item.sector || "Internacional")}
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-700 text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-600 text-[10px]">
                              <MoneyText cents={item.avgPriceCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-900 text-[10px]">
                              <MoneyText cents={item.currentPriceCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono font-bold text-slate-900 text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-500 text-[10px]">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={`py-1 px-2 text-right num font-mono font-bold text-[10.5px] ${
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
                            <td className="py-1 px-2 font-semibold text-slate-900 truncate text-[11px]">
                              {sanitizeReportText(item.ticker)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-600 text-[10px] truncate">
                              {sanitizeReportText(item.sector || "Geral")}
                            </td>
                            <td className="py-1 px-1 text-right num font-mono text-slate-700 text-[10px]">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-600 text-[10px]">
                              <MoneyText cents={item.avgPriceCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-900 text-[10px]">
                              <MoneyText cents={item.currentPriceCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono font-bold text-slate-900 text-[11px]">
                              <MoneyText cents={item.totalCents} tone="default" />
                            </td>
                            <td className="py-1 px-1.5 text-right num font-mono text-slate-500 text-[10px]">
                              {formatSignedPct(priceVarPct)}
                            </td>
                            <td
                              className={`py-1 px-2 text-right num font-mono font-bold text-[10.5px] ${
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
