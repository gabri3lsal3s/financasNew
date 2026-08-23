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
// Rentabilidade da carteira (Retorno Total & Ganho de Capital)
// ---------------------------------------------------------------------------

export interface PortfolioConsolidatedReturn {
  /** Valor de mercado total em BRL dos ativos com custo (exclui caixa 1:1). */
  totalValueBRL: number;
  /** Custo total em BRL dos ativos com custo. */
  totalCostBRL: number;
  /** Proventos totais em BRL acumulados na carteira. */
  totalDividendsBRL: number;
  /** Ganho de capital não realizado em BRL (valor − custo). */
  capitalGainPnl: number;
  /** Variação da cotação % ((valor − custo) ÷ custo). */
  capitalGainPct: number | null;
  /** Resultado total em BRL: (valor − custo) + proventos. */
  totalReturnPnl: number;
  /** Retorno Total % da carteira: ((valor − custo) + proventos) ÷ custo. */
  totalReturnPct: number | null;
}

/**
 * Rentabilidade consolidada da carteira (§F17): calcula o Retorno Total real
 * (valor de mercado − custo total + proventos) e o ganho de capital sobre o custo.
 * Ignora ativos de caixa/sem custo (onde totalCostBRL <= 0 ou isCash).
 */
export function calculatePortfolioTotalReturn(
  rows: readonly {
    valueBRL: number;
    totalCostBRL: number;
    dividends?: number;
    isCash?: boolean;
  }[],
): PortfolioConsolidatedReturn {
  let totalValueBRL = 0;
  let totalCostBRL = 0;
  let totalDividendsBRL = 0;

  for (const row of rows) {
    if (row.isCash || row.totalCostBRL <= 0) continue;
    totalValueBRL += row.valueBRL;
    totalCostBRL += row.totalCostBRL;
    totalDividendsBRL += Math.max(0, row.dividends ?? 0);
  }

  totalValueBRL = Math.round(totalValueBRL * 100) / 100;
  totalCostBRL = Math.round(totalCostBRL * 100) / 100;
  totalDividendsBRL = Math.round(totalDividendsBRL * 100) / 100;

  const capitalGainPnl = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
  const capitalGainPct =
    totalCostBRL > 0 ? Math.round((capitalGainPnl / totalCostBRL) * 10000) / 100 : null;

  const totalReturnPnl = Math.round((capitalGainPnl + totalDividendsBRL) * 100) / 100;
  const totalReturnPct =
    totalCostBRL > 0 ? Math.round((totalReturnPnl / totalCostBRL) * 10000) / 100 : null;

  return {
    totalValueBRL,
    totalCostBRL,
    totalDividendsBRL,
    capitalGainPnl,
    capitalGainPct,
    totalReturnPnl,
    totalReturnPct,
  };
}

/**
 * Rentabilidade não realizada / total da carteira ponderada pelo valor de mercado:
 *   Σ (pct_i × valueBRL_i) ÷ Σ valueBRL_i
 * sobre os ativos com custo (caixa/sem custo ficam fora — `unrealizedPct` null).
 * Retorna `null` quando não há base (carteira vazia ou só caixa).
 */
