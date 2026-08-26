import { useMemo } from "react";
import { Layers, PieChart, Landmark, Calendar } from "lucide-react";
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
import { formatSignedPct, formatPercent } from "@/services/masks/percent";
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
  totalReturnPnlBRL?: number;
  totalReturnPct?: number;
  dividendsBRL?: number;
  yearDividendsBRL: number;
  yocPct: number;
  isCash?: boolean;
}

export interface MonthFlowSummary {
  buysBRL: number;
  sellsBRL: number;
  dividendsBRL: number;
  netFlowBRL: number;
  monthLabel: string;
}

export interface WealthTearSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly WealthPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  totalDividendsBRL?: number;
  cashBRL?: number;
  yearDividendsBRL?: number;
  monthSummary?: MonthFlowSummary;
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
 * 2. Grade de 4 KPIs Executivos com ênfase no Retorno Total Real;
 * 3. Síntese Narrativa Analítica Factual (sem prescrição de compras);
 * 4. Sumário de Movimentação do Mês Vigente (Aportes, Vendas e Proventos);
 * 5. Matriz de Alocação por Classe & Setor (Target vs. Actual) com Barras de Desvio (Gaps);
 * 6. Termômetro de Concentração e Risco da Carteira;
 * 7. Tabela Completa de Custódia com Variação de Cota e Retorno Total Real;
 * 8. Rodapé de Confidencialidade e Autenticidade.
 */
