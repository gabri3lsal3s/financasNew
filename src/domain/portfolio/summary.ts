/**
 * Resumo executivo da carteira — FASE 17 (Dashboard /investments).
 *
 * Agregados puros derivados da posição e das transações:
 *   • Rentabilidade ponderada da carteira (Σ pct×valor ÷ Σ valor — ignora caixa);
 *   • Proventos recebidos no mês (dividend/jcp/fii_yield);
 *   • Alocação por ticker (mesmo padrão de `allocationByClass`, §F16).
 *
 * Motor puro — testável isoladamente; a UI só formata os valores.
 */

// ---------------------------------------------------------------------------
// Rentabilidade ponderada
// ---------------------------------------------------------------------------

/**
 * Rentabilidade não realizada da carteira, ponderada pelo valor de mercado:
 *   Σ (unrealizedPct_i × valueBRL_i) ÷ Σ valueBRL_i
 * sobre os ativos com custo (caixa/sem custo ficam fora — `unrealizedPct` null).
 * Retorna `null` quando não há base (carteira vazia ou só caixa).
 */
export function portfolioReturnPct(
  rows: readonly { valueBRL: number; unrealizedPct: number | null }[],
): number | null {
  let weightedSum = 0;
  let totalValue = 0;
  for (const row of rows) {
    if (row.unrealizedPct === null) continue;
    weightedSum += row.unrealizedPct * row.valueBRL;
    totalValue += row.valueBRL;
  }
  if (totalValue <= 0) return null;
  return Math.round((weightedSum / totalValue) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Alocação por ticker
// ---------------------------------------------------------------------------

export interface AllocationTickerSlice {
  /** Ticker do ativo. */
  ticker: string;
  /** Valor de mercado em BRL. */
  valueBRL: number;
  /** % do patrimônio (0–100). */
  pct: number;
}

/**
 * Alocação por ticker (§F17): agrupa as posições por ativo e calcula o peso
 * no patrimônio — mesmo padrão de `allocationByClass` (F16), porém com a
 * chave no ticker (donut "por ticker" do dashboard).
 */
export function allocationByTicker(
  rows: readonly { ticker: string; valueBRL: number }[],
): AllocationTickerSlice[] {
  const byTicker = new Map<string, number>();
  for (const row of rows) {
    byTicker.set(row.ticker, Math.round(((byTicker.get(row.ticker) ?? 0) + row.valueBRL) * 100) / 100);
  }
  const total = Math.round([...byTicker.values()].reduce((acc, value) => acc + value, 0) * 100) / 100;
  return [...byTicker.entries()]
    .map(([ticker, valueBRL]) => ({
      ticker,
      valueBRL,
      pct: total > 0 ? Math.round((valueBRL / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.valueBRL - a.valueBRL);
}

// ---------------------------------------------------------------------------
// Yield on Cost (YoC)
// ---------------------------------------------------------------------------

/**
 * Calcula o Yield on Cost (%) de um ativo:
 *   (totalDividends ÷ totalCost) × 100
 * Retorna null se não houver custo ou proventos recebidos.
 */
export function assetYieldOnCostPct(dividends: number, totalCost: number): number | null {
  if (totalCost <= 0 || dividends <= 0) return null;
  return Math.round((dividends / totalCost) * 10000) / 100;
}
