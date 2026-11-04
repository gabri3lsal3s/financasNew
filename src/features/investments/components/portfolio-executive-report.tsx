import { useState, useMemo } from "react";
import { TrendingUp, FileText, SlidersHorizontal, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
  ReportExecutiveSummary,
  ReportClassTables,
} from "@/components/modules/reports";
import { MonthlyClosingEditor } from "./monthly-closing-editor";
import { usePortfolioMonthlyPosition, usePortfolioSnapshots, useDeletePortfolioSnapshot } from "@/state";
import { numberToCents } from "@/domain/money";
import { formatFixedIncomeRateLabel } from "@/domain/portfolio/fixed-income";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import { currentMonth, formatMonthYear } from "@/lib/date";
import type { PositionRow } from "@/components/modules/position-table";

export interface PortfolioExecutiveReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PositionRow[];
  totalBRL: number;
  cashBRL: number;
  yearDividendsBRL: number;
  portfolioIrr?: import("@/domain/portfolio").XIRRResult;
  portfolioTwr?: import("@/domain/portfolio").TwrConsolidatedResult;
  totalReturnPct?: number | null;
  totalReturnPnlBRL?: number;
  allTimeEconomicPnlBRL?: number;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
  initialMonth?: string;
}

/**
 * Relatorio Executivo de Acompanhamento da Carteira em padrao A4/PDF (§F40/F51).
 * Suporta selecao retroativa de competencia e modo de auditoria/ajuste de fechamento.
 */
