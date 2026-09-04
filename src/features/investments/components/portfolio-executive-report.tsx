import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
  ReportExecutiveSummary,
  ReportClassTables,
} from "@/components/modules/reports";
import { numberToCents } from "@/domain/money";
import type { PositionRow } from "@/components/modules/position-table";

export interface PortfolioExecutiveReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PositionRow[];
  totalBRL: number;
  cashBRL: number;
  yearDividendsBRL: number;
  portfolioIrr?: import("@/domain/portfolio").XIRRResult;
  allTimeEconomicPnlBRL?: number;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
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
  portfolioIrr,
  allTimeEconomicPnlBRL,
  periodLabel = "Posição Atual Consolidada",
  appName = "Guia Financeiro",
  accountHolder,
}: PortfolioExecutiveReportProps) {
  const investmentRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);

  // Agrupamento por classe para ReportClassTables
  const classGroups = useMemo(() => {
    const map = new Map<string, PositionRow[]>();
    for (const r of investmentRows) {
      const cls = r.assetClass ?? "Geral";
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(r);
    }

    return Array.from(map.entries())
      .map(([className, items]) => {
        const subtotalBRL = items.reduce((acc, i) => acc + i.valueBRL, 0);
        const totalCostGroup = items.reduce((acc, i) => acc + i.quantity * i.averageCost, 0);
        const pnlPct = totalCostGroup > 0 ? ((subtotalBRL - totalCostGroup) / totalCostGroup) * 100 : 0;

        return {
          className,
          totalCents: numberToCents(subtotalBRL),
          sharePct: totalBRL > 0 ? (subtotalBRL / totalBRL) * 100 : 0,
          pnlPct,
          items: items.map((i) => ({
            ticker: i.ticker,
            sector: i.sector,
            quantity: i.quantity,
            avgPriceCents: numberToCents(i.averageCost),
            currentPriceCents: numberToCents(i.priceQuote || i.priceBRL),
            totalCents: numberToCents(i.valueBRL),
            pnlPct: (i.totalReturnPct ?? i.unrealizedPct) ?? 0,
            currency: i.currency,
          })),
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [investmentRows, totalBRL]);

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo da Carteira"
      size="2xl"
    >
      <div className="flex flex-col gap-4 w-full">
        {/* Cabeçalho do Relatório */}
        <ReportHeader
          title="Relatório Executivo de Acompanhamento da Carteira"
          subtitle="Posição Patrimonial Consolidada & Custódia de Ativos"
          periodLabel={periodLabel}
          appName={appName}
          icon={TrendingUp}
          accountHolder={accountHolder}
        />

        {/* Síntese Executiva em Linha Única */}
        <ReportExecutiveSummary
          title="SÍNTESE PATRIMONIAL & DESEMPENHO"
          items={[
            {
              label: "Patrimônio Total",
              value: <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" />,
              subtext: `${investmentRows.length} ativos em custódia`,
            },
            {
              label: "Saldo em Caixa",
              value: <MoneyText cents={numberToCents(cashBRL)} tone="default" />,
              subtext: "Reserva de Liquidez",
            },
            {
              label: "TIR (Fluxo do Bolso)",
              value: portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                ? `${portfolioIrr.annualizedRatePct >= 0 ? "+" : ""}${portfolioIrr.annualizedRatePct.toFixed(1)}% a.a.`
                : "Em formação",
              subtext: portfolioIrr?.isEligible
                ? `Ponderada (${portfolioIrr.daysElapsed}d)`
                : "Requer histórico",
            },
            {
              label: "Resultado Histórico",
              value: (
                <span className={(allTimeEconomicPnlBRL ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                  <MoneyText cents={numberToCents(allTimeEconomicPnlBRL ?? 0)} tone={(allTimeEconomicPnlBRL ?? 0) >= 0 ? "positive" : "negative"} />
                </span>
              ),
              subtext: "P&L Econômico Total",
            },
          ]}
          narrative={
            <span>
              A carteira encerra o período com <strong><MoneyText cents={numberToCents(totalBRL)} className="inline font-bold" /></strong> sob custódia, distribuídos em <strong>{investmentRows.length} ativos</strong> e <strong>{classGroups.length} classes de investimento</strong>. O saldo em reserva de liquidez é de <MoneyText cents={numberToCents(cashBRL)} className="inline font-bold" /> e os proventos acumulados no exercício somam <MoneyText cents={numberToCents(yearDividendsBRL)} className="inline font-bold text-positive-strong" />.
            </span>
          }
        />

        {/* Tabelas Especializadas por Classe */}
        <section aria-label="Detalhamento das Posições" className="flex flex-col gap-3 pt-1">
          <ReportClassTables groups={classGroups} />
        </section>

        {/* Rodapé */}
        <ReportFooter
          accountHolder={accountHolder}
          disclaimer="Documento estritamente confidencial gerado pelo titular da conta via Guia Financeiro. As informações refletem a posição de custódia e cotações na data de emissão."
        />
      </div>
    </ReportDocumentLayout>
  );
}