export function portfolioReturnPct(
  rows: readonly { valueBRL: number; unrealizedPct?: number | null; totalReturnPct?: number | null }[],
): number | null {
  let weightedSum = 0;
  let totalValue = 0;
  for (const row of rows) {
    const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
    if (effectivePct === null || effectivePct === undefined) continue;
    weightedSum += effectivePct * row.valueBRL;
    totalValue += row.valueBRL;
  }
  if (totalValue <= 0) return null;
  return Math.round((weightedSum / totalValue) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Série Mensal de Snapshots com Proventos Integrados (F36 / F37)
// ---------------------------------------------------------------------------

export interface PortfolioMonthlySeriesPoint {
  /** Mês de competência (YYYY-MM). */
  month: string;
  /** Valor de mercado total da custódia em BRL. */
  valueBRL: number;
  /** Custo total aplicado em BRL. */
  costBRL: number;
  /** Proventos recebidos especificamente neste mês em BRL. */
  monthDividendsBRL: number;
  /** Proventos acumulados até o final deste mês em BRL (anteriores + periódicos). */
  accumulatedDividendsBRL: number;
  /** Ganho de capital não realizado em BRL (valor − custo). */
  capitalGainPnl: number;
  /** Variação da cotação % sobre o custo. */
  capitalGainPct: number | null;
  /** Resultado Total em BRL: (valor − custo) + proventos acumulados. */
  totalReturnPnl: number;
  /** Retorno Total % sobre o custo. */
  totalReturnPct: number | null;
}

/**
 * Constrói os pontos da série mensal combinando os snapshots patrimoniais
 * com a evolução temporal de proventos recebidos (§F36 e §F37).
 */
export function buildPortfolioMonthlySeries(params: {
  rawSnapshots: readonly { month: string; total_value: number; total_cost: number }[];
  currentMonthPoint?: { month: string; total_value: number; total_cost: number } | null;
  dividends: readonly { date: string; amount: number }[];
  initialAccumulatedDividends?: number;
  limit?: number;
}): PortfolioMonthlySeriesPoint[] {
  const {
    rawSnapshots,
    currentMonthPoint,
    dividends,
    initialAccumulatedDividends = 0,
    limit = 6,
  } = params;

  const currentMonthStr = currentMonthPoint?.month ?? "";
  const allMonthsMap = new Map<string, { total_value: number; total_cost: number }>();

  for (const snap of rawSnapshots) {
    if (snap.month < currentMonthStr || !currentMonthStr) {
      allMonthsMap.set(snap.month, {
        total_value: Number(snap.total_value),
        total_cost: Number(snap.total_cost),
      });
    }
  }

  if (currentMonthPoint && (currentMonthPoint.total_value > 0 || currentMonthPoint.total_cost > 0)) {
    allMonthsMap.set(currentMonthPoint.month, {
      total_value: Number(currentMonthPoint.total_value),
      total_cost: Number(currentMonthPoint.total_cost),
    });
  }

  const sortedMonths = Array.from(allMonthsMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const points: PortfolioMonthlySeriesPoint[] = [];

  for (const [month, data] of sortedMonths) {
    const valueBRL = Math.round(data.total_value * 100) / 100;
    const costBRL = Math.round(data.total_cost * 100) / 100;

    let monthDividends = 0;
    let periodDividendsUntilMonth = 0;

    for (const d of dividends) {
      if (d.date.startsWith(month)) {
        monthDividends += d.amount;
      }
      if (d.date <= `${month}-31`) {
        periodDividendsUntilMonth += d.amount;
      }
    }

    const monthDividendsBRL = Math.round(monthDividends * 100) / 100;
    const accumulatedDividendsBRL =
      Math.round((initialAccumulatedDividends + periodDividendsUntilMonth) * 100) / 100;

    const capitalGainPnl = Math.round((valueBRL - costBRL) * 100) / 100;
    const capitalGainPct =
      costBRL > 0 ? Math.round((capitalGainPnl / costBRL) * 10000) / 100 : null;

    const totalReturnPnl = Math.round((capitalGainPnl + accumulatedDividendsBRL) * 100) / 100;
    const totalReturnPct =
      costBRL > 0 ? Math.round((totalReturnPnl / costBRL) * 10000) / 100 : null;

    points.push({
      month,
      valueBRL,
      costBRL,
      monthDividendsBRL,
      accumulatedDividendsBRL,
      capitalGainPnl,
      capitalGainPct,
      totalReturnPnl,
      totalReturnPct,
    });
  }

  return limit > 0 ? points.slice(-limit) : points;
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

// ---------------------------------------------------------------------------
// Novo Preço Médio Ponderado (Helper de Aporte / Compra de Lote)
// ---------------------------------------------------------------------------

export interface WeightedAveragePriceResult {
  newQuantity: number;
  newAveragePrice: number;
  newTotalCost: number;
}

/**
 * Calcula o novo preço médio ponderado ao adquirir um novo lote de cotas:
 *   ( (qtdAtual × pmAtual) + (qtdNova × precoNovo) ) ÷ (qtdAtual + qtdNova)
 */
export function calculateWeightedAveragePrice(
  currentQuantity: number,
  currentAveragePrice: number,
  newQuantity: number,
  newPrice: number,
): WeightedAveragePriceResult {
  const safeCurrentQty = Math.max(0, currentQuantity);
  const safeCurrentPm = Math.max(0, currentAveragePrice);
  const safeNewQty = Math.max(0, newQuantity);
  const safeNewPrice = Math.max(0, newPrice);

  const totalQty = safeCurrentQty + safeNewQty;
  if (totalQty <= 0) {
    return { newQuantity: 0, newAveragePrice: 0, newTotalCost: 0 };
  }

  const totalCost = safeCurrentQty * safeCurrentPm + safeNewQty * safeNewPrice;
  const newAveragePrice = totalCost / totalQty;

  return {
    newQuantity: Math.round(totalQty * 100000000) / 100000000,
    newAveragePrice: Math.round(newAveragePrice * 100000000) / 100000000,
    newTotalCost: Math.round(totalCost * 100) / 100,
  };
}
