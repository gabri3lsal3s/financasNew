import { Layers, PieChart, TrendingUp, Landmark, Award } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportKpiGrid,
  ReportStackedBar,
  ReportGapPinBar,
  ReportRiskGauge,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatSignedPct } from "@/services/masks/percent";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/reports";

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

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/**
 * Dossiê Executivo de Investimentos & Tear Sheet Patrimonial.
 *
 * Estrutura institucional completa:
 * 1. Header Oficial com Monograma e Metadados;
 * 2. Grade de 4 KPIs Executivos com tipografia tabular mono;
 * 3. Matriz de Alocação por Classe & Setor (Target vs. Actual) com Barras de Desvio (Gaps);
 * 4. Termômetro de Concentração e Risco da Carteira (Ativo, Setor e Moeda);
 * 5. Parecer Técnico Automatizado da Consultoria;
 * 6. Tabela Completa de Custódia de Ativos;
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
  const investmentRows = rows.filter((r) => !r.isCash);
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

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê de Alocação & Risco da Carteira"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Dossiê Executivo de Investimentos &amp; Custódia"
        subtitle="Posição Patrimonial Consolidada &amp; Diagnóstico de Metas"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Grade de 4 KPIs Executivos */}
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "Patrimônio Total",
            value: <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" />,
            subtext: "Posição de Mercado",
            icon: Landmark,
            tone: "primary",
          },
          {
            label: "Capital Investido",
            value: <MoneyText cents={numberToCents(totalCostBRL)} tone="default" />,
            subtext: "Custo de Aquisição",
            icon: Layers,
            tone: "default",
          },
          {
            label: "Resultado Não Realizado",
            value: (
              <div className="flex items-center gap-1.5 flex-wrap">
                <MoneyText
                  cents={numberToCents(unrealizedPnlBRL)}
                  tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"}
                />
                <span
                  className={`text-xs font-semibold ${
                    unrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }`}
                >
                  ({formatSignedPct(unrealizedPnlPct)})
                </span>
              </div>
            ),
            subtext: unrealizedPnlBRL >= 0 ? "Lucro Contábil" : "Desvalorização",
            icon: TrendingUp,
            tone: unrealizedPnlBRL >= 0 ? "positive" : "negative",
          },
          {
            label: "Aderência às Metas",
            value: `${allocationAnalysis.alignmentScore}%`,
            subtext: "Índice de Equilíbrio",
            icon: Award,
            tone: "accent",
          },
        ]}
      />

      {/* 3. Seção: Diagnóstico de Alocação por Classe & Setor */}
      <section aria-label="Matriz de Rebalanceamento" className="break-inside-avoid flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PieChart className="size-4 text-primary-strong" aria-hidden="true" />
          <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">
            Diagnóstico de Alocação por Classe e Setor (Target vs. Actual)
          </h3>
        </div>

        {/* Barra de Distribuição Empilhada */}
        <ReportStackedBar
          title="Distribuição Atual da Carteira"
          segments={stackedSegments}
          height={12}
        />

        {/* Tabela de Classes e Gaps */}
        <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse print:table-fixed">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
                <th className="py-2.5 px-3 print:w-[22%]">Classe</th>
                <th className="py-2.5 px-3 text-right print:w-[18%]">Atual (R$)</th>
                <th className="py-2.5 px-3 text-right print:w-[14%]">Atual (%)</th>
                <th className="py-2.5 px-3 text-right print:w-[14%]">Meta (%)</th>
                <th className="py-2.5 px-3 text-right print:w-[18%]">Gap (R$)</th>
                <th className="py-2.5 px-3 text-center print:w-[14%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {allocationAnalysis.classGaps.map((cg) => (
                <tr key={cg.assetClass} className="hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium capitalize text-foreground">{cg.assetClass}</td>
                  <td className="py-2 px-3 text-right num font-mono">
                    <MoneyText cents={numberToCents(cg.currentBRL)} />
                  </td>
                  <td className="py-2 px-3 text-right num font-mono">{cg.currentPct.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right num font-mono">
                    {cg.targetPct > 0 ? `${cg.targetPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right num font-mono">
                    {cg.gapBRL > 0 ? (
                      <MoneyText
                        cents={numberToCents(cg.gapBRL)}
                        tone="default"
                        className="text-primary-strong font-semibold"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        cg.status === "deficit"
                          ? "bg-primary/10 text-primary-strong border border-primary/20"
                          : cg.status === "surplus"
                            ? "bg-muted/40 text-muted-foreground border border-border"
                            : "bg-positive/10 text-positive-strong border border-positive/20"
                      }`}
                    >
                      {cg.status === "deficit"
                        ? "Aportar"
                        : cg.status === "surplus"
                          ? "Acima da Meta"
                          : "Equilibrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tabela Resumida de Top Setores */}
        {allocationAnalysis.sectorGaps.length > 0 ? (
          <div className="pt-2 flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Alocação Setorial &amp; Déficits Identificados
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {allocationAnalysis.sectorGaps.slice(0, 6).map((sg) => (
                <div
                  key={`${sg.className}::${sg.sectorName}`}
                  className="rounded-lg border border-border/60 bg-muted/10 p-2.5 flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate">{sg.sectorName}</span>
                    <span className="text-[10px] text-muted-foreground">{sg.className}</span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="font-mono font-medium text-foreground">{sg.currentPct.toFixed(1)}%</span>
                    {sg.gapBRL > 0 ? (
                      <span className="text-primary-strong text-[11px] font-semibold">
                        Gap: R$ {sg.gapBRL.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">Equilibrado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Comparativo Visual de Gaps */}
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Desvio das Metas por Classe
          </h4>
          <ReportGapPinBar items={gapPinItems} />
        </div>
      </section>

      {/* 4. Seção: Termômetro de Risco e Concentração */}
      <section aria-label="Risco e Concentração" className="break-inside-avoid flex flex-col gap-3">
        <ReportRiskGauge
          topItemName={topDominance.ticker}
          topItemPct={topDominance.pct}
          warningThresholdPct={15}
          criticalThresholdPct={25}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-1.5 break-inside-avoid">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Concentração Top 5
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">5 maiores ativos:</span>
              <strong className="num font-mono font-bold text-foreground">
                {concentrationRisk.top5Pct.toFixed(1)}%
              </strong>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-1.5 break-inside-avoid">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Setor Dominante
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">
                {concentrationRisk.topSectorDominance?.sector ?? "Nenhum"}:
              </span>
              <strong className="num font-mono font-bold text-foreground shrink-0">
                {concentrationRisk.topSectorDominance ? `${concentrationRisk.topSectorDominance.pct.toFixed(1)}%` : "0%"}
              </strong>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-1.5 break-inside-avoid">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Exposição Cambial
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">BRL:</span>
              <strong className="num font-mono font-bold text-foreground">
                {concentrationRisk.currencyExposure.brlPct.toFixed(1)}%
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">USD:</span>
              <strong className="num font-mono font-bold text-foreground">
                {concentrationRisk.currencyExposure.usdPct.toFixed(1)}%
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Seção: Parecer Técnico da Consultoria */}
      {allocationAnalysis.topDeficitClass || allocationAnalysis.topDeficitSector || concentrationRisk.riskAlerts.length > 0 ? (
        <section
          aria-label="Parecer da consultoria"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2 break-inside-avoid"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-primary-strong">
            Parecer do Consultor Patrimonial
          </span>
          <div className="flex flex-col gap-1.5 text-xs text-foreground/90 leading-relaxed">
            {allocationAnalysis.topDeficitClass ? (
              <p>
                <strong>Prioridade de Classe:</strong> A classe{" "}
                <strong>{allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}</strong> está com a maior defasagem patrimonial, demandando aproximadamente{" "}
                <MoneyText
                  cents={numberToCents(allocationAnalysis.topDeficitClass.gapBRL)}
                  tone="default"
                  className="text-primary-strong font-bold inline"
                />{" "}
                para restabelecer o equilíbrio das suas metas.
              </p>
            ) : null}
            {allocationAnalysis.topDeficitSector ? (
              <p>
                <strong>Prioridade Setorial:</strong> O setor{" "}
                <strong>{allocationAnalysis.topDeficitSector.sectorName}</strong> ({allocationAnalysis.topDeficitSector.className}) apresenta o maior déficit de alocação, necessitando de{" "}
                <MoneyText
                  cents={numberToCents(allocationAnalysis.topDeficitSector.gapBRL)}
                  tone="default"
                  className="text-portfolio font-bold inline"
                />{" "}
                para atingir o percentual-alvo.
              </p>
            ) : null}
            {concentrationRisk.riskAlerts.map((alert) => (
              <p key={alert.code} className="text-muted-foreground">
                • {alert.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6. Seção: Detalhamento Completo da Custódia de Ativos */}
      <section aria-label="Custódia de Ativos" className="flex flex-col gap-3 pt-2">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">
          Custódia Consolidada de Ativos ({investmentRows.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse print:table-fixed">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
                <th className="py-2.5 px-3 print:w-[13%]">Ticker</th>
                <th className="py-2.5 px-3 print:w-[12%]">Classe</th>
                <th className="py-2.5 px-3 print:w-[14%]">Setor</th>
                <th className="py-2.5 px-3 text-right print:w-[8%]">Qtd</th>
                <th className="py-2.5 px-3 text-right print:w-[11%]">Preço Médio</th>
                <th className="py-2.5 px-3 text-right print:w-[11%]">Cotação</th>
                <th className="py-2.5 px-3 text-right print:w-[13%]">Total (R$)</th>
                <th className="py-2.5 px-3 text-right print:w-[9%]">PnL (%)</th>
                <th className="py-2.5 px-3 text-right print:w-[9%]">YoC (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {investmentRows.map((r) => (
                <tr key={r.ticker} className="hover:bg-muted/20">
                  <td className="py-2 px-3 font-semibold text-foreground truncate">{r.ticker}</td>
                  <td className="py-2 px-3 capitalize text-muted-foreground truncate">{r.assetClass}</td>
                  <td className="py-2 px-3 capitalize text-muted-foreground truncate">{r.sector ?? "Geral"}</td>
                  <td className="py-2 px-3 text-right num font-mono">{formatQuantity(r.quantity)}</td>
                  <td className="py-2 px-3 text-right num font-mono">
                    <MoneyText cents={numberToCents(r.averagePrice)} />
                  </td>
                  <td className="py-2 px-3 text-right num font-mono">
                    <MoneyText cents={numberToCents(r.currentPrice)} />
                  </td>
                  <td className="py-2 px-3 text-right num font-mono font-medium text-foreground">
                    <MoneyText cents={numberToCents(r.valueBRL)} />
                  </td>
                  <td
                    className={`py-2 px-3 text-right num font-mono font-semibold ${
                      r.unrealizedPnlPct >= 0 ? "text-positive-strong" : "text-negative-strong"
                    }`}
                  >
                    {formatSignedPct(r.unrealizedPnlPct)}
                  </td>
                  <td className="py-2 px-3 text-right num font-mono text-positive-strong font-medium">
                    {r.yocPct > 0 ? `${r.yocPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente confidencial gerado pelo titular da conta via Guia Financeiro. As informações refletem a posição de custódia e cotações na data de emissão."
      />
    </ReportDocumentLayout>
  );
}
