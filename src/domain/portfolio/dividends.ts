/**
 * Proventos da carteira — FASE 18 (Extrato & Calendário).
 *
 * Agregados puros dos proventos RECEBIDOS (`dividend`/`jcp`/`fii_yield`):
 *   • Extrato de um mês (lista ordenada por data, por ativo);
 *   • Total por mês (série anual para o calendário);
 *   • Total no mês corrente (reuso do dashboard executivo F17).
 *
 * Motor puro — testável isoladamente; a UI só formata os valores.
 * Provisionados (estimativa futura) ficam fora do escopo (decisão F18).
 *
 * Adicionado (F40+):
 *   • DividendEntryMode — modo de registro: "daily" (data exata) ou "monthly" (extrato do mês).
 *   • resolveDividendDate — resolve a data ISO a gravar conforme o modo.
 *   • resolveDividendNote — gera a nota padrão com tag [MENSAL] quando aplicável.
 */

const DIVIDEND_TYPES: ReadonlySet<string> = new Set(["dividend", "jcp", "fii_yield"]);

export interface DividendTransaction {
  /** Data da transação (YYYY-MM-DD). */
  date: string;
  /** Valor total do provento em BRL. */
  total: number;
  /** Tipo da operação (dividend/jcp/fii_yield). */
  type: string;
}

/** Filtra apenas transações de provento (dividend/jcp/fii_yield). */
export function isDividendType(type: string): boolean {
  return DIVIDEND_TYPES.has(type);
}

/** Soma dos proventos recebidos no mês (YYYY-MM) — valor em BRL. */
export function dividendsInMonth(transactions: readonly DividendTransaction[], month: string): number {
  let total = 0;
  for (const tx of transactions) {
    if (isDividendType(tx.type) && tx.date.startsWith(month)) {
      total += tx.total;
    }
  }
  return Math.round(total * 100) / 100;
}

export interface DividendEntry {
  /** Data do provento (YYYY-MM-DD). */
  date: string;
  /** Ticker do ativo pagador. */
  ticker: string;
  /** Tipo da operação (dividend/jcp/fii_yield). */
  type: string;
  /** Valor do provento em BRL. */
  total: number;
}

export interface MonthDividendSummary {
  /** Mês (YYYY-MM). */
  month: string;
  /** Total recebido no mês (BRL). */
  total: number;
}

/**
 * Extrato de proventos de um mês — lista ordenada por data (mais recente
 * primeiro, desempate estável) com o ticker do ativo pagador. Reconciliado:
 * a soma dos itens é exatamente `dividendsInMonth` do mesmo mês.
 */
