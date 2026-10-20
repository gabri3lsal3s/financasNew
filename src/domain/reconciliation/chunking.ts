/**
 * Módulo de particionamento (chunking) para importação de extratos e faturas.
 *
 * Limita o número de transações enviadas por chamada RPC para respeitar
 * os tetos do PostgREST e mitigar riscos de timeout de transação no PostgreSQL.
 */

export const STATEMENT_IMPORT_CHUNK_SIZE = 250;

export interface StatementBatchChunk<TExpense, TIncome> {
  expenses: TExpense[];
  incomes: TIncome[];
}

/**
 * Divide coleções de despesas e receitas em lotes sequenciais de tamanho máximo `maxChunkSize`
 * (soma de despesas + receitas em cada lote <= maxChunkSize).
 *
 * @param expenses Lista de despesas a serem particionadas.
 * @param incomes Lista de receitas a serem particionadas.
 * @param maxChunkSize Quantidade máxima de transações combinadas por lote (padrão: 250).
 * @returns Lista de lotes balanceados contendo as fatias correspondentes.
 */
export function chunkBankStatementBatch<TExpense, TIncome>(
  expenses: readonly TExpense[],
  incomes: readonly TIncome[],
  maxChunkSize: number = STATEMENT_IMPORT_CHUNK_SIZE,
): StatementBatchChunk<TExpense, TIncome>[] {
  if (maxChunkSize <= 0) {
    throw new Error("maxChunkSize deve ser maior que zero.");
  }

  const totalCount = expenses.length + incomes.length;
  if (totalCount === 0) {
    return [];
  }

  const chunks: StatementBatchChunk<TExpense, TIncome>[] = [];
  let expenseIndex = 0;
  let incomeIndex = 0;

  while (expenseIndex < expenses.length || incomeIndex < incomes.length) {
    let remainingCapacity = maxChunkSize;
    const chunkExpenses: TExpense[] = [];
    const chunkIncomes: TIncome[] = [];

    if (expenseIndex < expenses.length) {
      const takeExpenses = Math.min(remainingCapacity, expenses.length - expenseIndex);
      chunkExpenses.push(...expenses.slice(expenseIndex, expenseIndex + takeExpenses));
      expenseIndex += takeExpenses;
      remainingCapacity -= takeExpenses;
    }

    if (remainingCapacity > 0 && incomeIndex < incomes.length) {
      const takeIncomes = Math.min(remainingCapacity, incomes.length - incomeIndex);
      chunkIncomes.push(...incomes.slice(incomeIndex, incomeIndex + takeIncomes));
      incomeIndex += takeIncomes;
    }

    chunks.push({
      expenses: chunkExpenses,
      incomes: chunkIncomes,
    });
  }

  return chunks;
}

/**
 * Particiona um array linear genérico em lotes com tamanho máximo especificado.
 *
 * @param items Array de itens a fatiar.
 * @param chunkSize Tamanho máximo de cada fatia (padrão: 250).
 */
export function chunkArray<T>(
  items: readonly T[],
  chunkSize: number = STATEMENT_IMPORT_CHUNK_SIZE,
): T[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize deve ser maior que zero.");
  }

  if (items.length === 0) {
    return [];
  }

  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}
