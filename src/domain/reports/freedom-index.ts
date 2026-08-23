/**
 * Motor de Cálculo de Liberdade Financeira, Cobertura de Custo de Vida e Runway (§F42).
 *
 * Função pura que determina:
 * - Grau de Liberdade Financeira (% do custo de vida coberto por proventos);
 * - Runway / Autonomia da Reserva de Emergência e Liquidez (em meses);
 * - Estágio de Independência Financeira (0% a 100%+);
 * - Diagnóstico do Efeito Bola de Neve (ativos com proventos mensais >= preço da cota).
 */

export interface SnowballAssetInput {
  ticker: string;
  currentPriceBRL: number;
  monthlyDividendPerShareBRL: number;
  quantity: number;
}

export interface SnowballAssetAnalysis {
  ticker: string;
  currentPriceBRL: number;
  monthlyIncomeGeneratedBRL: number;
  newSharesPerMonth: number;
  monthsToBuyOneShare: number;
  isSnowballReached: boolean;
}

export type FreedomStage =
  | "initial" // < 10%
  | "building" // 10% - 25%
  | "quarter" // 25% - 50%
  | "half" // 50% - 75%
  | "security" // 75% - 99%
  | "freedom"; // >= 100%

export interface FreedomAnalysisResult {
  monthlyDividendsBRL: number;
  monthlyExpensesBRL: number;
  liquidReservesBRL: number;
  freedomPct: number;
  freedomStage: FreedomStage;
  stageLabel: string;
  runwayMonths: number;
  snowballAssets: SnowballAssetAnalysis[];
  totalSnowballAssetsCount: number;
}

function divideSafe(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

export function getFreedomStage(freedomPct: number): { stage: FreedomStage; label: string } {
  if (freedomPct >= 100) return { stage: "freedom", label: "Independência Financeira Plena (100%+)" };
  if (freedomPct >= 75) return { stage: "security", label: "Alta Segurança Financeira (75% a 99%)" };
  if (freedomPct >= 50) return { stage: "half", label: "Meio Caminho da Liberdade (50% a 74%)" };
  if (freedomPct >= 25) return { stage: "quarter", label: "Primeiro Quarto Conquistado (25% a 49%)" };
  if (freedomPct >= 10) return { stage: "building", label: "Fase de Construção (10% a 24%)" };
  return { stage: "initial", label: "Fase Inicial (< 10%)" };
}

export function calculateFreedomIndex(
  monthlyDividendsBRL: number,
  monthlyExpensesBRL: number,
  liquidReservesBRL = 0,
  assets: readonly SnowballAssetInput[] = [],
): FreedomAnalysisResult {
  const safeDividends = Math.max(0, monthlyDividendsBRL);
  const safeExpenses = Math.max(0, monthlyExpensesBRL);
  const safeReserves = Math.max(0, liquidReservesBRL);

  const freedomPct = divideSafe(safeDividends, safeExpenses) * 100;
  const { stage, label } = getFreedomStage(freedomPct);

  const runwayMonths = divideSafe(safeReserves, safeExpenses);

  const snowballAssets: SnowballAssetAnalysis[] = [];
  let totalSnowballAssetsCount = 0;

  for (const asset of assets) {
    const price = Math.max(0, asset.currentPriceBRL);
    const divPerShare = Math.max(0, asset.monthlyDividendPerShareBRL);
    const qty = Math.max(0, asset.quantity);

    const monthlyIncomeGeneratedBRL = divPerShare * qty;
    const newSharesPerMonth = price > 0 ? divideSafe(monthlyIncomeGeneratedBRL, price) : 0;
    const monthsToBuyOneShare = monthlyIncomeGeneratedBRL > 0 && price > 0 ? divideSafe(price, monthlyIncomeGeneratedBRL) : 0;
    const isSnowballReached = newSharesPerMonth >= 1.0;

    if (isSnowballReached) {
      totalSnowballAssetsCount++;
    }

    if (price > 0 && divPerShare > 0) {
      snowballAssets.push({
        ticker: asset.ticker,
        currentPriceBRL: price,
        monthlyIncomeGeneratedBRL,
        newSharesPerMonth,
        monthsToBuyOneShare,
        isSnowballReached,
      });
    }
  }

  // Ordenar bola de neve: mais próximos de 1 cota ou que mais compram cotas
  snowballAssets.sort((a, b) => b.newSharesPerMonth - a.newSharesPerMonth);

  return {
    monthlyDividendsBRL: safeDividends,
    monthlyExpensesBRL: safeExpenses,
    liquidReservesBRL: safeReserves,
    freedomPct,
    freedomStage: stage,
    stageLabel: label,
    runwayMonths,
    snowballAssets,
    totalSnowballAssetsCount,
  };
}