export function dividendExtractForMonth(
  transactions: readonly (DividendTransaction & { asset_id?: string; assetId?: string })[],
  tickerByAssetId: ReadonlyMap<string, string>,
  month: string,
): DividendEntry[] {
  const entries: DividendEntry[] = [];
  for (const tx of transactions) {
    if (!isDividendType(tx.type) || !tx.date.startsWith(month)) continue;
    const assetId = tx.asset_id ?? tx.assetId ?? "";
    entries.push({
      date: tx.date,
      ticker: tickerByAssetId.get(assetId) ?? "—",
      type: tx.type,
      total: Math.round(tx.total * 100) / 100,
    });
  }
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Série anual de proventos — total recebido em cada mês do ano (YYYY).
 * Todos os 12 meses presentes (zero quando sem proventos) para o calendário
 * exibir o ano completo de forma consistente.
 */
export function dividendsByYear(transactions: readonly DividendTransaction[], year: string): MonthDividendSummary[] {
  const byMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (!isDividendType(tx.type) || !tx.date.startsWith(year)) continue;
    const month = tx.date.slice(0, 7);
    byMonth.set(month, Math.round(((byMonth.get(month) ?? 0) + tx.total) * 100) / 100);
  }
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  return months.map((month) => ({ month, total: byMonth.get(month) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Modo de Registro de Provento — Diário vs. Extrato do Mês
// ---------------------------------------------------------------------------

/**
 * Modo de registro de provento no formulário de lançamento:
 * - "daily"  : data exata do recebimento (DatePicker → YYYY-MM-DD).
 * - "monthly": competência mensal consolidada (MonthPicker → YYYY-MM).
 *              A data gravada é sempre o primeiro dia do mês (YYYY-MM-01),
 *              determinístico e previsível. A nota recebe a tag [MENSAL].
 */
export type DividendEntryMode = "daily" | "monthly";

/**
 * Resolve a data ISO a ser gravada em `portfolio_dividends` conforme o modo:
 * - "daily"  : preserva a data exata (YYYY-MM-DD) informada pelo DatePicker.
 * - "monthly": converte YYYY-MM (MonthPicker) → YYYY-MM-01.
 */
export function resolveDividendDate(mode: DividendEntryMode, value: string): string {
  if (mode === "monthly") {
    // Extrai YYYY-MM e fixa no primeiro dia do mês (YYYY-MM-01)
    const monthKey = value.slice(0, 7);
    return `${monthKey}-01`;
  }
  // value = "YYYY-MM-DD" vindo do DatePicker
  return value;
}


/**
 * Gera a nota padrão para o lançamento conforme o modo e inputs do usuário.
 * - Modo "monthly": prefixa com "[MENSAL]" para rastreabilidade no extrato.
 * - Modo "daily"  : usa a nota do usuário como está, sem prefixo.
 * O tipo (ex: "DIVIDEND", "FII_YIELD") é usado como fallback quando não há nota.
 */
export function resolveDividendNote(
  mode: DividendEntryMode,
  userNote: string,
  type: string,
): string {
  const base = userNote.trim() ? userNote.trim() : type.toUpperCase();
  if (mode === "monthly") {
    return `[MENSAL] ${base}`;
  }
  return base;
}

export interface DividendPayerItem {
  ticker?: string | null;
  amount: number;
}

/**
 * Identifica o maior pagador de proventos em uma lista de proventos.
 */
export function topDividendPayer(
  items: readonly DividendPayerItem[],
): { ticker: string; amount: number } | null {
  if (items.length === 0) return null;
  const payerMap = new Map<string, number>();
  for (const item of items) {
    const ticker = item.ticker ?? "Ativo";
    payerMap.set(ticker, (payerMap.get(ticker) ?? 0) + item.amount);
  }
  let topTicker = "";
  let topAmount = 0;
  for (const [ticker, amount] of payerMap.entries()) {
    if (amount > topAmount) {
      topAmount = amount;
      topTicker = ticker;
    }
  }
  return topAmount > 0 ? { ticker: topTicker, amount: Math.round(topAmount * 100) / 100 } : null;
}

/**
 * Identifica o mês com maior volume de proventos em uma série anual.
 */
export function bestDividendMonth(
  series: readonly MonthDividendSummary[],
): MonthDividendSummary | null {
  const monthsWithValues = series.filter((m) => m.total > 0);
  const first = monthsWithValues[0];
  if (!first) return null;
  return monthsWithValues.reduce((best, cur) => (cur.total > best.total ? cur : best), first);
}

/**
 * Calcula a média de Yield on Cost da carteira (ponderada por ativos que possuem YoC positivo).
 */
export function calculatePortfolioAverageYoC(yocs: readonly number[]): number {
  const valid = yocs.filter((y) => Number.isFinite(y) && y > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, y) => acc + y, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

/**
 * Calcula o custo total de aquisição de uma lista de ativos (em reais).
 */
export function calculateTotalCostBRL(
  assets: readonly { quantity: number; average_price: number }[],
): number {
  let total = 0;
  for (const asset of assets) {
    if (asset.quantity > 0 && asset.average_price > 0) {
      total += asset.quantity * asset.average_price;
    }
  }
  return Math.round(total * 100) / 100;
}

