import { useMemo } from "react";
import { Layers, PieChart, Landmark } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
  ReportClassTables,
  ReportStackedBar,
  ReportGapPinBar,
  ReportRiskGauge,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatSignedPct } from "@/services/masks/percent";
import { sanitizeReportText, type AllocationAnalysisResult, type ConcentrationRiskResult } from "@/domain/reports";

export interface WealthPositionRow {
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector?: string | null;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  valueBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  yearDividendsBRL: number;
  yocPct: number;
  isCash?: boolean;
}

export interface WealthTearSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly WealthPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  cashBRL?: number;
  yearDividendsBRL?: number;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
}

const CLASS_COLORS: Record<string, string> = {
  acao: "#1b6b62",
  acoes: "#1b6b62",
  fii: "#dda726",
  fiis: "#dda726",
  renda_fixa: "#2dd4bf",
  internacional: "#38bdf8",
  cripto: "#a855f7",
  outros: "#64748b",
};

/**
 * Dossiê Executivo de Investimentos & Tear Sheet Patrimonial.
 *
 * Estrutura institucional completa:
 * 1. Header Oficial com Monograma e Metadados;
 * 2. Grade de 4 KPIs Executivos com tipografia tabular mono;
 * 3. Matriz de Alocação por Classe & Setor (Target vs. Actual) com Barras de Desvio (Gaps);
 * 4. Termômetro de Concentração e Risco da Carteira (Ativo, Setor e Moeda);
 * 5. Parecer Técnico Automatizado da Consultoria;
 * 6. Tabela Completa de Custódia de Ativos Agrupada por Classe;
 * 7. Rodapé de Confidencialidade e Autenticidade.
 */
