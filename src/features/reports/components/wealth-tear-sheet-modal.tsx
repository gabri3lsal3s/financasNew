import { useMemo } from "react";
import { Layers, PieChart, Landmark, Calendar } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
  ReportClassTables,
  ReportStackedBar,
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
  assetClass: string | null;
  sector?: string | null;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  valueBRL: number;
  totalCostBRL?: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  totalReturnPnlBRL?: number;
  totalReturnPct?: number;
  dividendsBRL?: number;
  yearDividendsBRL?: number;
  yocPct?: number;
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
  etf: "#0284c7",
  etfs: "#0284c7",
  "renda fixa": "#2dd4bf",
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
  const totalDividendsAllTime = useMemo(() => {
    if (totalDividendsBRL !== undefined && totalDividendsBRL > 0) {
      return totalDividendsBRL;
    }
    const sumDividendsFromRows = rows.reduce(
      (acc, r) => acc + (r.dividendsBRL ?? r.yearDividendsBRL ?? 0),
      0,
    );
    if (sumDividendsFromRows > 0) return sumDividendsFromRows;
    return totalDividendsBRL ?? 0;
  }, [totalDividendsBRL, rows]);

  const totalReturnBRL = unrealizedPnlBRL + totalDividendsAllTime;
  const totalReturnPct = totalCostBRL > 0 ? (totalReturnBRL / totalCostBRL) * 100 : 0;

  // Segmentos para barra empilhada de alocação
  const stackedSegments = allocationAnalysis.classGaps.map((cg) => ({
    key: cg.assetClass,
    label: cg.assetClass.toUpperCase(),
    pct: cg.currentPct,
    color: CLASS_COLORS[cg.assetClass.toLowerCase()] ?? "#64748b",
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

  // Agrupamento por classe de ativos para a tabela de custódia com subtotais e Retorno Total por classe
  const groupedRows = useMemo(() => {
    const groups = new Map<string, WealthPositionRow[]>();
    for (const row of investmentRows) {
      const cls = row.assetClass || "Outros";
      const list = groups.get(cls) ?? [];
      list.push(row);
      groups.set(cls, list);
    }
    const normalizeClass = (name: string): string =>
      name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const CLASS_SORT_ORDER = ["acoes", "acao", "fiis", "fii", "internacional", "global", "renda fixa", "renda_fixa", "tesouro", "outros"];

    return Array.from(groups.entries())
      .sort(([clsA], [clsB]) => {
        const normA = normalizeClass(clsA);
        const normB = normalizeClass(clsB);
        const idxA = CLASS_SORT_ORDER.findIndex((prefix) => normA.includes(prefix));
        const idxB = CLASS_SORT_ORDER.findIndex((prefix) => normB.includes(prefix));
        const orderA = idxA >= 0 ? idxA : 99;
        const orderB = idxB >= 0 ? idxB : 99;
        return orderA - orderB;
      })
      .map(([assetClass, items]) => {
        const subtotalBRL = items.reduce((acc, i) => acc + i.valueBRL, 0);
        const subtotalCostBRL = items.reduce((acc, i) => {
          const cost = i.totalCostBRL ?? (i.averagePrice * i.quantity);
          return acc + Math.max(0, cost);
        }, 0);
        const subtotalPnlBRL = items.reduce((acc, i) => acc + i.unrealizedPnlBRL, 0);
        const subtotalDividendsBRL = items.reduce((acc, i) => acc + (i.dividendsBRL ?? 0), 0);
        const subtotalTotalReturnBRL = subtotalPnlBRL + subtotalDividendsBRL;
        const subtotalTotalReturnPct = subtotalCostBRL > 0 ? (subtotalTotalReturnBRL / subtotalCostBRL) * 100 : 0;
        const subtotalUnrealizedPct = subtotalCostBRL > 0 ? (subtotalPnlBRL / subtotalCostBRL) * 100 : 0;
        const pctOfTotal = totalBRL > 0 ? (subtotalBRL / totalBRL) * 100 : 0;

        const sortedItems = [...items].sort((a, b) => b.valueBRL - a.valueBRL);
        const topItem = sortedItems[0];
        const topAssetTicker = topItem?.ticker ?? undefined;
        const topAssetSharePct = subtotalBRL > 0 && topItem ? (topItem.valueBRL / subtotalBRL) * 100 : undefined;

        return {
          assetClass,
          items,
          subtotalBRL,
          subtotalCostBRL,
          subtotalPnlBRL,
          subtotalDividendsBRL,
          subtotalTotalReturnBRL,
          subtotalTotalReturnPct,
          subtotalUnrealizedPct,
          pctOfTotal,
          topAssetTicker,
          topAssetSharePct,
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
        <div className="bg-muted/30 rounded-xl border border-border/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs print:bg-white print:border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1.5 text-foreground font-bold uppercase tracking-wider text-[10px]">
            <Calendar className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>Movimentação do Mês ({monthSummary.monthLabel}):</span>
          </div>
          {monthSummary.buysBRL === 0 && monthSummary.sellsBRL === 0 && monthSummary.dividendsBRL === 0 ? (
            <span className="text-muted-foreground text-[11px] italic">
              Sem movimentações financeiras registradas na competência
            </span>
          ) : (
            <div className="flex items-center gap-4 font-mono text-[11px] num">
              <span>Aportes: <strong className="text-foreground"><MoneyText cents={numberToCents(monthSummary.buysBRL)} /></strong></span>
              <span>Vendas: <strong className="text-foreground"><MoneyText cents={numberToCents(monthSummary.sellsBRL)} /></strong></span>
              <span>Proventos: <strong className="text-positive-strong"><MoneyText cents={numberToCents(monthSummary.dividendsBRL)} /></strong></span>
              <span>Líquido: <strong className={monthSummary.netFlowBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}><MoneyText cents={numberToCents(monthSummary.netFlowBRL)} /></strong></span>
            </div>
          )}
        </div>
      )}

      {/* 4. Diagnóstico de Metas & Alocação */}
      <section aria-label="Matriz de Rebalanceamento" className="break-inside-avoid flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
          <div className="flex items-center gap-1.5">
            <PieChart className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Diagnóstico de Alocação por Classe (Target vs. Actual)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono num">
            Equilíbrio Geral: <strong className="text-foreground">{allocationAnalysis.alignmentScore}%</strong>
          </span>
        </div>

        <ReportStackedBar
          title="Distribuição Atual da Carteira"
          segments={stackedSegments}
          height={10}
        />

        <div className="rounded-lg border border-border/80 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[9.5px] uppercase tracking-wider">
                <th className="py-1.5 px-3">Classe</th>
                <th className="py-1.5 px-2.5 text-right">Atual (R$)</th>
                <th className="py-1.5 px-2 text-right">Atual (%)</th>
                <th className="py-1.5 px-2 text-right">Meta (%)</th>
                <th className="py-1.5 px-2.5 text-right">Gap (R$)</th>
                <th className="py-1.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {allocationAnalysis.classGaps.map((cg) => (
                <tr key={cg.assetClass} className="even:bg-muted/20 print:even:bg-slate-50/50">
                  <td className="py-1.5 px-3 font-semibold text-foreground capitalize">
                    {cg.assetClass}
                  </td>
                  <td className="py-1.5 px-2.5 text-right num font-mono font-bold text-foreground">
                    <MoneyText cents={numberToCents(cg.currentBRL)} tone="default" />
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono text-muted-foreground">
                    {formatPercent(cg.currentPct)}%
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono text-muted-foreground">
                    {formatPercent(cg.targetPct)}%
                  </td>
                  <td className="py-1.5 px-2.5 text-right num font-mono">
                    {cg.gapBRL > 0 ? (
                      <MoneyText cents={numberToCents(cg.gapBRL)} className="font-bold text-primary-strong" />
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        cg.gapBRL > 0
                          ? "bg-primary/10 text-primary-strong border border-primary/20"
                          : cg.currentPct > cg.targetPct && cg.targetPct > 0
                            ? "bg-muted/60 text-muted-foreground border border-border/80"
                            : "bg-muted/60 text-muted-foreground border border-border/80"
                      }`}
                    >
                      {cg.gapBRL > 0 ? "Abaixo da Meta" : cg.currentPct > cg.targetPct && cg.targetPct > 0 ? "Acima da Meta" : "Equilibrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* 6. Custódia Consolidada Especializada (Inicia na Página 2 na Impressão) */}
      <section
        aria-label="Custódia de Ativos"
        className="flex flex-col gap-3 pt-1 print:pt-0 print-break-before-page print:break-before-page"
      >
        <div className="report-section-header flex items-center justify-between border-b border-border/70 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Custódia Consolidada de Ativos por Classe ({investmentRows.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono num">
            Total Custodiado: <MoneyText cents={numberToCents(totalBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <ReportClassTables
          groups={groupedRows.map((group) => ({
            className: group.assetClass,
            totalCents: numberToCents(group.subtotalBRL),
            sharePct: group.pctOfTotal,
            pnlPct: group.subtotalTotalReturnPct,
            totalCostCents: numberToCents(group.subtotalCostBRL),
            totalDividendsCents: numberToCents(group.subtotalDividendsBRL),
            topAssetTicker: group.topAssetTicker,
            topAssetSharePct: group.topAssetSharePct,
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
        disclaimer="Documento estritamente informativo gerado automaticamente com base nos dados e metas parametrizados pelo titular. Não constitui análise, consultoria, recomendação de compra, venda ou alocação de valores mobiliários (Resoluções CVM nº 19 e 20/2021). Rentabilidade passada não representa garantia de retorno futuro."
      />
    </ReportDocumentLayout>
  );
}
