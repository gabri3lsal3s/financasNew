import { ReportExecutiveSummary } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  sanitizeReportText,
  type AllocationAnalysisResult,
  type TearSheetModel,
} from "@/domain/reports";
import type { TwrConsolidatedResult, XIRRResult } from "@/domain/portfolio";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";

export interface TearSheetExecutiveNarrativeProps {
  model: TearSheetModel;
  totalBRL: number;
  totalCostBRL: number;
  cashBRL?: number;
  allocationAnalysis: AllocationAnalysisResult;
  portfolioIrr?: XIRRResult;
  portfolioTwr?: TwrConsolidatedResult;
  allTimeEconomicPnlBRL?: number;
}

function formatDeficitClassName(assetClass: string): string {
  const lower = assetClass.toLowerCase();
  if (lower.includes("fii")) return "FIIs";
  if (lower.includes("acao") || lower.includes("acoes")) return "Ações";
  if (lower.includes("renda")) return "Renda Fixa";
  if (lower.includes("internacional")) return "Internacional";
  return sanitizeReportText(assetClass);
}

export function TearSheetExecutiveNarrative({
  model,
  totalBRL,
  totalCostBRL,
  cashBRL = 0,
  allocationAnalysis,
  portfolioIrr,
  portfolioTwr,
  allTimeEconomicPnlBRL,
}: TearSheetExecutiveNarrativeProps) {
  const isTwrActive = Boolean(
    portfolioTwr &&
      portfolioTwr.status === "ok" &&
      portfolioTwr.accumulatedRatePct !== null &&
      portfolioTwr.accumulatedRatePct !== undefined,
  );

  const rentabilidadeItem = isTwrActive
    ? {
        label: "Rentabilidade (TWR)",
        value: (
          <span className={(portfolioTwr?.accumulatedRatePct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"}>
            {formatSignedPct(portfolioTwr?.accumulatedRatePct ?? 0)}
          </span>
        ),
        subtext:
          portfolioTwr?.annualizedRatePct !== null && portfolioTwr?.annualizedRatePct !== undefined
            ? `${formatSignedPct(portfolioTwr.annualizedRatePct)} a.a. (Padrão CVM)`
            : `TWR Histórico Consolidado (${portfolioTwr?.monthsElapsed ?? 0}m)`,
      }
    : {
        label: "Rentabilidade da Carteira",
        value: (
          <span className={model.totalReturnPct >= 0 ? "text-positive-strong" : "text-negative-strong"}>
            {formatSignedPct(model.totalReturnPct)}
          </span>
        ),
        subtext: "Custódia aberta sobre custo",
      };

  const topDeficit = allocationAnalysis.topDeficitClass;
  const deficitRows = [...model.allocationRows].filter((r) => r.isDeficit);
  deficitRows.sort((a, b) => a.deviationBRL - b.deviationBRL);
  const derivedTopDeficit = deficitRows[0]
    ? { assetClass: deficitRows[0].assetClass, gapBRL: Math.abs(deficitRows[0].deviationBRL) }
    : undefined;
  const effectiveTopDeficit =
    topDeficit && topDeficit.gapBRL > 0 && topDeficit.assetClass
      ? topDeficit
      : derivedTopDeficit;

  const totalCostWithCash = Math.max(totalCostBRL, model.effectiveCostBRL + cashBRL);

  const narrative = (
    <span className="text-left">
      A carteira totaliza{" "}
      <strong>
        <MoneyText cents={numberToCents(totalBRL)} className="inline font-bold" />
      </strong>{" "}
      sob custódia (sendo{" "}
      <MoneyText cents={numberToCents(model.totalInvestedValueBRL)} className="inline font-medium" />
      {" "}em ativos e{" "}
      <MoneyText cents={numberToCents(cashBRL)} className="inline font-medium" />
      {" "}em reserva de caixa) frente a um custo de aquisição de{" "}
      <strong>
        <MoneyText cents={numberToCents(model.effectiveCostBRL)} className="inline font-bold" />
      </strong>{" "}
      em ativos aplicados{cashBRL > 0 ? (
        <>
          {" "}(totalizando{" "}
          <strong>
            <MoneyText cents={numberToCents(totalCostWithCash)} className="inline font-bold" />
          </strong>{" "}
          com a reserva de caixa)
        </>
      ) : ""}, acumulando{" "}
      <strong>
        Retorno Total de{" "}
        <MoneyText
          cents={numberToCents(model.totalReturnBRL)}
          tone={model.totalReturnBRL >= 0 ? "positive" : "negative"}
          className="inline font-bold"
        />{" "}
        ({formatSignedPct(model.totalReturnPct)})
      </strong>{" "}
      — composto por{" "}
      <span className={model.unrealizedPnlBRL < 0 ? "text-negative-strong font-bold" : "text-positive-strong font-bold"}>
        {model.unrealizedPnlBRL < 0 ? "-" : ""}
        <MoneyText
          cents={numberToCents(Math.abs(model.unrealizedPnlBRL))}
          tone={model.unrealizedPnlBRL >= 0 ? "positive" : "negative"}
          className="inline font-bold"
        />
      </span>{" "}
      ({formatSignedPct(model.unrealizedPnlPct)}) {model.unrealizedPnlBRL >= 0 ? "de valorização de cota" : "de desvalorização de cota"} e{" "}
      <MoneyText cents={numberToCents(model.totalDividendsAllTime)} tone="positive" className="inline font-bold" />{" "}
      em proventos recebidos
      {Math.abs(model.effectiveRealizedGainBRL) >= 0.01 ? (
        <>
          . Somado ao resultado realizado de posições encerradas e resgates (
          <MoneyText
            cents={numberToCents(model.effectiveRealizedGainBRL)}
            tone={model.effectiveRealizedGainBRL >= 0 ? "positive" : "negative"}
            sign="explicit"
            className="inline font-bold"
          />
          ), o{" "}
          <strong>
            Resultado Econômico Histórico Consolidado totaliza{" "}
            <MoneyText
              cents={numberToCents(model.allTimeEconomicValueBRL)}
              tone={model.allTimeEconomicValueBRL >= 0 ? "positive" : "negative"}
              className="inline font-bold"
            />
          </strong>
          {model.hasTargets ? (
            <>, com índice de equilíbrio geral de <strong>{allocationAnalysis.alignmentScore}%</strong>.{" "}</>
          ) : (
            <>.{" "}</>
          )}
        </>
      ) : model.hasTargets ? (
        <>, com índice de equilíbrio geral de <strong>{allocationAnalysis.alignmentScore}%</strong>.{" "}</>
      ) : (
        <>.{" "}</>
      )}
      {model.hasTargets && effectiveTopDeficit && effectiveTopDeficit.gapBRL > 0 && effectiveTopDeficit.assetClass ? (
        <>
          Conforme a matriz de alocação definida pelo titular, a classe com maior distanciamento negativo da meta é{" "}
          <strong>{formatDeficitClassName(effectiveTopDeficit.assetClass)}</strong> (déficit de{" "}
          <MoneyText cents={numberToCents(effectiveTopDeficit.gapBRL)} className="inline font-bold text-primary-strong" />)
          {model.surplusClasses.length > 0 ? (
            <>, enquanto {model.surplusClasses.join(" e ")} {model.surplusClasses.length === 1 ? "encontra-se" : "encontram-se"} em patamar superior ao planejado</>
          ) : (
            <>, com as demais classes alinhadas aos objetivos</>
          )}
          .{" "}
        </>
      ) : model.hasTargets ? (
        <>Todas as classes de ativos encontram-se atualmente equilibradas em relação às metas estipuladas.{" "}</>
      ) : null}
      {Boolean(
        allocationAnalysis.topDeficitSector &&
          allocationAnalysis.topDeficitSector.gapBRL > 0 &&
          sanitizeReportText(allocationAnalysis.topDeficitSector.sectorName),
      ) && (
        <>
          Em nível setorial/segmento, o maior distanciamento localiza-se em{" "}
          <strong>{sanitizeReportText(allocationAnalysis.topDeficitSector?.sectorName)}</strong>.{" "}
        </>
      )}
      {model.intlPct > 0 ? (
        <span>O portfólio mantém <strong>{formatPercent(model.intlPct)}%</strong> de exposição internacional</span>
      ) : (
        <span>A totalidade dos ativos está alocada no mercado doméstico</span>
      )}
      {model.topDominance.ticker && model.topDominance.ticker !== "N/A" && model.topDominance.pct > 0 ? (
        <span>, e a posição de maior peso individual é <strong>{sanitizeReportText(model.topDominance.ticker)}</strong>, respondendo por <strong>{formatPercent(model.topDominance.pct)}%</strong> do patrimônio total.</span>
      ) : (
        <span>.</span>
      )}
    </span>
  );

  const histValue = allTimeEconomicPnlBRL ?? model.allTimeEconomicValueBRL ?? model.totalReturnBRL;

  return (
    <ReportExecutiveSummary
      title="SÍNTESE DA CARTEIRA & DESEMPENHO CONSOLIDADO"
      items={[
        {
          label: "Patrimônio Total",
          value: <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" />,
          subtext: `Retorno contábil: ${formatSignedPct(model.totalReturnPct)}`,
        },
        rentabilidadeItem,
        {
          label: "Retorno do Bolso (TIR)",
          value:
            portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
              ? `${formatSignedPct(portfolioIrr.annualizedRatePct)} a.a.`
              : portfolioIrr?.status === "insufficient_history" &&
                  portfolioIrr.periodRatePct !== null &&
                  Math.abs(portfolioIrr.periodRatePct) <= 200
                ? `${formatSignedPct(portfolioIrr.periodRatePct)} período`
                : "Em formação",
          subtext: portfolioIrr?.isEligible ? `Ponderada (${portfolioIrr.daysElapsed}d)` : "Requer histórico",
        },
        {
          label: "Resultado Histórico",
          value: (
            <MoneyText
              cents={numberToCents(histValue)}
              tone={histValue >= 0 ? "positive" : "negative"}
              className="inline"
            />
          ),
          subtext: Math.abs(model.effectiveRealizedGainBRL) >= 0.01 ? "P&L Total (Vivo + Encerrados)" : "P&L Econômico Total",
        },
      ]}
      narrative={narrative}
    />
  );
}
