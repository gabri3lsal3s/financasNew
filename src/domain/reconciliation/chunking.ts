/**
 * Módulo de particionamento (chunking) para importação de extratos e faturas.
 *
 * Limita o número de transações enviadas por chamada RPC para respeitar
 * os tetos do PostgREST e mitigar riscos de timeout de transação no PostgreSQL.
 */

export const STATEMENT_IMPORT_CHUNK_SIZE = 250;


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