export function WealthTearSheetModal({
  open,
  onOpenChange,
  rows,
  totalBRL,
  totalCostBRL,
  allocationAnalysis,
  concentrationRisk,
  periodLabel = "Posição Atual Consolidada",
  appName = "Guia Financeiro",
  accountHolder,
}: WealthTearSheetModalProps) {
  const investmentRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);
  const unrealizedPnlBRL = totalBRL - totalCostBRL;
  const unrealizedPnlPct = totalCostBRL > 0 ? (unrealizedPnlBRL / totalCostBRL) * 100 : 0;

  // Segmentos para barra empilhada de alocação
  const stackedSegments = allocationAnalysis.classGaps.map((cg) => ({
    key: cg.assetClass,
    label: cg.assetClass.toUpperCase(),
    pct: cg.currentPct,
    color: CLASS_COLORS[cg.assetClass.toLowerCase()] ?? "#64748b",
  }));

  // Itens para barra de pin/gaps de metas por classe
  const gapPinItems = allocationAnalysis.classGaps.map((cg) => ({
    key: cg.assetClass,
    label: cg.assetClass.toUpperCase(),
    actualPct: cg.currentPct,
    targetPct: cg.targetPct,
    gapPct: cg.currentPct - cg.targetPct,
    color: CLASS_COLORS[cg.assetClass.toLowerCase()] ?? "#1b6b62",
  }));

  // Ativo mais dominante para o termômetro de risco
  const topDominance = concentrationRisk.singleAssetDominance ?? {
    ticker: investmentRows[0]?.ticker ?? "N/A",
    pct: investmentRows[0] && totalBRL > 0 ? (investmentRows[0].valueBRL / totalBRL) * 100 : 0,
  };

  // Agrupamento por classe de ativos para a tabela de custódia com subtotais
  const groupedRows = useMemo(() => {
    const groups = new Map<string, WealthPositionRow[]>();
    for (const row of investmentRows) {
      const cls = row.assetClass || "Outros";
      const list = groups.get(cls) ?? [];
      list.push(row);
      groups.set(cls, list);
    }
    return Array.from(groups.entries()).map(([assetClass, items]) => {
      const subtotalBRL = items.reduce((acc, i) => acc + i.valueBRL, 0);
      const subtotalCostBRL = items.reduce((acc, i) => acc + i.averagePrice * i.quantity, 0);
      const subtotalPnlBRL = subtotalBRL - subtotalCostBRL;
      const subtotalPnlPct = subtotalCostBRL > 0 ? (subtotalPnlBRL / subtotalCostBRL) * 100 : 0;
      const pctOfTotal = totalBRL > 0 ? (subtotalBRL / totalBRL) * 100 : 0;
      return {
        assetClass,
        items,
        subtotalBRL,
        subtotalPnlPct,
        pctOfTotal,
      };
    });
  }, [investmentRows, totalBRL]);

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê de Alocação & Risco da Carteira"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Dossiê Executivo de Investimentos & Custódia"
        subtitle="Posição Patrimonial Consolidada & Diagnóstico de Metas"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      <ReportExecutiveSummary
        title="SÍNTESE DA CARTEIRA & POSIÇÃO CONSOLIDADA"
        items={[
          {
            label: "Patrimônio Total",
            value: <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" />,
            subtext: "Posição de Mercado",
          },
          {
            label: "Capital Investido",
            value: <MoneyText cents={numberToCents(totalCostBRL)} tone="default" />,
            subtext: "Custo de Aquisição",
          },
          {
            label: "Resultado Não Realizado",
            value: (
              <span className={unrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                <MoneyText
                  cents={numberToCents(unrealizedPnlBRL)}
                  tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"}
                  className="inline"
                />{" "}
                <span className="text-[11px] font-normal">({formatSignedPct(unrealizedPnlPct)})</span>
              </span>
            ),
            subtext: unrealizedPnlBRL >= 0 ? "Lucro Contábil" : "Desvalorização",
          },
          {
            label: "Aderência às Metas",
            value: `${allocationAnalysis.alignmentScore}%`,
            subtext: "Índice de Equilíbrio",
          },
        ]}
        narrative={
          <span>
            A carteira totaliza <strong><MoneyText cents={numberToCents(totalBRL)} className="inline font-bold" /></strong> sob custódia, com lucro contábil não realizado de <strong><MoneyText cents={numberToCents(unrealizedPnlBRL)} tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"} className="inline font-bold" /> ({formatSignedPct(unrealizedPnlPct)})</strong> e nível de equilíbrio de <strong>{allocationAnalysis.alignmentScore}%</strong>.
            {allocationAnalysis.topDeficitClass && (
              <> A classe prioritária para novos aportes é <strong>{allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}</strong> (déficit de <MoneyText cents={numberToCents(allocationAnalysis.topDeficitClass.gapBRL)} className="inline font-bold text-primary-strong" />).</>
            )}
            {allocationAnalysis.topDeficitSector && (
              <> Em nível setorial, a principal oportunidade localiza-se em <strong>{sanitizeReportText(allocationAnalysis.topDeficitSector.sectorName)}</strong> (<MoneyText cents={numberToCents(allocationAnalysis.topDeficitSector.gapBRL)} className="inline font-bold text-primary-strong" />).</>
            )}
            {topDominance.ticker && (
              <> O ativo de maior peso individual é <strong>{sanitizeReportText(topDominance.ticker)}</strong> ({topDominance.pct.toFixed(1)}% da carteira).</>
            )}
          </span>
        }
      />

      <section aria-label="Matriz de Rebalanceamento" className="break-inside-avoid flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
          <div className="flex items-center gap-1.5">
            <PieChart className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
              Diagnóstico de Alocação por Classe (Target vs. Actual)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono num">
            Equilíbrio Geral: <strong className="text-slate-900">{allocationAnalysis.alignmentScore}%</strong>
          </span>
        </div>

        <ReportStackedBar
          title="Distribuição Atual da Carteira"
          segments={stackedSegments}
          height={10}
        />

        <div className="overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible shadow-2xs">
          <table className="w-full text-left text-xs border-collapse print:table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold text-[9px] uppercase tracking-wider">
                <th className="py-1.5 px-2.5 print:w-[22%]">Classe</th>
                <th className="py-1.5 px-2 text-right print:w-[18%]">Atual (R$)</th>
                <th className="py-1.5 px-2 text-right print:w-[14%]">Atual (%)</th>
                <th className="py-1.5 px-2 text-right print:w-[14%]">Meta (%)</th>
                <th className="py-1.5 px-2 text-right print:w-[18%]">Gap (R$)</th>
                <th className="py-1.5 px-2.5 text-center print:w-[14%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocationAnalysis.classGaps.map((cg) => (
                <tr key={cg.assetClass} className="hover:bg-muted/20 break-inside-avoid even:bg-slate-50/50 print:even:bg-slate-50/50">
                  <td className="py-1 px-2.5 font-semibold capitalize text-slate-900 text-[11px]">{cg.assetClass}</td>
                  <td className="py-1 px-2 text-right num font-mono text-slate-800 text-[11px]">
                    <MoneyText cents={numberToCents(cg.currentBRL)} />
                  </td>
                  <td className="py-1 px-2 text-right num font-mono text-slate-700 text-[11px]">{cg.currentPct.toFixed(1)}%</td>
                  <td className="py-1 px-2 text-right num font-mono text-slate-700 text-[11px]">
                    {cg.targetPct > 0 ? `${cg.targetPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-1 px-2 text-right num font-mono font-bold text-[11px]">
                    {cg.gapBRL > 0 ? (
                      <MoneyText cents={numberToCents(cg.gapBRL)} tone="default" className="text-primary-strong" />
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>
                  <td className="py-1 px-2.5 text-center">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        cg.gapBRL > 0
                          ? "bg-primary/10 text-primary-strong border border-primary/20"
                          : cg.currentPct > cg.targetPct && cg.targetPct > 0
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-positive/10 text-positive-strong border border-positive/20"
                      }`}
                    >
                      {cg.gapBRL > 0 ? "Aportar" : cg.currentPct > cg.targetPct && cg.targetPct > 0 ? "Acima da Meta" : "Equilibrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-0.5">
          <ReportGapPinBar items={gapPinItems} />
        </div>
      </section>

      <section aria-label="Risco e Concentração" className="break-inside-avoid flex flex-col gap-2">
        <ReportRiskGauge
          topItemName={sanitizeReportText(topDominance.ticker)}
          topItemPct={topDominance.pct}
          warningThresholdPct={15}
          criticalThresholdPct={25}
        />
      </section>

      <section aria-label="Custódia de Ativos" className="flex flex-col gap-2 pt-1 print:break-before-page">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
              Custódia Consolidada de Ativos por Classe ({investmentRows.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] text-slate-600 font-mono num">
            Total Custodiado: <MoneyText cents={numberToCents(totalBRL)} className="font-bold text-slate-900 inline" />
          </span>
        </div>

        <ReportClassTables
          groups={groupedRows.map((group) => ({
            className: group.assetClass,
            totalCents: numberToCents(group.subtotalBRL),
            sharePct: group.pctOfTotal,
            pnlPct: group.subtotalPnlPct,
            items: group.items.map((r) => ({
              ticker: r.ticker,
              name: r.name,
              sector: r.sector,
              quantity: r.quantity,
              avgPriceCents: numberToCents(r.averagePrice),
              currentPriceCents: numberToCents(r.currentPrice),
              totalCents: numberToCents(r.valueBRL),
              pnlPct: r.unrealizedPnlPct,
              yocPct: r.yocPct,
              currency: r.currency,
            })),
          }))}
        />
      </section>

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente confidencial gerado pelo titular da conta via Guia Financeiro. As informações refletem a posição de custódia e cotações na data de emissão."
      />
    </ReportDocumentLayout>
  );
}
