import { z } from "zod";

/**
 * Representação normalizada de uma transação extraída do extrato/fatura.
 */
export interface StatementTransaction {
  /** Identificador temporário para chave de UI (ex.: "stmt-0", "stmt-1"). */
  id: string;
  /** Índice original na lista parseada. */
  index: number;
  /** Índice ordinal para desambiguação de compras repetidas no mesmo dia (0-based). */
  occurrenceIndex: number;
  /** Data ISO da transação (YYYY-MM-DD). */
  date: string;
  /** Descrição bruta original do extrato. */
  rawDescription: string;
  /** Descrição limpa (sem ruídos de adquirentes ou sufixos geográficos). */
  cleanDescription: string;
  /** Valor monetário absoluto em centavos (inteiro positivo). */
  amountCents: number;
  /** Indica se era um crédito/estorno no extrato original. */
  isRefund: boolean;
  /** Indica se é pagamento de fatura anterior. */
  isPayment: boolean;
  /** Informações de parcelamento detectadas no texto da compra. */
  installment?: {
    current: number;
    total: number;
  };
  /** Hash determinístico SHA-256 ordinal anti-duplicação. */
  statementHash: string;
}

/**
 * Status de correspondência com as despesas já existentes no banco.
 */
export type MatchStatus = "exact_match" | "probable_match" | "unmatched_new";

/**
 * Item de reconciliação para exibição e conferência na UI.
 */
export interface ReconciliationItem {
  /** A transação lida do extrato. */
  transaction: StatementTransaction;
  /** Classificação heurística contra os dados existentes. */
  status: MatchStatus;
  /** Score de similaridade e correspondência (0 a 100). */
  score: number;
  /** ID da despesa correspondente encontrada (quando houver match). */
  matchedExpenseId?: string;
  /** Descrição da despesa existente. */
  matchedExpenseDescription?: string;
  /** Data da despesa existente. */
  matchedExpenseDate?: string;
  /** Valor em centavos da despesa existente. */
  matchedExpenseValueCents?: number;
  /** Categoria sugerida preditivamente. */
  suggestedCategoryId: string;
  /** Categoria atualmente selecionada na UI. */
  selectedCategoryId: string;
  /** Se o item está marcado para ser importado na confirmação final. */
  selected: boolean;
  /** Se a linha deve ser ignorada por padrão (ex.: pagamento de fatura). */
  ignoredByDefault?: boolean;
}

/**
 * Resultado consolidado da reconciliação bidirecional de fatura.
 */
export interface ReconciliationResult {
  /** Itens lidos do extrato com classificação de correspondência. */
  items: ReconciliationItem[];
  /** Despesas cadastradas no app na competência que NÃO foram encontradas no extrato. */
  unmatchedExistingExpenses: ExistingExpenseForReconciliation[];
}

/**
 * Projeção leve de uma despesa existente para o motor de scoring.
 */
export interface ExistingExpenseForReconciliation {
  id: string;
  date: string;
  description: string;
  valueCents: number;
  categoryId: string;
  installmentNumber: number | null;
  installmentsTotal: number | null;
  statementHash?: string | null;
}

/**
 * Estrutura bruta de uma linha após parsing tabular (CSV / Texto / Excel).
 */
export interface RawParsedRow {
  rowIndex: number;
  rawText: string;
  cells: string[];
}

/**
 * Mapeamento de colunas inferido ou ajustado pelo usuário.
 */
export interface ColumnMapping {
  dateColIndex: number;
  descriptionColIndex: number;
  amountColIndex: number;
  hasHeader: boolean;
  startRowIndex: number;
}

/** Schema Zod para validação da transação de extrato. */
export const statementTransactionSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  occurrenceIndex: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  rawDescription: z.string(),
  cleanDescription: z.string(),
  amountCents: z.number().int().positive("Valor deve ser estritamente positivo"),
  isRefund: z.boolean(),
  isPayment: z.boolean(),
  installment: z
    .object({
      current: z.number().int().min(1).max(60),
      total: z.number().int().min(2).max(60),
    })
    .optional(),
  statementHash: z.string().min(8),
});
