/**
 * Módulo de particionamento (chunking) para importação e conciliação de extratos e faturas.
 *
 * Limita o número de transações enviadas por chamada RPC para respeitar
 * os tetos do PostgREST e mitigar riscos de timeout de transação no PostgreSQL,
 * garantindo que séries parceladas jamais sejam partidas entre lotes.
 */

export const STATEMENT_IMPORT_CHUNK_SIZE = 250;
export const STATEMENT_COMMIT_CHUNK_SIZE = 500;

export interface StatementCommitExpenseChunkItem {
  installment_group_id?: string | null;
}

export interface StatementCommitPlanInput<
  TExpense extends StatementCommitExpenseChunkItem = StatementCommitExpenseChunkItem,
  TAdjustment = Record<string, unknown>,
  TMove = Record<string, unknown>,
  TRefund = Record<string, unknown>,
> {
  expenses: readonly TExpense[];
  linkAdjustments?: readonly TAdjustment[];
  competenceMoves?: readonly TMove[];
  refunds?: readonly TRefund[];
  deleteExpenseIds?: readonly string[];
}

export interface StatementCommitChunkPayload<
  TExpense extends StatementCommitExpenseChunkItem = StatementCommitExpenseChunkItem,
  TAdjustment = Record<string, unknown>,
  TMove = Record<string, unknown>,
  TRefund = Record<string, unknown>,
> {
  chunkIndex: number;
  totalChunks: number;
  expenses: TExpense[];
  linkAdjustments: TAdjustment[];
  competenceMoves: TMove[];
  refunds: TRefund[];
  deleteExpenseIds: string[];
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

/**
 * Constrói lotes atômicos para `commit_statement_reconciliation` respeitando teto de 500 despesas por lote:
 * - Exclusões, ajustes, movimentações de competência e estornos vão obrigatoriamente no Lote 1;
 * - Séries com o mesmo `installment_group_id` formam blocos indivisíveis (nunca quebrados entre lotes);
 * - Um único bloco maior que `maxExpensesPerChunk` é mantido íntegro em um lote próprio (teto máximo de parcelas é 60).
 */
export function buildStatementCommitChunks<
  TExpense extends StatementCommitExpenseChunkItem,
  TAdjustment,
  TMove,
  TRefund,
>(
  plan: StatementCommitPlanInput<TExpense, TAdjustment, TMove, TRefund>,
  maxExpensesPerChunk: number = STATEMENT_COMMIT_CHUNK_SIZE,
): Array<StatementCommitChunkPayload<TExpense, TAdjustment, TMove, TRefund>> {
  if (maxExpensesPerChunk <= 0) {
    throw new Error("maxExpensesPerChunk deve ser maior que zero.");
  }

  const linkAdjustments = [...(plan.linkAdjustments ?? [])];
  const competenceMoves = [...(plan.competenceMoves ?? [])];
  const refunds = [...(plan.refunds ?? [])];
  const deleteExpenseIds = [...(plan.deleteExpenseIds ?? [])];

  const hasHeaderOps =
    linkAdjustments.length > 0 ||
    competenceMoves.length > 0 ||
    refunds.length > 0 ||
    deleteExpenseIds.length > 0;

  if (plan.expenses.length === 0) {
    if (!hasHeaderOps) return [];
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        expenses: [],
        linkAdjustments,
        competenceMoves,
        refunds,
        deleteExpenseIds,
      },
    ];
  }

  // Agrupa despesas preservando ordem de aparição; itens com mesmo `installment_group_id` ficam juntos
  const orderedBlocks: TExpense[][] = [];
  const blockByGroupId = new Map<string, TExpense[]>();

  for (const exp of plan.expenses) {
    const groupId = exp.installment_group_id;
    if (groupId) {
      let existingBlock = blockByGroupId.get(groupId);
      if (!existingBlock) {
        existingBlock = [];
        blockByGroupId.set(groupId, existingBlock);
        orderedBlocks.push(existingBlock);
      }
      existingBlock.push(exp);
    } else {
      orderedBlocks.push([exp]);
    }
  }

  const expenseBuckets: TExpense[][] = [];
  let currentBucket: TExpense[] = [];

  for (const block of orderedBlocks) {
    if (
      currentBucket.length > 0 &&
      currentBucket.length + block.length > maxExpensesPerChunk
    ) {
      expenseBuckets.push(currentBucket);
      currentBucket = [];
    }
    currentBucket.push(...block);
  }
  if (currentBucket.length > 0) {
    expenseBuckets.push(currentBucket);
  }

  const totalChunks = expenseBuckets.length;
  return expenseBuckets.map((expenses, idx) => ({
    chunkIndex: idx,
    totalChunks,
    expenses,
    linkAdjustments: idx === 0 ? linkAdjustments : [],
    competenceMoves: idx === 0 ? competenceMoves : [],
    refunds: idx === 0 ? refunds : [],
    deleteExpenseIds: idx === 0 ? deleteExpenseIds : [],
  }));
}