export function PortfolioExecutiveReport({
  open,
  onOpenChange,
  rows,
  totalBRL,
  cashBRL,
  yearDividendsBRL,
  portfolioIrr,
  portfolioTwr,
  totalReturnPct,
  totalReturnPnlBRL,
  allTimeEconomicPnlBRL,
  appName = "Áxis Finance",
  accountHolder,
  initialMonth,
}: PortfolioExecutiveReportProps) {
  const activeMonth = currentMonth();
  // Define competência inicial com base estrita no initialMonth solicitado se presente
  const [selectedMonth, setSelectedMonth] = useState<string>(() => initialMonth ?? activeMonth);
  const [activeTab, setActiveTab] = useState<"report" | "closing">("report");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Sincroniza a competência selecionada durante a renderização quando initialMonth mudar (padrão oficial React)
  const [prevInitialMonth, setPrevInitialMonth] = useState(initialMonth);
  if (initialMonth !== prevInitialMonth) {
    setPrevInitialMonth(initialMonth);
    const nextMonth = initialMonth ?? activeMonth;
    setSelectedMonth(nextMonth);
    setActiveTab("report");
  }

  const deleteSnapshotMutation = useDeletePortfolioSnapshot();

  // Consulta snapshots historicos para povoar as opcoes de meses disponiveis
  const snapshotsQuery = usePortfolioSnapshots();

  // Opcoes de meses: mes corrente + meses com snapshots gravados
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(activeMonth);
    if (initialMonth) monthsSet.add(initialMonth);

    const snapshots = snapshotsQuery.data ?? [];
    for (const snap of snapshots) {
      if (snap.month) monthsSet.add(snap.month);
    }

    return Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map((m) => ({
        value: m,
        label: m === activeMonth ? `${formatMonthYear(m)} (Mês Atual)` : formatMonthYear(m),
      }));
  }, [activeMonth, initialMonth, snapshotsQuery.data]);

  const isCurrentSelected = selectedMonth === activeMonth;

  // Carrega a posicao historica ponto-no-tempo para o mes selecionado
  const monthlyPositionQuery = usePortfolioMonthlyPosition(selectedMonth);

  // Mapeia posicoes para PositionRow de acordo com a fonte
  const effectiveRows: PositionRow[] = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) {
      return rows;
    }

    const pit = monthlyPositionQuery.data;
    const pitRows: PositionRow[] = pit.positions.map((p) => ({
      assetId: p.assetId ?? p.ticker,
      ticker: p.ticker,
      assetClass: p.assetClass,
      sector: p.sector ?? undefined,
      currency: (p.currency as "BRL" | "USD") ?? "BRL",
      quantity: p.quantity,
      averageCost: p.averagePrice,
      totalCost: p.totalCost,
      totalCostBRL: p.totalCostBRL,
      priceQuote: p.priceQuote ?? p.priceBRL,
      priceBRL: p.priceBRL,
      usdRate: p.currency === "USD" && p.priceQuote && p.priceQuote > 0 ? p.priceBRL / p.priceQuote : 1,
      valueBRL: p.valueBRL,
      pct: pit.totalValueBRL > 0 ? (p.valueBRL / pit.totalValueBRL) * 100 : 0,
      source: (p.quoteSource ?? "manual") as import("@/components/modules/position-table").PositionRow["source"],
      pricingMode: "unit_price",
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPct: p.unrealizedPct,
      dividends: p.accumulatedDividendsBRL,
      totalReturnPnl: p.totalReturnPnl,
      totalReturnPct: p.totalReturnPct,
      isCash: false,
    }));

    if (pit.cashQuantity > 0) {
      pitRows.push({
        assetId: "caixa-pit",
        ticker: "CAIXA",
        assetClass: "Caixa",
        sector: "Liquidez",
        currency: "BRL",
        quantity: pit.cashQuantity,
        averageCost: 1,
        totalCost: pit.cashQuantity,
        totalCostBRL: pit.cashQuantity,
        priceQuote: 1,
        priceBRL: 1,
        usdRate: 1,
        valueBRL: pit.cashQuantity,
        pct: pit.totalValueBRL > 0 ? (pit.cashQuantity / pit.totalValueBRL) * 100 : 0,
        source: "manual",
        pricingMode: "cash",
        unrealizedPnl: 0,
        unrealizedPct: 0,
        dividends: 0,
        totalReturnPnl: 0,
        totalReturnPct: 0,
        isCash: true,
      });
    }

    return pitRows;
  }, [isCurrentSelected, monthlyPositionQuery.data, rows]);

  const effectiveTotalBRL = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) return totalBRL;
    return monthlyPositionQuery.data.totalValueBRL;
  }, [isCurrentSelected, monthlyPositionQuery.data, totalBRL]);

  const effectiveCashBRL = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) return cashBRL;
    return monthlyPositionQuery.data.cashQuantity;
  }, [isCurrentSelected, monthlyPositionQuery.data, cashBRL]);

  const effectiveCostBRL = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) {
      return rows.reduce((acc, r) => acc + (r.totalCostBRL ?? r.totalCost ?? 0), 0);
    }
    return monthlyPositionQuery.data.totalCostBRL;
  }, [isCurrentSelected, monthlyPositionQuery.data, rows]);

  const effectiveReturnPnlBRL = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) {
      return totalReturnPnlBRL ?? (allTimeEconomicPnlBRL ?? 0);
    }
    return monthlyPositionQuery.data.positions.reduce((acc, p) => acc + p.totalReturnPnl, 0);
  }, [isCurrentSelected, monthlyPositionQuery.data, totalReturnPnlBRL, allTimeEconomicPnlBRL]);

  const effectiveReturnPct = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) {
      return totalReturnPct;
    }
    const cost = monthlyPositionQuery.data.totalCostBRL;
    return cost > 0 ? (effectiveReturnPnlBRL / cost) * 100 : 0;
  }, [isCurrentSelected, monthlyPositionQuery.data, effectiveReturnPnlBRL, totalReturnPct]);

  const effectiveDividendsBRL = useMemo(() => {
    if (isCurrentSelected || !monthlyPositionQuery.data) return yearDividendsBRL;
    return monthlyPositionQuery.data.accumulatedDividendsTotalBRL;
  }, [isCurrentSelected, monthlyPositionQuery.data, yearDividendsBRL]);

  const effectivePeriodLabel = useMemo(() => {
    if (isCurrentSelected) return "Posição Atual Consolidada";
    return `Competência: ${formatMonthYear(selectedMonth)} — Posição de Fechamento`;
  }, [isCurrentSelected, selectedMonth]);

  const investmentRows = useMemo(() => effectiveRows.filter((r) => !r.isCash), [effectiveRows]);

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
        const totalCostBRLGroup = items.reduce((acc, i) => {
          const itemCostBRL =
            i.totalCostBRL !== undefined && i.totalCostBRL !== null && i.totalCostBRL > 0
              ? i.totalCostBRL
              : i.currency === "USD"
                ? i.quantity * i.averageCost * (i.usdRate ?? 1)
                : i.quantity * i.averageCost;
          return acc + Math.max(0, itemCostBRL);
        }, 0);
        const totalDividendsBRLGroup = items.reduce((acc, i) => acc + (i.dividends ?? 0), 0);
        const totalReturnPnlBRLGroup = items.reduce((acc, i) => {
          const itemCostBRL =
            i.totalCostBRL !== undefined && i.totalCostBRL !== null && i.totalCostBRL > 0
              ? i.totalCostBRL
              : i.currency === "USD"
                ? i.quantity * i.averageCost * (i.usdRate ?? 1)
                : i.quantity * i.averageCost;
          const pnl =
            i.totalReturnPnl !== undefined && i.totalReturnPnl !== null
              ? i.totalReturnPnl
              : (i.valueBRL - itemCostBRL) + (i.dividends ?? 0);
          return acc + pnl;
        }, 0);

        // Retorno Total % consolidado da classe sobre o custo em BRL
        const classTotalReturnPct =
          totalCostBRLGroup > 0 ? (totalReturnPnlBRLGroup / totalCostBRLGroup) * 100 : 0;

        return {
          className,
          totalCents: numberToCents(subtotalBRL),
          totalCostCents: numberToCents(totalCostBRLGroup),
          totalDividendsCents: numberToCents(totalDividendsBRLGroup),
          sharePct: effectiveTotalBRL > 0 ? (subtotalBRL / effectiveTotalBRL) * 100 : 0,
          pnlPct: classTotalReturnPct,
          items: items.map((i) => {
            const isUsd = i.currency === "USD";
            const quoteOrPrice = i.priceQuote || i.priceBRL;
            // Para ativos em USD: Var. Cota é na moeda original USD (conforme legenda e padrão de mercado)
            const nativePriceVarPct =
              isUsd && i.averageCost > 0 && quoteOrPrice > 0
                ? ((quoteOrPrice - i.averageCost) / i.averageCost) * 100
                : (i.unrealizedPct ?? 0);

            const itemTotalReturnPct =
              i.totalReturnPct !== undefined && i.totalReturnPct !== null
                ? i.totalReturnPct
                : (i.unrealizedPct ?? 0);

            return {
              ticker: i.ticker,
              sector: i.sector,
              quantity: i.quantity,
              avgPriceCents: numberToCents(i.averageCost),
              currentPriceCents: numberToCents(quoteOrPrice),
              totalCents: numberToCents(i.valueBRL),
              pricePnlPct: nativePriceVarPct,
              pnlPct: itemTotalReturnPct,
              dividendsCents: numberToCents(i.dividends ?? 0),
              currency: i.currency,
              indexType: i.fixedIncomeMetadata
                ? formatFixedIncomeRateLabel(i.fixedIncomeMetadata)
                : null,
              maturityDate: i.fixedIncomeMetadata?.maturity_date ?? i.maturityDate ?? null,
            };
          }),
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [investmentRows, effectiveTotalBRL]);

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo da Carteira"
      size="2xl"
    >
      <div className="flex flex-col gap-4 w-full">
        {/* Barra Superior Interativa: Seletor de Competencia e Abas de Modo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-surface/80 shadow-2xs print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              Competência:
            </span>
            <div className="w-48">
              <Select
                value={selectedMonth}
                onValueChange={(val) => setSelectedMonth(val)}
                options={monthOptions}
                ariaLabel="Selecionar competência do relatório"
              />
            </div>
            <Badge
              variant={isCurrentSelected ? "portfolio" : "muted"}
              size="xs"
              className="shrink-0 font-medium"
            >
              {isCurrentSelected ? "Mês Aberto" : "Fechamento Histórico"}
            </Badge>

            {!isCurrentSelected && snapshotsQuery.data?.some((s) => s.month === selectedMonth) ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDeleteModalOpen(true)}
                className="text-muted-foreground hover:text-negative-strong hover:bg-negative/10 gap-1.5 h-6 px-2 text-[11px] cursor-pointer"
                title="Excluir snapshot gravado deste mês"
              >
                <Trash2 className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>Excluir Fechamento</span>
              </Button>
            ) : null}
          </div>

          <div className="w-full sm:w-auto">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "report" | "closing")}
              variant="pills"
              items={[
                {
                  value: "report",
                  label: "Relatório Executivo (A4)",
                  icon: <FileText className="size-3.5" aria-hidden="true" />,
                },
                {
                  value: "closing",
                  label: "Conferir & Ajustar",
                  icon: <SlidersHorizontal className="size-3.5" aria-hidden="true" />,
                },
              ]}
            />
          </div>
        </div>

        {/* Conteudo: Aba 2 (Conferir e Ajustar Fechamento) */}
        {activeTab === "closing" && (
          monthlyPositionQuery.isLoading ? (
            <div className="flex flex-col gap-4 w-full p-4 sm:p-6 rounded-2xl border border-border/80 bg-surface shadow-xs my-2 print:hidden">
              <Skeleton className="h-10 w-48 rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : monthlyPositionQuery.isError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-border/80 bg-surface shadow-xs gap-3 my-2 print:hidden">
              <p className="text-xs text-muted-foreground">Falha ao carregar dados de fechamento desta competência.</p>
              <Button size="xs" variant="outline" onClick={() => monthlyPositionQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : monthlyPositionQuery.data ? (
            <div className="pt-1 print:hidden">
              <MonthlyClosingEditor
                month={selectedMonth}
                historicalPosition={monthlyPositionQuery.data}
                onSaved={() => {
                  setActiveTab("report");
                  void monthlyPositionQuery.refetch();
                }}
              />
            </div>
          ) : null
        )}

        {/* Conteúdo: Aba 1 (Relatório Executivo A4 / PDF Oficial) */}
        {activeTab === "report" && (
          <>
            {!isCurrentSelected && monthlyPositionQuery.isLoading ? (
              <div
                data-testid="report-loading-skeleton"
                className="flex flex-col gap-4 w-full p-4 sm:p-6 rounded-2xl border border-border/80 bg-surface shadow-xs my-2"
              >
                <Skeleton className="h-20 w-full rounded-xl" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : !isCurrentSelected && monthlyPositionQuery.isError ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-surface shadow-xs gap-4 my-2">
                <div className="flex items-center justify-center size-12 rounded-xl bg-negative/10 text-negative-strong">
                  <AlertCircle className="size-6 text-negative-strong" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5 max-w-lg">
                  <h3 className="text-base font-bold text-foreground">
                    Falha ao Carregar Competência Histórica
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Não foi possível recuperar os dados desta competência. Verifique sua conexão e tente novamente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => monthlyPositionQuery.refetch()}
                  className="gap-2 cursor-pointer"
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Tentar novamente</span>
                </Button>
              </div>
            ) : !isCurrentSelected &&
            monthlyPositionQuery.data?.fidelity &&
            !monthlyPositionQuery.data.fidelity.canGenerateExecutiveReport ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-surface shadow-xs gap-4 my-2">
                <div className="flex items-center justify-center size-12 rounded-xl bg-muted/60 text-muted-foreground">
                  <AlertCircle className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5 max-w-lg">
                  <h3 className="text-base font-bold text-foreground">
                    Relatório Analítico Não Disponível para esta Competência
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {monthlyPositionQuery.data.fidelity.reasons[0] ??
                      "Esta competência possui apenas registro consolidado de saldo patrimonial (TWA). Não há arquivo auditado de ativos e cotações para este mês."}
                  </p>
                </div>

                {monthlyPositionQuery.data.fidelity.snapshotTotalValue ? (
                  <div className="flex flex-wrap items-center justify-center gap-3 p-3 rounded-xl bg-surface-hover/70 border border-border/70 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Saldo Registrado (TWA):</span>
                      <MoneyText
                        cents={numberToCents(monthlyPositionQuery.data.fidelity.snapshotTotalValue)}
                        tone="portfolio"
                        className="font-bold"
                      />
                    </div>
                    <span className="text-border" aria-hidden="true">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Custódia Analítica:</span>
                      <span className="font-semibold text-warning-strong">Pendente de calibração</span>
                    </div>
                  </div>
                ) : null}

                <p className="text-[11px] text-muted-foreground/80 max-w-md">
                  Para manter a fidedignidade institucional (padrão CVM/Anbima), relatórios analíticos oficiais de custódia não são gerados com dados incompletos. Você pode calibrar as cotações e oficializar este fechamento.
                </p>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setActiveTab("closing")}
                  className="gap-2 cursor-pointer mt-1 font-semibold"
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  <span>Conferir & Calibrar Fechamento</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                {/* Cabecalho do Relatorio */}
                <ReportHeader
                  title="Relatório Executivo de Acompanhamento da Carteira"
                  subtitle="Posição Patrimonial Consolidada & Custódia de Ativos"
                  periodLabel={effectivePeriodLabel}
                  appName={appName}
                  icon={TrendingUp}
              accountHolder={accountHolder}
            />

            {/* Sintese Executiva em Linha Unica */}
            {(() => {
              const isTwrActive = Boolean(
                isCurrentSelected &&
                  portfolioTwr &&
                  portfolioTwr.status === "ok" &&
                  portfolioTwr.accumulatedRatePct !== null,
              );
              const isCustodyActive =
                !isTwrActive && effectiveReturnPct !== null && effectiveReturnPct !== undefined;

              const rentabilidadeItem =
                isCurrentSelected && portfolioTwr && isTwrActive
                  ? {
                      label: "Rentabilidade (TWR)",
                      value: (
                        <span
                          className={
                            portfolioTwr.accumulatedRatePct >= 0
                              ? "text-positive-strong"
                              : "text-negative-strong"
                          }
                        >
                          {portfolioTwr.accumulatedRatePct >= 0 ? "+" : ""}
                          {portfolioTwr.accumulatedRatePct.toFixed(1)}%
                        </span>
                      ),
                      subtext:
                        portfolioTwr.annualizedRatePct !== null
                          ? `${portfolioTwr.annualizedRatePct >= 0 ? "+" : ""}${portfolioTwr.annualizedRatePct.toFixed(1)}% a.a. (Padrão CVM)`
                          : `Por cotas (${portfolioTwr.monthsElapsed}m)`,
                    }
                  : isCustodyActive
                    ? {
                        label: isCurrentSelected ? "Rentabilidade da Carteira" : "Retorno na Competência",
                        value: (
                          <span
                            className={
                              (effectiveReturnPct ?? 0) >= 0
                                ? "text-positive-strong"
                                : "text-negative-strong"
                            }
                          >
                            {(effectiveReturnPct ?? 0) >= 0 ? "+" : ""}
                            {(effectiveReturnPct ?? 0).toFixed(1)}%
                          </span>
                        ),
                        subtext: isCurrentSelected ? "Custódia aberta sobre custo" : "Retorno total sobre custo",
                      }
                    : {
                        label: "Rentabilidade da Carteira",
                        value: "Em formação",
                        subtext: "Requer histórico",
                      };

              return (
                <ReportExecutiveSummary
                  title="SÍNTESE PATRIMONIAL & DESEMPENHO"
                  items={[
                    {
                      label: "Patrimônio Total",
                      value: (
                        <MoneyText cents={numberToCents(effectiveTotalBRL)} tone="portfolio" />
                      ),
                      subtext: `${investmentRows.length} ativos em custódia`,
                    },
                    rentabilidadeItem,
                    {
                      label: "Retorno do Bolso (TIR)",
                      value:
                        portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                          ? `${portfolioIrr.annualizedRatePct >= 0 ? "+" : ""}${portfolioIrr.annualizedRatePct.toFixed(1)}% a.a.`
                          : "Em formação",
                      subtext: portfolioIrr?.isEligible
                        ? `Ponderada (${portfolioIrr.daysElapsed}d)`
                        : "Requer histórico",
                    },
                    {
                      label: "Resultado Histórico",
                      value: (() => {
                        const finalPnl = isCurrentSelected
                          ? (allTimeEconomicPnlBRL ?? totalReturnPnlBRL ?? 0)
                          : effectiveReturnPnlBRL;
                        return (
                          <span
                            className={
                              finalPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
                            }
                          >
                            <MoneyText
                              cents={numberToCents(finalPnl)}
                              tone={finalPnl >= 0 ? "positive" : "negative"}
                            />
                          </span>
                        );
                      })(),
                      subtext: isCurrentSelected ? "P&L Econômico Total" : "P&L Total da Competência",
                    },
                  ]}
                  narrative={
                    <span>
                      A carteira encerra o período com{" "}
                      <strong>
                        <MoneyText
                          cents={numberToCents(effectiveTotalBRL)}
                          className="inline font-bold"
                        />
                      </strong>{" "}
                      sob custódia (custo de aquisição de{" "}
                      <MoneyText
                        cents={numberToCents(effectiveCostBRL)}
                        className="inline font-bold text-muted-foreground"
                      />
                      ), distribuídos em{" "}
                      <strong>{investmentRows.length} ativos</strong> e{" "}
                      <strong>{classGroups.length} classes de investimento</strong>. O saldo em
                      reserva de liquidez é de{" "}
                      <MoneyText
                        cents={numberToCents(effectiveCashBRL)}
                        className="inline font-bold"
                      />{" "}
                      e os proventos acumulados no exercício somam{" "}
                      <MoneyText
                        cents={numberToCents(effectiveDividendsBRL)}
                        className="inline font-bold text-positive-strong"
                      />
                      .
                    </span>
                  }
                />
              );
            })()}

            {/* Tabelas Especializadas por Classe */}
            <section aria-label="Detalhamento das Posições" className="flex flex-col gap-3 pt-1">
              <ReportClassTables groups={classGroups} />
            </section>

            {/* Rodapé */}
            <ReportFooter
              accountHolder={accountHolder}
              disclaimer={OFFICIAL_CVM_DISCLAIMER}
            />
          </div>
        )}
      </>
    )}

        {/* Diálogo de Confirmação de Exclusão de Fechamento Histórico */}
        <ConfirmDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          title="Excluir Fechamento Histórico"
          description={`Tem certeza que deseja excluir o fechamento e as cotações gravadas para ${formatMonthYear(selectedMonth)}? A carteira passará a utilizar as cotações de referência/estimadas até que um novo fechamento seja realizado.`}
          confirmLabel={deleteSnapshotMutation.isPending ? "Excluindo..." : "Excluir Fechamento"}
          variant="destructive"
          onConfirm={async () => {
            await deleteSnapshotMutation.mutateAsync(selectedMonth);
            setDeleteModalOpen(false);
            setSelectedMonth(activeMonth);
            setActiveTab("report");
          }}
        />
      </div>
    </ReportDocumentLayout>
  );
}
