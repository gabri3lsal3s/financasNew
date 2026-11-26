/**
 * Motor puro de derivação de métricas de resumo e fatias de alocação da carteira.
 * Sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import { numberToCents } from "@/domain/money/parse";
import { inferSectorFromTicker } from "./tickers-catalog";

export interface ResumoPositionRowInput {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  valueBRL: number;
  isCash: boolean;
}

export interface ResumoPositionMetricsInput {
  totalBRL: number;
  cashBRL: number;
  totalReturnPnlBRL?: number;
  unrealizedPnlBRL?: number;
  totalReturnPct?: number | null;
  unrealizedPct?: number | null;
  realizedPnlBRL?: number;
  allTimeEconomicPnlBRL?: number;
  totalDividendsBRL?: number;
  portfolioIrr?: {
    isEligible?: boolean;
    annualizedRatePct: number | null;
    periodRatePct?: number | null;
    daysElapsed?: number;
    status?: string;
  } | null;
  portfolioTwr?: {
    status: string;
    accumulatedRatePct: number | null;
    annualizedRatePct?: number | null;
    monthsElapsed?: number;
  } | null;
}

export interface AllocationSliceSummary {
  key: string;
  label: string;
  valueCents: number;
  subtitle: string;
}

export function buildClassAllocationSummaries(
  rows: readonly ResumoPositionRowInput[],
): AllocationSliceSummary[] {
  const classMap = new Map<string, { valueCents: number; count: number }>();
  for (const row of rows) {
    const label = row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe");
    const cents = Math.round(row.valueBRL * 100);
    const prev = classMap.get(label) ?? { valueCents: 0, count: 0 };
    classMap.set(label, { valueCents: prev.valueCents + cents, count: prev.count + 1 });
  }
  return Array.from(classMap.entries())
    .map(([label, { valueCents, count }]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${count} ativo(s)`,
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);
}

export function buildSectorAllocationSummaries(
  rows: readonly ResumoPositionRowInput[],
): AllocationSliceSummary[] {
  const sectorMap = new Map<string, { valueCents: number; count: number }>();
  for (const row of rows) {
    const label = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
    const cents = Math.round(row.valueBRL * 100);
    const prev = sectorMap.get(label) ?? { valueCents: 0, count: 0 };
    sectorMap.set(label, { valueCents: prev.valueCents + cents, count: prev.count + 1 });
  }
  return Array.from(sectorMap.entries())
    .map(([label, { valueCents, count }]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${count} ativo(s)`,
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);
}

export function buildAssetAllocationSummaries(
  rows: readonly ResumoPositionRowInput[],
): AllocationSliceSummary[] {
  return rows
    .filter((row) => row.valueBRL > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL)
    .map((row) => ({
      key: row.assetId,
      label: row.ticker,
      valueCents: Math.round(row.valueBRL * 100),
      subtitle: row.sector ?? row.assetClass ?? (row.isCash ? "Caixa" : "Sem classe"),
    }));
}

export interface PortfolioPerformanceSummary {
  totalReturnPnlBRL: number;
  totalReturnCents: number;
  totalReturnPct: number | null;
  unrealizedPnlBRL: number;
  capitalGainPct: number | null;
  allTimePnlBRL: number;
  allTimePnlCents: number;
  realizedPnlBRL: number;
  realizedPnlCents: number;
  cashPct: number;
  irrTone: "positive" | "negative" | "default";
  irrLabel: string;
  irrHint: string;
  isTwrActive: boolean;
  isCustodyActive: boolean;
  twrTone: "positive" | "negative" | "default";
  twrLabel: string;
  rentabilidadeValue: string;
  rentabilidadeTone: "positive" | "negative" | "default";
  rentabilidadeMode: "twr" | "custody" | "empty";
  twrHintText: string;
}

export function buildPortfolioPerformanceSummary(
  position: ResumoPositionMetricsInput,
): PortfolioPerformanceSummary {
  const totalReturnPnlBRL = position.totalReturnPnlBRL ?? position.unrealizedPnlBRL ?? 0;
  const totalReturnCents = numberToCents(totalReturnPnlBRL);
  const totalReturnPct = position.totalReturnPct ?? position.unrealizedPct ?? null;
  const unrealizedPnlBRL = position.unrealizedPnlBRL ?? 0;
  const capitalGainPct = position.unrealizedPct ?? null;
  const allTimePnlBRL = position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL;
  const realizedPnlBRL = position.realizedPnlBRL ?? 0;
  const cashPct = position.totalBRL > 0 ? (position.cashBRL / position.totalBRL) * 100 : 0;

  const irr = position.portfolioIrr;
  const isIrrReady = Boolean(irr?.isEligible && irr.annualizedRatePct !== null);
  const hasPeriodRate = Boolean(
    irr?.isEligible &&
      irr.periodRatePct !== null &&
      irr.periodRatePct !== undefined &&
      Math.abs(irr.periodRatePct) <= 500,
  );
  const irrRate = irr?.annualizedRatePct ?? irr?.periodRatePct ?? null;
  const irrTone: "positive" | "negative" | "default" =
    isIrrReady || hasPeriodRate ? ((irrRate ?? 0) >= 0 ? "positive" : "negative") : "default";

  const irrLabel = isIrrReady
    ? `${(irr?.annualizedRatePct ?? 0) >= 0 ? "+" : ""}${(irr?.annualizedRatePct ?? 0).toFixed(1).replace(".", ",")}% a.a.`
    : hasPeriodRate && (irr?.daysElapsed ?? 0) >= 30
      ? `${(irr?.periodRatePct ?? 0) >= 0 ? "+" : ""}${(irr?.periodRatePct ?? 0).toFixed(1).replace(".", ",")}% no período`
      : "Em formação";

  const irrHint =
    irr?.status === "insufficient_capital_coverage"
      ? "Aguardando histórico de aportes"
      : (irr?.daysElapsed ?? 0) < 30
        ? `Histórico de ${irr?.daysElapsed ?? 0}d (mín. 30d)`
        : isIrrReady
          ? `Ponderada no tempo (${irr?.daysElapsed}d)`
          : `Histórico de ${irr?.daysElapsed}d (< 365d p/ anualizar)`;

  const twr = position.portfolioTwr;
  const isTwrReady = Boolean(twr && twr.status === "ok");
  const twrRate = twr?.accumulatedRatePct ?? null;
  const twrTone: "positive" | "negative" | "default" = isTwrReady
    ? (twrRate ?? 0) >= 0
      ? "positive"
      : "negative"
    : "default";

  const isTwrActive = isTwrReady && twrRate !== null;
  const isCustodyActive = !isTwrActive && totalReturnPct !== null && totalReturnPct !== undefined;

  const twrLabel = isTwrActive
    ? `${(twrRate ?? 0) >= 0 ? "+" : ""}${(twrRate ?? 0).toFixed(1).replace(".", ",")}%`
    : "Em formação";

  const rentabilidadeValue = isTwrActive
    ? twrLabel
    : isCustodyActive
      ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1).replace(".", ",")}%`
      : "Em formação";

  const rentabilidadeTone: "positive" | "negative" | "default" = isTwrActive
    ? (twrRate ?? 0) >= 0
      ? "positive"
      : "negative"
    : isCustodyActive
      ? totalReturnPnlBRL >= 0
        ? "positive"
        : "negative"
      : "default";

  const rentabilidadeMode: "twr" | "custody" | "empty" = isTwrActive
    ? "twr"
    : isCustodyActive
      ? "custody"
      : "empty";

  const twrHintText = isTwrActive
    ? twr?.annualizedRatePct !== null && twr?.annualizedRatePct !== undefined
      ? `${twr.annualizedRatePct >= 0 ? "+" : ""}${twr.annualizedRatePct.toFixed(1).replace(".", ",")}% a.a. (${twr.monthsElapsed}m)`
      : `Por cotas (${twr?.monthsElapsed ?? 0}m)`
    : "";

  return {
    totalReturnPnlBRL,
    totalReturnCents,
    totalReturnPct,
    unrealizedPnlBRL,
    capitalGainPct,
    allTimePnlBRL,
    allTimePnlCents: numberToCents(allTimePnlBRL),
    realizedPnlBRL,
    realizedPnlCents: numberToCents(realizedPnlBRL),
    cashPct,
    irrTone,
    irrLabel,
    irrHint,
    isTwrActive,
    isCustodyActive,
    twrTone,
    twrLabel,
    rentabilidadeValue,
    rentabilidadeTone,
    rentabilidadeMode,
    twrHintText,
  };
}
