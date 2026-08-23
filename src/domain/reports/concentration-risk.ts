/**
 * Motor de Avaliação de Risco de Concentração e Exposição Cambial — Consultoria (§F42).
 *
 * Função pura que audita a carteira identificando:
 * - Concentração nos Top 5 e Top 10 ativos;
 * - Dominância excessiva de um único ativo;
 * - Exposição cambial (BRL vs. USD / Moeda Forte);
 * - Alertas técnicos de risco de portfólio.
 */

export interface PositionRiskInput {
  id: string;
  ticker: string;
  assetClass: string;
  currency: "BRL" | "USD";
  valueBRL: number;
  isCash?: boolean;
}

export interface CurrencyExposure {
  brlBRL: number;
  brlPct: number;
  usdBRL: number;
  usdPct: number;
}

export type RiskAlertLevel = "info" | "warning" | "critical";

export interface RiskAlert {
  level: RiskAlertLevel;
  code: string;
  title: string;
  message: string;
}

export interface ConcentrationRiskResult {
  totalBRL: number;
  top5BRL: number;
  top5Pct: number;
  top10BRL: number;
  top10Pct: number;
  singleAssetDominance: { ticker: string; valueBRL: number; pct: number } | null;
  currencyExposure: CurrencyExposure;
  riskScore: number; // 0 (alta concentração/risco) a 100 (excelente diversificação)
  riskAlerts: RiskAlert[];
}

function divideSafe(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

export function calculateConcentrationRisk(positions: readonly PositionRiskInput[]): ConcentrationRiskResult {
  const totalBRL = positions.reduce((acc, p) => acc + Math.max(0, p.valueBRL), 0);

  if (totalBRL === 0 || positions.length === 0) {
    return {
      totalBRL: 0,
      top5BRL: 0,
      top5Pct: 0,
      top10BRL: 0,
      top10Pct: 0,
      singleAssetDominance: null,
      currencyExposure: { brlBRL: 0, brlPct: 100, usdBRL: 0, usdPct: 0 },
      riskScore: 100,
      riskAlerts: [],
    };
  }

  // Ordenar posições por valor BRL decrescente (excluindo caixa para análise de ativos de risco)
  const nonCashSorted = [...positions.filter((p) => !p.isCash)].sort((a, b) => b.valueBRL - a.valueBRL);

  const top5BRL = nonCashSorted.slice(0, 5).reduce((acc, p) => acc + Math.max(0, p.valueBRL), 0);
  const top5Pct = divideSafe(top5BRL, totalBRL) * 100;

  const top10BRL = nonCashSorted.slice(0, 10).reduce((acc, p) => acc + Math.max(0, p.valueBRL), 0);
  const top10Pct = divideSafe(top10BRL, totalBRL) * 100;

  const highestAsset = nonCashSorted[0] ?? null;
  const singleAssetDominance = highestAsset
    ? {
        ticker: highestAsset.ticker,
        valueBRL: highestAsset.valueBRL,
        pct: divideSafe(highestAsset.valueBRL, totalBRL) * 100,
      }
    : null;

  // Exposição cambial
  let brlBRL = 0;
  let usdBRL = 0;

  for (const pos of positions) {
    const val = Math.max(0, pos.valueBRL);
    if (pos.currency === "USD") {
      usdBRL += val;
    } else {
      brlBRL += val;
    }
  }

  const brlPct = divideSafe(brlBRL, totalBRL) * 100;
  const usdPct = divideSafe(usdBRL, totalBRL) * 100;

  const alerts: RiskAlert[] = [];

  // Alerta 1: Ativo individual acima de 20%
  if (singleAssetDominance && singleAssetDominance.pct > 20 && nonCashSorted.length > 3) {
    alerts.push({
      level: singleAssetDominance.pct > 35 ? "critical" : "warning",
      code: "SINGLE_ASSET_CONCENTRATION",
      title: "Alta Concentração em Ativo Único",
      message: `O ativo ${singleAssetDominance.ticker} representa ${singleAssetDominance.pct.toFixed(1)}% do patrimônio total. Considere diluir em novos aportes.`,
    });
  }

  // Alerta 2: Top 5 acima de 60% com mais de 7 ativos
  if (top5Pct > 60 && nonCashSorted.length >= 7) {
    alerts.push({
      level: "warning",
      code: "TOP5_CONCENTRATION",
      title: "Concentração nos Maiores Ativos",
      message: `Os 5 principais ativos concentram ${top5Pct.toFixed(1)}% de toda a sua carteira de investimentos.`,
    });
  }

  // Alerta 3: Falta de diversificação internacional
  if (usdPct === 0 && totalBRL >= 15000 && nonCashSorted.length >= 5) {
    alerts.push({
      level: "info",
      code: "NO_GLOBAL_EXPOSURE",
      title: "Exposição Internacional Nula",
      message: "100% dos seus investimentos estão atrelados ao Real brasileiro. Avalie expor uma parcela a ativos globais.",
    });
  }

  // Cálculo do Risk/Diversification Score (0 a 100)
  // Penalidades por concentração
  let score = 100;
  if (singleAssetDominance && singleAssetDominance.pct > 20) {
    score -= Math.min(30, (singleAssetDominance.pct - 20) * 1.5);
  }
  if (top5Pct > 60) {
    score -= Math.min(20, (top5Pct - 60) * 0.8);
  }
  if (usdPct > 0 && usdPct <= 40) {
    score = Math.min(100, score + 5); // Bônus por internacionalização equilibrada
  }

  const riskScore = Math.max(10, Math.min(100, Math.round(score)));

  return {
    totalBRL,
    top5BRL,
    top5Pct,
    top10BRL,
    top10Pct,
    singleAssetDominance,
    currencyExposure: {
      brlBRL,
      brlPct,
      usdBRL,
      usdPct,
    },
    riskScore,
    riskAlerts: alerts,
  };
}
