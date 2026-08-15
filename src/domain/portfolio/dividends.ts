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
