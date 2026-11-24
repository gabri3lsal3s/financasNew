
/**
 * Taxonomia canônica das 6 naturezas de lançamento no extrato/fatura.
 */
export type StatementTransactionNature =
  | "purchase" // Compra regular no cartão (débito)
  | "fee_or_tax" // Encargo cobrado (IOF, anuidade, juros, multa, tarifa)
  | "invoice_payment" // Quitação da fatura anterior pelo titular (crédito)
  | "refund" // Estorno de compra cancelada (crédito)
  | "subcard_header" // Cabeçalho institucional ou de cartão adicional (ruído)
  | "fx_detail"; // Detalhamento de câmbio / cotação de compra internacional

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
  /** Data ISO da transação (YYYY-MM-DD), clampada para >= 2026-01-01 para persistência. */
  date: string;
  /** Data original extraída do extrato (mesmo que anterior a 2026-01-01). */
  originalDate?: string;
  /** Natureza canônica da transação. */
  nature?: StatementTransactionNature;
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
  /** Identificador único do banco (FITID no OFX, se disponível). */
  fitid?: string;
  /** Tipo de encargo inferido do extrato (juros, multa, IOF, tarifa bancária). */
  inferredChargeKind?: import("@/types").ChargeKind | null;
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
  /** Se o item é uma duplicata detectada dentro do próprio arquivo importado. */
  isInternalDuplicate?: boolean;
  /** Motivo ou detalhe descritivo de duplicidade detectada. */
  duplicateReason?: string;
  /** Esfera fiscal atribuída na importação (PF vs PJ). */
  scope?: "personal" | "business";
  /** Se a despesa do negócio é dedutível para impostos. */
  isTaxDeductible?: boolean;
  /** Natureza canônica da transação. */
  nature?: StatementTransactionNature;
  /** Ação sugerida de conciliação para 1 clique na interface. */
  suggestedAction?:
    | "link_and_adjust_amount"
    | "import_and_project_series"
    | "import_single"
    | "link_existing";
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
  chargeKind?: import("@/types").ChargeKind | null;
  scope?: "personal" | "business";
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
  debitColIndex?: number;
  creditColIndex?: number;
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
  /** Se o item é uma duplicata detectada dentro do próprio arquivo importado. */
  isInternalDuplicate?: boolean;
  /** Motivo ou detalhe descritivo de duplicidade detectada. */
  duplicateReason?: string;
  /** Esfera fiscal atribuída na importação (PF vs PJ). */
  scope?: "personal" | "business";
  /** Se a despesa do negócio é dedutível para impostos. */
  isTaxDeductible?: boolean;
  /** Natureza canônica da transação. */
  nature?: StatementTransactionNature;
  /** Ação sugerida de conciliação para 1 clique na interface. */
  suggestedAction?:
    | "link_and_adjust_amount"
    | "import_and_project_series"
    | "import_single"
    | "link_existing";
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


