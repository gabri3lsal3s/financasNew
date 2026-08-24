import { FileText, PieChart, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { ReportDocumentLayout } from "@/components/modules/reports/report-document-layout";
import { numberToCents } from "@/domain/money";
import { formatSignedPct } from "@/services/masks/percent";
import type { PositionRow } from "@/components/modules/position-table";

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export interface PortfolioExecutiveReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PositionRow[];
  totalBRL: number;
  cashBRL: number;
  yearDividendsBRL: number;
  periodLabel?: string;
  appName?: string;
}

/**
 * Relatório Executivo de Acompanhamento da Carteira em padrão A4/PDF (§F40).
 * Usa ReportDocumentLayout como preview interativo e PrintSheet para injeção de impressão.
 */
export function PortfolioExecutiveReport({
  open,
  onOpenChange,
  rows,
  totalBRL,
  cashBRL,
  yearDividendsBRL,
  periodLabel = "Posição Atual Consolidada",
  appName = "Finanças Pessoais",
}: PortfolioExecutiveReportProps) {
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const investmentRows = rows.filter((r) => !r.isCash);

  // Agrupamento por classe
  const classTotals = new Map<string, number>();
  for (const r of rows) {
    const cls = r.assetClass ?? (r.isCash ? "Caixa" : "Outros");
    classTotals.set(cls, (classTotals.get(cls) ?? 0) + r.valueBRL);
  }
  const classBreakdown = Array.from(classTotals.entries())
    .map(([cls, val]) => ({
      cls,
      val,
      pct: totalBRL > 0 ? (val / totalBRL) * 100 : 0,
    }))
    .sort((a, b) => b.val - a.val);

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo da Carteira"
      size="2xl"
    >
      <div className="flex flex-col gap-6 w-full">
        {/* Cabeçalho do Relatório */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start break-inside-avoid">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
              <TrendingUp className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
              <span className="text-xs text-muted-foreground">Relatório Executivo de Investimentos</span>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
            <span className="font-medium text-foreground">{periodLabel}</span>
            <span>Emitido em {generatedAt}</span>
          </div>
        </header>

        {/* Grade de KPIs Principais */}
        <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 sm:grid-cols-4 break-inside-avoid">
          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Patrimônio Total</span>
            <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" className="text-base sm:text-lg font-bold" />
          </div>
          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Saldo em Caixa</span>
            <MoneyText cents={numberToCents(cashBRL)} tone="default" className="text-base sm:text-lg font-bold" />
          </div>
          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Proventos no Ano</span>
            <MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" className="text-base sm:text-lg font-bold" />
          </div>
          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Ativos sob Custódia</span>
            <span className="num text-base sm:text-lg font-bold text-foreground">{investmentRows.length} ativos</span>
          </div>
        </section>

        {/* Distribuição por Classe */}
        <section aria-label="Distribuição por Classe" className="flex flex-col gap-3 break-inside-avoid">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-portfolio" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Alocação por Classe de Ativos</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {classBreakdown.map((item) => (
              <div key={item.cls} className="rounded-lg border border-border/60 p-2.5 flex flex-col gap-0.5 bg-surface">
                <span className="text-xs text-muted-foreground truncate">{item.cls}</span>
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <MoneyText cents={numberToCents(item.val)} className="text-xs font-semibold text-foreground" />
                  <span className="num text-[11px] font-semibold text-portfolio">{item.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabela Consolidada de Custódia */}
        <section aria-label="Custódia Consolidada" className="flex flex-col gap-3 break-inside-avoid">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-portfolio" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Detalhamento das Posições em Carteira</h3>
            </div>
            <span className="text-xs text-muted-foreground">{investmentRows.length} ativos</span>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse print:table-fixed">
              <thead>
                <tr className="bg-surface-hover/60 border-b border-border text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold print:w-[15%]">Ticker</th>
                  <th className="py-2.5 px-3 font-semibold print:w-[14%]">Classe</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[10%]">Qtd</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[13%]">P. Médio</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[13%]">Cotação</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[15%]">Valor Atual</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[10%]">Rentab.</th>
                  <th className="py-2.5 px-3 font-semibold text-right print:w-[10%]">% Cart.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {investmentRows.map((r) => {
                  const effectiveRentab = r.totalReturnPct !== undefined ? r.totalReturnPct : r.unrealizedPct;
                  const rentabLabel = effectiveRentab !== null ? formatSignedPct(effectiveRentab) : "—";
                  const rentabTone = effectiveRentab !== null && effectiveRentab >= 0 ? "text-positive-strong" : "text-negative-strong";

                  return (
                    <tr key={r.assetId} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground truncate">{r.ticker}</td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate">{r.assetClass ?? "Geral"}</td>
                      <td className="py-2.5 px-3 text-right num">{formatQuantity(r.quantity)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <MoneyText cents={numberToCents(r.averageCost)} currency={r.currency} tone="default" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <MoneyText cents={numberToCents(r.priceQuote || r.priceBRL)} currency={r.currency} tone="default" />
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        <MoneyText cents={numberToCents(r.valueBRL)} tone="default" />
                      </td>
                      <td className={`py-2.5 px-3 text-right num font-semibold ${rentabTone}`}>
                        {rentabLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right num text-muted-foreground">
                        {r.pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rodapé */}
        <footer className="mt-2 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground break-inside-avoid">
          <span>Relatório gerado exclusivamente para fins de acompanhamento patrimonial.</span>
          <span>{appName}</span>
        </footer>
      </div>
    </ReportDocumentLayout>
  );
}