export function WealthTearSheetModal({
  open,
  onOpenChange,
  rows,
  totalBRL,
  totalCostBRL,
  totalDividendsBRL,
  monthSummary,
  allocationAnalysis,
  concentrationRisk,
  periodLabel = "Posição Atual Consolidada",
  appName = "Guia Financeiro",
  accountHolder,
}: WealthTearSheetModalProps) {
  const investmentRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);
  const unrealizedPnlBRL = totalBRL - totalCostBRL;
  const unrealizedPnlPct = totalCostBRL > 0 ? (unrealizedPnlBRL / totalCostBRL) * 100 : 0;

  // Total de proventos de todos os tempos e Retorno Total real consolidado
  const totalDividendsAllTime = useMemo(
    () =>
      totalDividendsBRL ??
      rows.reduce((acc, r) => acc + (r.dividendsBRL ?? r.yearDividendsBRL ?? 0), 0),
    [totalDividendsBRL, rows],
  );
  const totalReturnBRL = unrealizedPnlBRL + totalDividendsAllTime;
  const totalReturnPct = totalCostBRL > 0 ? (totalReturnBRL / totalCostBRL) * 100 : 0;

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
  const topDominance = useMemo(
    () =>
      concentrationRisk.singleAssetDominance ?? {
        ticker: investmentRows[0]?.ticker ?? "N/A",
        pct: investmentRows[0] && totalBRL > 0 ? (investmentRows[0].valueBRL / totalBRL) * 100 : 0,
      },
    [concentrationRisk.singleAssetDominance, investmentRows, totalBRL],
  );

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

  // Narrativa analítica factual e dinâmica com Retorno Total e sem prescrição de compra
  const narrativeContent = useMemo(() => {
    const hasTargets = allocationAnalysis.classGaps.some((cg) => cg.targetPct > 0);
    const topDeficit = allocationAnalysis.topDeficitClass;
    const surplusClasses = allocationAnalysis.classGaps
      .filter((cg) => cg.currentPct > cg.targetPct + 0.5 && cg.targetPct > 0)
      .map((cg) => cg.assetClass);

    const intlTotalBRL = investmentRows
      .filter(
        (r) =>
          r.currency === "USD" ||
          (r.assetClass &&
            (r.assetClass.toLowerCase().includes("internacional") ||
              r.assetClass.toLowerCase().includes("global"))),
      )
      .reduce((acc, r) => acc + r.valueBRL, 0);
    const intlPct = totalBRL > 0 ? (intlTotalBRL / totalBRL) * 100 : 0;

    return (
      <span>
        A carteira totaliza{" "}
        <strong>
          <MoneyText cents={numberToCents(totalBRL)} className="inline font-bold" />
        </strong>{" "}
        sob custódia frente a um custo de aquisição de{" "}
        <strong>
          <MoneyText cents={numberToCents(totalCostBRL)} className="inline font-bold" />
        </strong>
        , acumulando <strong>Retorno Total de{" "}
          <MoneyText
            cents={numberToCents(totalReturnBRL)}
            tone={totalReturnBRL >= 0 ? "positive" : "negative"}
            className="inline font-bold"
          />{" "}
          ({formatSignedPct(totalReturnPct)})</strong> — composto por{" "}
        <MoneyText
          cents={numberToCents(unrealizedPnlBRL)}
          tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"}
          className="inline font-bold"
        />{" "}
        ({formatSignedPct(unrealizedPnlPct)}) de valorização de cota e{" "}
        <MoneyText
          cents={numberToCents(totalDividendsAllTime)}
          tone="positive"
          className="inline font-bold text-positive-strong"
        />{" "}
        em proventos recebidos
        {hasTargets && (
          <>
            , com índice de equilíbrio geral de{" "}
            <strong>{allocationAnalysis.alignmentScore}%</strong>
          </>
        )}
        .{" "}
        {hasTargets && topDeficit && topDeficit.gapBRL > 0 ? (
          <>
            Conforme a matriz de alocação definida pelo titular, a classe com maior
            distanciamento negativo da meta é{" "}
            <strong>{topDeficit.assetClass.toUpperCase()}</strong> (déficit de{" "}
            <MoneyText
              cents={numberToCents(topDeficit.gapBRL)}
              className="inline font-bold text-primary-strong"
            />
            )
            {surplusClasses.length > 0 ? (
              <>, enquanto {surplusClasses.join(" e ")} encontram-se em patamar superior ao planejado</>
            ) : (
              <>, com as demais classes alinhadas aos objetivos</>
            )}
            .{" "}
          </>
        ) : hasTargets ? (
          <>
            Todas as classes de ativos encontram-se atualmente equilibradas em relação às metas estipuladas.{" "}
          </>
        ) : null}
        {allocationAnalysis.topDeficitSector && allocationAnalysis.topDeficitSector.gapBRL > 0 && (
          <>
            Em nível setorial, o maior distanciamento localiza-se em{" "}
            <strong>
              {sanitizeReportText(allocationAnalysis.topDeficitSector.sectorName)}
            </strong>.{" "}
          </>
        )}
        {intlPct > 0 ? (
          <>
            O portfólio mantém <strong>{intlPct.toFixed(1)}%</strong> de exposição
            internacional
          </>
        ) : (
          <>A totalidade dos ativos está alocada no mercado doméstico</>
        )}
        {topDominance.ticker && topDominance.ticker !== "N/A" ? (
          <>, e a posição de maior peso individual é{" "}
            <strong>{sanitizeReportText(topDominance.ticker)}</strong>,
            respondendo por <strong>{topDominance.pct.toFixed(1)}%</strong> do
            patrimônio total.
          </>
        ) : (
          <>.</>
        )}
      </span>
    );
  }, [
    totalBRL,
    totalCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    totalDividendsAllTime,
    totalReturnBRL,
    totalReturnPct,
    allocationAnalysis,
    investmentRows,
    topDominance,
  ]);

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê de Alocação & Risco da Carteira"
    >
      <ReportHeader
        title="Dossiê Executivo de Investimentos & Custódia"
        subtitle="Posição Patrimonial Consolidada & Diagnóstico de Metas"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Síntese Executiva com Retorno Total Real */}
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
            label: "Retorno Total Real",
            value: (
              <span className={totalReturnBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                <MoneyText
                  cents={numberToCents(totalReturnBRL)}
                  tone={totalReturnBRL >= 0 ? "positive" : "negative"}
                  className="inline"
                />{" "}
                <span className="text-[11px] font-normal">({formatSignedPct(totalReturnPct)})</span>
              </span>
            ),
            subtext: "Cotação + Proventos",
          },
          {
            label: "Aderência às Metas",
            value: `${allocationAnalysis.alignmentScore}%`,
            subtext: "Índice de Equilíbrio",
          },
        ]}
        narrative={narrativeContent}
      />

      {/* 3. Sumário de Movimentação do Mês Vigente */}
      {monthSummary && (
        <div className="bg-slate-50/80 rounded-lg border border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs print:bg-slate-50 print:border-slate-300">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
            <Calendar className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>Movimentação do Mês ({monthSummary.monthLabel}):</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] num">
            <span>Aportes: <strong className="text-slate-900"><MoneyText cents={numberToCents(monthSummary.buysBRL)} /></strong></span>
            <span>Vendas: <strong className="text-slate-900"><MoneyText cents={numberToCents(monthSummary.sellsBRL)} /></strong></span>
            <span>Proventos: <strong className="text-positive-strong"><MoneyText cents={numberToCents(monthSummary.dividendsBRL)} /></strong></span>
            <span>Líquido: <strong className={monthSummary.netFlowBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}><MoneyText cents={numberToCents(monthSummary.netFlowBRL)} /></strong></span>
          </div>
        </div>
      )}

      {/* 4. Diagnóstico de Metas & Alocação */}
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

        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                <th className="py-1 px-2.5">Classe</th>
                <th className="py-1 px-2 text-right">Atual (R$)</th>
                <th className="py-1 px-2 text-right">Atual (%)</th>
                <th className="py-1 px-2 text-right">Meta (%)</th>
                <th className="py-1 px-2 text-right">Gap (R$)</th>
                <th className="py-1 px-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocationAnalysis.classGaps.map((cg) => (
                <tr key={cg.assetClass} className="even:bg-slate-50/50">
                  <td className="py-1 px-2.5 font-semibold text-slate-900 capitalize">
                    {cg.assetClass}
                  </td>
                  <td className="py-1 px-2 text-right num font-mono font-bold text-slate-900">
                    <MoneyText cents={numberToCents(cg.currentBRL)} tone="default" />
                  </td>
                  <td className="py-1 px-2 text-right num font-mono text-slate-600">
                    {formatPercent(cg.currentPct)}
                  </td>
                  <td className="py-1 px-2 text-right num font-mono text-slate-600">
                    {formatPercent(cg.targetPct)}
                  </td>
                  <td className="py-1 px-2 text-right num font-mono">
                    {cg.gapBRL > 0 ? (
                      <MoneyText cents={numberToCents(cg.gapBRL)} className="font-bold text-primary-strong" />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-1 px-2.5 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        cg.gapBRL > 0
                          ? "bg-primary/10 text-primary-strong border border-primary/20"
                          : cg.currentPct > cg.targetPct && cg.targetPct > 0
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
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

      {/* 5. Termômetro de Concentração e Risco */}
      <section aria-label="Risco e Concentração" className="break-inside-avoid flex flex-col gap-2">
        <ReportRiskGauge
          topItemName={sanitizeReportText(topDominance.ticker)}
          topItemPct={topDominance.pct}
          warningThresholdPct={15}
          criticalThresholdPct={25}
        />
      </section>

      {/* 6. Custódia Consolidada Especializada */}
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
              pricePnlPct: r.unrealizedPnlPct,
              pnlPct: r.totalReturnPct !== undefined ? r.totalReturnPct : r.unrealizedPnlPct,
              dividendsCents: numberToCents(r.dividendsBRL ?? r.yearDividendsBRL ?? 0),
              yocPct: r.yocPct,
              currency: r.currency,
            })),
          }))}
        />
      </section>

      {/* 7. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente confidencial gerado pelo titular da conta via Guia Financeiro. As informações refletem a posição de custódia e cotações na data de emissão."
      />
    </ReportDocumentLayout>
  );
}
