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
export interface CategoryPredictionSource {
  description: string;
  categoryId: string;
}

export type StatementSourceType = "ofx" | "csv" | "text_paste";

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
  typeColIndex?: number;
  hasHeader: boolean;
  startRowIndex: number;
}

/**
 * Natureza classificada de uma transação de conta corrente.
 */
export type BankTransactionKind = "expense" | "income" | "transfer_ignored" | "card_payment_ignored";

/**
 * Projeção leve de uma receita existente para o motor de scoring.
 */
export interface ExistingIncomeForReconciliation {
  id: string;
  date: string;
  description: string;
  valueCents: number;
  receiveType?: string | null;
  statementHash?: string | null;
}

/**
 * Item de reconciliação de conta corrente (Despesas e Receitas).
 */
export interface BankTransactionItem {
  /** A transação lida do extrato. */
  transaction: StatementTransaction;
  /** Natureza da transação (saída, entrada ou ignorada por regra de negócio). */
  kind: BankTransactionKind;
  /** Classificação de correspondência contra o banco. */
  status: MatchStatus;
  /** Score de similaridade e correspondência (0 a 100). */
  score: number;
  /** Vínculo com despesa existente (quando houver match de saída). */
  matchedExpenseId?: string;
  matchedExpenseDescription?: string;
  matchedExpenseDate?: string;
  matchedExpenseValueCents?: number;
  /** Vínculo com receita existente (quando houver match de entrada). */
  matchedIncomeId?: string;
  matchedIncomeDescription?: string;
  matchedIncomeDate?: string;
  matchedIncomeValueCents?: number;
  /** Categoria sugerida preditivamente (para saídas). */
  suggestedCategoryId: string;
  /** Categoria atualmente selecionada na UI (para saídas). */
  selectedCategoryId: string;
  /** Tipo de recebimento sugerido (para entradas: 'pix', 'ted', 'salario', etc.). */
  suggestedReceiveType?: string;
  /** Tipo de recebimento selecionado na UI (para entradas). */
  selectedReceiveType?: string;
  /** Se o item está marcado para ser importado na confirmação final. */
  selected: boolean;
  /** Se a linha foi desmarcada por padrão pelas travas de segurança. */
  ignoredByDefault?: boolean;
  /** Motivo descritivo para ter sido ignorada (ex.: "Pagamento de fatura de cartão"). */
  ignoreReason?: string;
}

/**
 * Resultado consolidado da reconciliação bidirecional de conta corrente.
 */
export interface BankReconciliationResult {
  /** Transações lidas do extrato com classificação e correspondência. */
  items: BankTransactionItem[];
  /** Despesas cadastradas no app que NÃO foram encontradas no extrato. */
  unmatchedExistingExpenses: ExistingExpenseForReconciliation[];
  /** Receitas cadastradas no app que NÃO foram encontradas no extrato. */
  unmatchedExistingIncomes: ExistingIncomeForReconciliation[];
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

