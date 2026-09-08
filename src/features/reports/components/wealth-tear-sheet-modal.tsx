import { useMemo } from "react";
import { Layers, PieChart, Landmark, Calendar, TrendingUp, Scale, Activity, Briefcase, CircleDollarSign } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
  ReportExecutiveSummary,
  ReportStackedBar,
  ReportRiskGauge,
  ReportClassTables,
  ReportRedemptionsTable,
  ReportAllocationDonuts,
  ReportPerformanceChart,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { numberToCents } from "@/domain/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import {
  buildAllocationDonutSegments,
  sanitizeReportText,
  type AllocationAnalysisResult,
  type ConcentrationRiskResult,
  type PeriodRedemptionItem,
} from "@/domain/reports";
import type { XIRRResult, TwrConsolidatedResult, PortfolioMonthlySeriesPoint } from "@/domain/portfolio";

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
  totalReturnPnlBRL?: number;
  totalReturnPct?: number | null;
  unrealizedPnlBRL?: number;
  unrealizedPnlPct?: number | null;
  periodRedemptions?: readonly PeriodRedemptionItem[];
  cashBRL?: number;
  yearDividendsBRL?: number;
  monthSummary?: MonthFlowSummary;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  portfolioIrr?: XIRRResult;
  portfolioTwr?: TwrConsolidatedResult;
  monthlySeries?: readonly PortfolioMonthlySeriesPoint[];
  allTimeEconomicPnlBRL?: number;
  realizedPnlBRL?: number;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
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
  totalReturnPnlBRL,
  totalReturnPct: propTotalReturnPct,
  unrealizedPnlBRL: propUnrealizedPnlBRL,
  unrealizedPnlPct: propUnrealizedPnlPct,
  periodRedemptions,
  cashBRL,
  monthSummary,
  allocationAnalysis,
  concentrationRisk,
  portfolioIrr,
  portfolioTwr,
  monthlySeries,
  allTimeEconomicPnlBRL,
  realizedPnlBRL,
  annualCdiRate,
  annualSelicRate,
  annualIpcaRate,
  ibovPeriodReturnPct,
  periodLabel = "Posição Atual Consolidada",
  appName = "Guia Financeiro",
  accountHolder,
}: WealthTearSheetModalProps) {
  // Custódia Ativa: exclui ativos de caixa e posições totalmente encerradas (quantity <= 0)
  const activeInvestmentRows = useMemo(
    () => rows.filter((r) => !r.isCash && r.quantity > 0),
    [rows],
  );
  const investmentRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);

  const totalInvestedValueBRL = useMemo(
    () => Math.round(activeInvestmentRows.reduce((acc, r) => acc + r.valueBRL, 0) * 100) / 100,
    [activeInvestmentRows],
  );
  const effectiveCostBRL = useMemo(
    () =>
      totalCostBRL > 0
        ? totalCostBRL
        : Math.round(activeInvestmentRows.reduce((acc, r) => acc + (r.totalCostBRL ?? 0), 0) * 100) / 100,
    [totalCostBRL, activeInvestmentRows],
  );

  const fallbackUnrealizedPnlBRL = Math.round((totalInvestedValueBRL - effectiveCostBRL) * 100) / 100;
  const fallbackUnrealizedPnlPct = effectiveCostBRL > 0 ? (fallbackUnrealizedPnlBRL / effectiveCostBRL) * 100 : 0;

  const unrealizedPnlBRL = propUnrealizedPnlBRL !== undefined ? propUnrealizedPnlBRL : fallbackUnrealizedPnlBRL;
  const unrealizedPnlPct =
    propUnrealizedPnlPct !== undefined && propUnrealizedPnlPct !== null
      ? propUnrealizedPnlPct
      : fallbackUnrealizedPnlPct;

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

  const fallbackTotalReturnBRL = Math.round((unrealizedPnlBRL + totalDividendsAllTime) * 100) / 100;
  const fallbackTotalReturnPct = effectiveCostBRL > 0 ? (fallbackTotalReturnBRL / effectiveCostBRL) * 100 : 0;

  const totalReturnBRL = totalReturnPnlBRL !== undefined ? totalReturnPnlBRL : fallbackTotalReturnBRL;
  const totalReturnPct =
    propTotalReturnPct !== undefined && propTotalReturnPct !== null
      ? propTotalReturnPct
      : fallbackTotalReturnPct;

  // Resultado realizado de posições encerradas (ganho/perda de capital ou resgates passados)
  const effectiveRealizedGainBRL = useMemo(() => {
    if (allTimeEconomicPnlBRL !== undefined) {
      return Math.round((allTimeEconomicPnlBRL - totalReturnBRL) * 100) / 100;
    }
    return realizedPnlBRL ?? 0;
  }, [allTimeEconomicPnlBRL, totalReturnBRL, realizedPnlBRL]);

  // Série histórica de performance e rentabilidade mês a mês para o gráfico comparativo
  const performanceSeries = useMemo(() => {
    // 1. Prioridade: série consolidada de TWR com meses e taxas isoladas
    if (portfolioTwr && portfolioTwr.series && portfolioTwr.series.length >= 2) {
      return portfolioTwr.series.map((item) => {
        const [y, m] = item.month.split("-");
        const monthLabel = y && m ? `${m}/${y.slice(2)}` : item.month;
        return {
          month: item.month,
          monthLabel,
          patrimonyBRL: item.totalValueBRL,
          ratePct: item.monthRatePct,
        };
      });
    }

    // 2. Fallback: série mensal de snapshots patrimoniais
    if (monthlySeries && monthlySeries.length >= 2) {
      return monthlySeries.map((item) => {
        const [y, m] = item.month.split("-");
        const monthLabel = y && m ? `${m}/${y.slice(2)}` : item.month;
        return {
          month: item.month,
          monthLabel,
          patrimonyBRL: item.valueBRL,
          ratePct: item.twrMonthPct ?? item.totalReturnPct ?? item.capitalGainPct ?? 0,
          dividendsBRL: item.monthDividendsBRL,
          costBRL: item.costBRL,
        };
      });
    }

    return [];
  }, [portfolioTwr, monthlySeries]);

  // Segmentos dos gráficos Donut de Classes e Setores
  const donutData = useMemo(() => {
    return buildAllocationDonutSegments({
      positions: activeInvestmentRows.map((r) => ({
        assetClass: r.assetClass,
        sector: r.sector,
        valueBRL: r.valueBRL,
      })),
      cashBalanceBRL: cashBRL ?? 0,
      includeCash: (cashBRL ?? 0) > 0,
    });
  }, [activeInvestmentRows, cashBRL]);

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
    for (const row of activeInvestmentRows) {
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
  }, [activeInvestmentRows, totalBRL]);

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
        sob custódia (sendo{" "}
        <MoneyText cents={numberToCents(totalInvestedValueBRL)} className="inline font-medium" /> em ativos e{" "}
        <MoneyText cents={numberToCents(cashBRL ?? 0)} className="inline font-medium" /> em reserva de caixa) frente a um custo de aquisição de{" "}
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
        em proventos recebidos*
        {Math.abs(effectiveRealizedGainBRL) >= 0.01 ? (
          <>
            . Somado ao resultado {effectiveRealizedGainBRL >= 0 ? "bruto realizado" : "realizado"} de posições encerradas (
            <MoneyText
              cents={numberToCents(effectiveRealizedGainBRL)}
              tone={effectiveRealizedGainBRL >= 0 ? "positive" : "negative"}
              sign="explicit"
              className="inline font-bold"
            />
            ), o <strong>Resultado Econômico Histórico Consolidado totaliza{" "}
            <MoneyText
              cents={numberToCents(allTimeEconomicPnlBRL ?? (totalReturnBRL + effectiveRealizedGainBRL))}
              tone={(allTimeEconomicPnlBRL ?? (totalReturnBRL + effectiveRealizedGainBRL)) >= 0 ? "positive" : "negative"}
              className="inline font-bold"
            />
            </strong>
            {hasTargets ? (
              <>
                , com índice de equilíbrio geral de{" "}
                <strong>{allocationAnalysis.alignmentScore}%</strong>.{" "}
              </>
            ) : (
              <>.{" "}</>
            )}
          </>
        ) : hasTargets ? (
          <>
            , com índice de equilíbrio geral de{" "}
            <strong>{allocationAnalysis.alignmentScore}%</strong>.{" "}
          </>
        ) : (
          <>.{" "}</>
        )}
        {hasTargets && topDeficit && topDeficit.gapBRL > 0 && topDeficit.assetClass ? (
          <>
            Conforme a matriz de alocação definida pelo titular, a classe com maior
            distanciamento negativo da meta é{" "}
            <strong>
              {topDeficit.assetClass.toLowerCase().includes("fii")
                ? "FIIs"
                : topDeficit.assetClass.toLowerCase().includes("acao") || topDeficit.assetClass.toLowerCase().includes("acoes")
                  ? "Ações"
                  : topDeficit.assetClass.toLowerCase().includes("renda")
                    ? "Renda Fixa"
                    : topDeficit.assetClass.toLowerCase().includes("internacional")
                      ? "Internacional"
                      : sanitizeReportText(topDeficit.assetClass)}
            </strong> (déficit de{" "}
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
        {Boolean(allocationAnalysis.topDeficitSector && allocationAnalysis.topDeficitSector.gapBRL > 0 && sanitizeReportText(allocationAnalysis.topDeficitSector.sectorName)) && (
          <>
            Em nível setorial/segmento, o maior distanciamento localiza-se em{" "}
            <strong>
              {sanitizeReportText(allocationAnalysis.topDeficitSector?.sectorName)}
            </strong>.{" "}
          </>
        )}
        {intlPct > 0 ? (
          <>
            O portfólio mantém <strong>{formatPercent(intlPct)}%</strong> de exposição
            internacional
          </>
        ) : (
          <>A totalidade dos ativos está alocada no mercado doméstico</>
        )}
        {topDominance.ticker && topDominance.ticker !== "N/A" && topDominance.pct > 0 ? (
          <>
            , e a posição de maior peso individual é{" "}
            <strong>{sanitizeReportText(topDominance.ticker)}</strong>,
            respondendo por <strong>{formatPercent(topDominance.pct)}%</strong> do
            patrimônio total.
          </>
        ) : (
          <>.</>
        )}
      </span>
    );
  }, [
    totalBRL,
    totalInvestedValueBRL,
    cashBRL,
    totalCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    totalDividendsAllTime,
    totalReturnBRL,
    totalReturnPct,
    effectiveRealizedGainBRL,
    allTimeEconomicPnlBRL,
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

      {/* 2. Síntese Executiva com Destaque Adaptativo ao TWR e Retorno Contábil */}
      {(() => {
        const isTwrActive = Boolean(
          portfolioTwr &&
            portfolioTwr.status === "ok" &&
            portfolioTwr.accumulatedRatePct !== null &&
            portfolioTwr.accumulatedRatePct !== undefined,
        );
        const isCustodyActive = !isTwrActive && totalReturnPct !== null && totalReturnPct !== undefined;

        const rentabilidadeItem = isTwrActive
          ? {
              label: "Rentabilidade (TWR)",
              value: (
                <span className={(portfolioTwr?.accumulatedRatePct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                  {(portfolioTwr?.accumulatedRatePct ?? 0) >= 0 ? "+" : ""}{(portfolioTwr?.accumulatedRatePct ?? 0).toFixed(1)}%
                </span>
              ),
              subtext: portfolioTwr?.annualizedRatePct !== null && portfolioTwr?.annualizedRatePct !== undefined
                ? `${portfolioTwr.annualizedRatePct >= 0 ? "+" : ""}${portfolioTwr.annualizedRatePct.toFixed(1)}% a.a. (Padrão CVM)`
                : `Por cotas (${portfolioTwr?.monthsElapsed ?? 0}m)`,
            }
          : isCustodyActive
            ? {
                label: "Rentabilidade da Carteira",
                value: (
                  <span className={(totalReturnPct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                    {(totalReturnPct ?? 0) >= 0 ? "+" : ""}{(totalReturnPct ?? 0).toFixed(1)}%
                  </span>
                ),
                subtext: "Custódia aberta sobre custo",
              }
            : {
                label: "Rentabilidade da Carteira",
                value: "Em formação",
                subtext: "Requer histórico",
              };

        return (
          <ReportExecutiveSummary
            title="SÍNTESE DA CARTEIRA & DESEMPENHO CONSOLIDADO"
            items={[
              {
                label: "Patrimônio Total",
                value: <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" />,
                subtext: `Retorno contábil: ${formatSignedPct(totalReturnPct)}`,
              },
              rentabilidadeItem,
              {
                label: "Retorno do Bolso (TIR)",
                value: portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                  ? `${portfolioIrr.annualizedRatePct >= 0 ? "+" : ""}${portfolioIrr.annualizedRatePct.toFixed(1)}% a.a.`
                  : portfolioIrr?.status === "insufficient_history" && portfolioIrr.periodRatePct !== null && Math.abs(portfolioIrr.periodRatePct) <= 200
                    ? `${portfolioIrr.periodRatePct >= 0 ? "+" : ""}${portfolioIrr.periodRatePct.toFixed(1)}% período`
                    : "Em formação",
                subtext: portfolioIrr?.isEligible
                  ? `Ponderada (${portfolioIrr.daysElapsed}d)`
                  : "Requer histórico",
              },
              {
                label: "Resultado Histórico",
                value: (
                  <span className={(allTimeEconomicPnlBRL ?? totalReturnBRL) >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                    <MoneyText
                      cents={numberToCents(allTimeEconomicPnlBRL ?? totalReturnBRL)}
                      tone={(allTimeEconomicPnlBRL ?? totalReturnBRL) >= 0 ? "positive" : "negative"}
                      className="inline"
                    />
                  </span>
                ),
                subtext: Math.abs(effectiveRealizedGainBRL) >= 0.01
                  ? "P&L Total (Vivo + Encerrados)"
                  : "P&L Econômico Total",
              },
            ]}
            narrative={narrativeContent}
          />
        );
      })()}

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
              {allocationAnalysis.classGaps.map((cg) => {
                const targetIdealBRL = totalBRL * (cg.targetPct / 100);
                const deviationBRL = Math.round((cg.currentBRL - targetIdealBRL) * 100) / 100;
                const isDeficit = deviationBRL < -1.0;
                const isSurplus = deviationBRL > 1.0;

                return (
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
                      <MoneyText
                        cents={numberToCents(deviationBRL)}
                        sign="explicit"
                        tone={isDeficit ? "negative" : isSurplus ? "default" : "positive"}
                        className={cn(
                          "font-bold",
                          isDeficit ? "text-primary-strong" : "text-muted-foreground",
                        )}
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <Badge
                        variant={isDeficit ? "default" : isSurplus ? "muted" : "positive"}
                        size="xs"
                        className="font-bold font-sans"
                      >
                        {isDeficit ? "Abaixo da Meta" : isSurplus ? "Acima da Meta" : "Equilibrado"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
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
              Custódia Consolidada de Ativos por Classe ({activeInvestmentRows.length} ativos)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono num">
            Total Custodiado: <MoneyText cents={numberToCents(totalBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <ReportClassTables
          groups={groupedRows.map((group) => {
            const normCls = group.assetClass.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const color = CLASS_COLORS[group.assetClass.toLowerCase()] ?? CLASS_COLORS[normCls];
            return {
              className: group.assetClass,
              color,
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
            };
          })}
        />

        {/* Tabela Dedicada de Posições Encerradas & Resgates Realizados no Período */}
        {periodRedemptions && periodRedemptions.length > 0 ? (
          <ReportRedemptionsTable items={periodRedemptions} periodLabel={periodLabel} />
        ) : null}
      </section>

      {/* 7. Detalhamento Gráfico da Alocação & Exposição Setorial (Donuts em Largura Total ao Final) */}
      {donutData.classSegments.length > 0 && (
        <section
          aria-label="Detalhamento Gráfico de Alocação e Setores"
          className="flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid print:break-before-page break-before-page"
        >
          <div className="report-section-header flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Detalhamento Gráfico da Alocação & Exposição Setorial
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono num">
              Total Custodiado: <strong className="text-foreground"><MoneyText cents={numberToCents(totalBRL)} /></strong>
            </span>
          </div>

          <ReportAllocationDonuts
            classSegments={donutData.classSegments}
            sectorSegments={donutData.sectorSegments}
            totalBRL={totalBRL}
            totalUniqueSectors={donutData.totalUniqueSectors}
            variant="print"
          />
        </section>
      )}

      {/* 8. Comparativo Histórico de Rentabilidade Mês a Mês (Renderizado apenas com >= 2 meses) */}
      {performanceSeries.length >= 2 && (
        <ReportPerformanceChart
          series={performanceSeries}
          title="Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês"
          className="print-break-inside-avoid"
          annualCdiRate={annualCdiRate}
          annualSelicRate={annualSelicRate}
          annualIpcaRate={annualIpcaRate}
          ibovPeriodReturnPct={ibovPeriodReturnPct}
        />
      )}

      {/* 9. Tópico Final: Metodologias & Métricas de Rentabilidade da Carteira */}
      <section
        aria-label="Metodologias de Rentabilidade"
        className="flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid w-full"
      >
        <div className="report-section-header flex items-center justify-between border-b border-border/70 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Scale className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Metodologias & Métricas de Rentabilidade da Carteira
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Transparência Metodológica (Padrão ANBIMA / CVM)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs w-full">
          {/* 1. TWR */}
          <div className="rounded-xl border border-border/80 bg-surface/40 print:bg-transparent p-3 print:border-border shadow-2xs w-full flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
                <TrendingUp className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">1. TWR (Cotas — Padrão CVM / ANBIMA)</span>
              </span>
              <Badge
                variant={
                  portfolioTwr?.status === "ok" && portfolioTwr.accumulatedRatePct !== null
                    ? portfolioTwr.accumulatedRatePct >= 0
                      ? "positive"
                      : "negative"
                    : "muted"
                }
                size="xs"
                className="font-mono font-bold tracking-tight shrink-0"
              >
                {portfolioTwr?.status === "ok" && portfolioTwr.accumulatedRatePct !== null
                  ? `${portfolioTwr.accumulatedRatePct >= 0 ? "+" : ""}${portfolioTwr.accumulatedRatePct.toFixed(1)}%`
                  : "Em formação"}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Métrica Oficial da Carteira
              </span>
              <p className="text-[10.5px] leading-relaxed text-muted-foreground m-0">
                Apura a performance real das suas decisões de investimento pelo método de cotas. Isola aportes e resgates para que movimentações de capital não distorçam a rentabilidade percentual acumulada.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Comparação com CDI e Ibovespa
              </Badge>
            </div>
          </div>

          {/* 2. TIR */}
          <div className="rounded-xl border border-border/80 bg-surface/40 print:bg-transparent p-3 print:border-border shadow-2xs w-full flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
                <Activity className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">2. Retorno do Bolso (TIR / XIRR)</span>
              </span>
              <Badge
                variant={
                  portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                    ? portfolioIrr.annualizedRatePct >= 0
                      ? "positive"
                      : "negative"
                    : "muted"
                }
                size="xs"
                className="font-mono font-bold tracking-tight shrink-0"
              >
                {portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                  ? `${portfolioIrr.annualizedRatePct >= 0 ? "+" : ""}${portfolioIrr.annualizedRatePct.toFixed(1)}% a.a.`
                  : "Em formação"}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Retorno do Seu Fluxo Pessoal
              </span>
              <p className="text-[10.5px] leading-relaxed text-muted-foreground m-0">
                Taxa anualizada (% a.a.) ponderada pelo dinheiro real que saiu do seu bolso para a corretora frente ao patrimônio atual. Pondera volume por tempo: períodos com maior capital investido exercem maior peso na taxa.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Eficiência do timing de aportes
              </Badge>
            </div>
          </div>

          {/* 3. Retorno Contábil */}
          <div className="rounded-xl border border-border/80 bg-surface/40 print:bg-transparent p-3 print:border-border shadow-2xs w-full flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
                <Briefcase className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">3. Retorno Contábil da Custódia Aberta</span>
              </span>
              <Badge
                variant={
                  totalReturnPct !== null && totalReturnPct !== undefined
                    ? totalReturnPct >= 0
                      ? "positive"
                      : "negative"
                    : "muted"
                }
                size="xs"
                className="font-mono font-bold tracking-tight shrink-0"
              >
                {totalReturnPct !== null && totalReturnPct !== undefined
                  ? formatSignedPct(totalReturnPct)
                  : "0,0%"}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Ganho Estático das Posições Ativas
              </span>
              <p className="text-[10.5px] leading-relaxed text-muted-foreground m-0">
                Mede estritamente a valorização das ações, FIIs e títulos em custódia hoje frente ao Preço Médio pago, somando os proventos recebidos dessas posições ativas. Não considera ativos já vendidos/vencidos nem o tempo decorrido.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Posições em custódia ativa
              </Badge>
            </div>
          </div>

          {/* 4. Resultado Histórico */}
          <div className="rounded-xl border border-border/80 bg-surface/40 print:bg-transparent p-3 print:border-border shadow-2xs w-full flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
                <CircleDollarSign className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">4. Resultado Histórico (P&L Total em R$)</span>
              </span>
              <Badge
                variant={(allTimeEconomicPnlBRL ?? totalReturnBRL) >= 0 ? "positive" : "negative"}
                size="xs"
                className="font-mono font-bold tracking-tight shrink-0"
              >
                <MoneyText
                  cents={numberToCents(allTimeEconomicPnlBRL ?? totalReturnBRL)}
                  tone={(allTimeEconomicPnlBRL ?? totalReturnBRL) >= 0 ? "positive" : "negative"}
                  sign="explicit"
                />
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Riqueza Efetiva Produzida
              </span>
              <p className="text-[10.5px] leading-relaxed text-muted-foreground m-0">
                Consolida em reais todo o ganho líquido acumulado pela carteira desde o primeiro investimento. Soma os lucros brutos realizados em operações encerradas no passado, o ganho de capital aberto de hoje e a totalidade dos proventos já recebidos.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Dimensão financeira total e caixa
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente informativo gerado automaticamente com base nos dados e metas parametrizados pelo titular. Proventos reportados com base no valor líquido creditado em conta (isentos para dividendos e FIIs locais; líquidos de 15% retidos na fonte para JCP e 30% retidos pelo IRS para ativos nos EUA). Valores de retorno contábil sob custódia aberta não deduzem IR latente sobre ganhos não realizados. Não constitui análise, consultoria, recomendação de compra, venda ou alocação de valores mobiliários (Resoluções CVM nº 19 e 20/2021). Rentabilidade passada não representa garantia de retorno futuro."
      />
    </ReportDocumentLayout>
  );
}
