import type { ChargeKind, TransactionScope } from "@/types";

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

export type RawEntrySignHint = "auto" | "positive_purchase" | "negative_purchase";
export type RawEntryTypeHint = "purchase" | "refund" | "payment" | "charge";
export type RawEntrySourceKind =
  | "spatial_pdf"
  | "csv"
  | "ofx"
  | "spreadsheet"
  | "text"
  | "ai_row";

/**
 * Contrato único de entrada bruta emitida pelos extratores "burros" (Estágio 0/1).
 * Mantido em memória para re-normalização instantânea (< 2 ms) na troca de
 * competência ou troca de cartão em 1 clique sem rechamar IA (G2, G4, D17).
 */
export interface RawExtractedEntry {
  /** Índice explícito de origem no documento/IA — preserva alinhamento após descartes (G4). */
  sourceIndex: number;
  /** Data textual original extraída antes da resolução de ciclo (ex.: "15/12", "12 OUT", "2026-11-10"). */
  rawDate: string;
  /** Descrição do estabelecimento isolada sem data/valor/sufixo. */
  merchantRaw: string;
  /** Linha original completa do documento/extrato. */
  rawLine: string;
  /** Valor monetário absoluto em centavos (inteiro positivo). */
  amountCents: number;
  /** True quando o valor bruto veio com sinal negativo / parênteses. */
  isNegative: boolean;
  /** True quando o valor veio com sufixo explícito de crédito (`C` / `+`). */
  isCreditSuffix?: boolean;
  /** True quando o valor veio com sufixo explícito de débito (`D` / `-`). */
  isDebitSuffix?: boolean;
  /** Convenção de sinal herdada do extrator, blueprint ou OFX TRNTYPE. */
  signHint?: RawEntrySignHint;
  /** Tipo explícito informado por coluna D/C, OFX ou IA (`statement_pdf_rows`). */
  explicitEntryType?: RawEntryTypeHint;
  /** Parcelamento estruturado já informado pela origem (ex.: IA). */
  explicitInstallment?: { current: number; total: number } | null;
  /** Formato de data preferencial sugerido por blueprint/extrator. */
  dateFormatHint?: "dmy" | "d_mmm" | "ymd" | "auto";
  /** Identificador único bancário (FITID no OFX). */
  fitid?: string;
  /** Linhas subsequentes de detalhamento cambial (`fx_detail`). */
  fxDetails?: string[];
  /** Origem técnica do extrator que produziu esta entrada bruta. */
  sourceKind?: RawEntrySourceKind;
}

/**
 * Representação normalizada de uma transação extraída do extrato/fatura.
 */
export interface StatementTransaction {
  /** Identificador temporário para chave de UI (ex.: "stmt-0", "stmt-1"). */
  id: string;
  /** Índice sequencial na lista normalizada. */
  index: number;
  /** Índice original no array bruto/IA (previne desalinhamento após filtros — G4). */
  sourceIndex?: number;
  /** Índice ordinal para desambiguação de compras repetidas no mesmo dia (0-based). */
  occurrenceIndex: number;
  /** Data ISO efetiva da transação (YYYY-MM-DD), alinhada >= APP_START_DATE e D13. */
  date: string;
  /** Data original extraída do extrato antes de alinhamento D13 / APP_START_DATE. */
  originalDate?: string;
  /** Natureza canônica da transação. */
  nature?: StatementTransactionNature;
  /** Descrição bruta original do extrato. */
  rawDescription: string;
  /** Nome limpo do estabelecimento para UI e conciliação semântica. */
  cleanDescription: string;
  /** Texto isolado de estabelecimento sem data/valor para memória limpa (G14). */
  merchantCleanRaw?: string;
  /** Valor monetário absoluto em centavos (inteiro positivo). */
  amountCents: number;
  /** Indica se é crédito/estorno na fatura. */
  isRefund: boolean;
  /** Indica se é pagamento da fatura anterior. */
  isPayment: boolean;
  /** Informações de parcelamento detectadas na compra. */
  installment?: {
    current: number;
    total: number;
  };
  /** Hash determinístico ordinal anti-duplicação. */
  statementHash: string;
  /** Identificador único do banco (FITID no OFX, se disponível). */
  fitid?: string;
  /** Tipo de encargo inferido do extrato (juros, multa, IOF, tarifa bancária). */
  inferredChargeKind?: ChargeKind | null;
}

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
  /** ID do estorno já registrado em `card_payments` correspondente (quando houver match — G10). */
  matchedRefundId?: string;
  /** Descrição da despesa/estorno existente. */
  matchedExpenseDescription?: string;
  /** Data da despesa/estorno existente. */
  matchedExpenseDate?: string;
  /** Valor em centavos da despesa/estorno existente. */
  matchedExpenseValueCents?: number;
  /** Categoria sugerida preditivamente. */
  suggestedCategoryId: string;
  /** Categoria atualmente selecionada na UI. */
  selectedCategoryId: string;
  /** Se o item está marcado para ser aplicado/importado na confirmação final. */
  selected: boolean;
  /** True quando há sinal semântico positivo (texto, categoria, encargo ou parcela — G7). */
  hasStrongSemanticSignal?: boolean;
  /** True quando ocorrência repetida no mesmo dia foi confirmada pelo checksum oficial (G8). */
  repeatedSameDayConfirmed?: boolean;
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
  /** Análise dos 4 estados da série de parcelamento se for compra parcelada. */
  seriesAnalysis?: import("./series-detector").InstallmentSeriesAnalysis | null;
  /** Se o usuário optou por projetar parcelas futuras K+1..N para esta compra. */
  projectSeries?: boolean;
  /** Correspondência forte encontrada em competência vizinha (M-1 ou M+1). */
  crossCompetenceMatch?: CrossCompetenceMatch;
  /** Se o item foi vinculado a uma despesa existente com ajuste de valor pendente. */
  isLinkedAndAdjusted?: boolean;
  /** Diferença em centavos entre o extrato e a despesa vinculada no app. */
  pendingAdjustmentDifferenceCents?: number;
  /** Ação sugerida de conciliação para 1 clique na interface. */
  suggestedAction?:
    | "link_and_adjust_amount"
    | "import_and_project_series"
    | "import_single"
    | "link_existing";
}

/**
 * Despesa encontrada no mesmo cartão, porém lançada em competência vizinha (M-1 ou M+1).
 */
export interface CrossCompetenceMatch {
  expenseId: string;
  expenseDescription: string;
  expenseDate: string;
  expenseValueCents: number;
  currentBillCompetence: string;
  score: number;
  statementHash: string;
}

/**
 * Par de provável duplicidade já cadastrada no aplicativo.
 */
export interface AppDuplicateCandidate {
  id: string;
  keepExpense: ExistingExpenseForReconciliation;
  duplicateExpense: ExistingExpenseForReconciliation;
  keepIsMatchedOnStatement: boolean;
  reason: string;
}

export interface PendingLinkAdjustment {
  expenseId: string;
  originalValueCents: number;
  newValueCents: number;
  statementHash: string;
  description: string;
  differenceCents?: number;
}

export interface ReconciliationResult {
  items: ReconciliationItem[];
  unmatchedExistingExpenses: ExistingExpenseForReconciliation[];
  appDuplicates?: AppDuplicateCandidate[];
}

export interface ExistingExpenseForReconciliation {
  id: string;
  date: string;
  description: string;
  valueCents: number;
  categoryId: string;
  installmentNumber: number | null;
  installmentsTotal: number | null;
  statementHash?: string | null;
  chargeKind?: ChargeKind | null;
  scope?: "personal" | "business";
  billCompetence?: string;
  installmentGroupId?: string | null;
}

export interface ExistingRefundForReconciliation {
  id: string;
  date: string;
  amountCents: number;
  competenceMonth: string;
  note?: string | null;
  statementHash?: string | null;
}

export interface RawParsedRow {
  rowIndex: number;
  rawText: string;
  cells: string[];
}

export interface ColumnMapping {
  dateColIndex: number;
  descriptionColIndex: number;
  amountColIndex: number;
  typeColIndex?: number;
  debitColIndex?: number;
  creditColIndex?: number;
  hasHeader: boolean;
  startRowIndex: number;
  /** Índice real da linha de cabeçalho quando o CSV possui preâmbulo (D1). */
  headerRowIndex?: number;
}

/**
 * Plano estruturado de ações contábeis da revisão antes do commit atômico (D2, D9, D14).
 */
export interface PlannedExpenseToCreate {
  item: ReconciliationItem;
  date: string;
  valueCents: number;
  categoryId: string;
  description: string;
  installmentsTotal: number;
  installmentNumber: number;
  installmentGroupId: string | null;
  billCompetence: string;
  statementHash: string;
  chargeKind: string;
  scope: TransactionScope;
  isTaxDeductible: boolean;
}

export interface PlannedFutureInstallmentToProject {
  installmentNumber: number;
  installmentsTotal: number;
  date: string;
  billCompetence: string;
  valueCents: number;
  description: string;
  categoryId: string;
  installmentGroupId: string;
  statementHash: string;
  scope: TransactionScope;
  isTaxDeductible: boolean;
}

export interface PlannedRefundToRegister {
  item: ReconciliationItem;
  amountCents: number;
  date: string;
  note: string;
  competenceMonth: string;
  statementHash: string;
}

export interface ReconciliationPlanMicroAdjustment {
  expenseId: string;
  description: string;
  originalValueCents: number;
  newValueCents: number;
  differenceCents: number;
  statementHash: string;
  isAutoOptOut: boolean;
}

export interface ReconciliationPlanCompetenceMove {
  expenseId: string;
  description: string;
  fromCompetenceMonth: string;
  toCompetenceMonth: string;
  statementHash: string;
}

export interface ReconciliationPlan {
  cardId: string;
  competenceMonth: string;
  /** True quando fatura rolada bloqueia integralmente qualquer escrita (D14). */
  blockedByRollover: boolean;
  /** True quando fatura quitada bloqueia Bloco A/B/C (mantendo Bloco D/E permitidos — D14). */
  paidBillLocksRestricted: boolean;
  /** Bloco D (opt-out): novas compras/encargos da fatura. */
  newExpensesToCreate: PlannedExpenseToCreate[];
  /** Bloco D (opt-out): parcelas futuras K+1..N faltantes com installmentGroupId compartilhado. */
  futureInstallmentsToProject: PlannedFutureInstallmentToProject[];
  /** Bloco E (opt-out): estornos inéditos não conciliados contra card_payments. */
  refundsToRegister: PlannedRefundToRegister[];
  /** Bloco B (opt-out): microajustes <= R$ 0,05 com sinal semântico forte (desabilitado se quitada). */
  microAdjustmentsToApply: ReconciliationPlanMicroAdjustment[];
  /** Bloco B (opt-in): ajustes manuais aprovados pelo usuário (desabilitado se quitada). */
  manualLinkAdjustments: PendingLinkAdjustment[];
  /** Bloco C (opt-in): movimentações aprovadas de mês vizinho (desabilitado se origem/destino bloqueada). */
  competenceMovesToApply: ReconciliationPlanCompetenceMove[];
  /** Bloco A (opt-in): exclusões cirúrgicas por ID enfileiradas no staging (D9; desabilitado se quitada). */
  expenseIdsToDelete: string[];
  /** Total de ações que efetivamente serão enviadas no commit atômico. */
  totalActionCount: number;
  /** Contagem de itens pendentes de aprovação explícita (opt-in) na aba Atenção (UI D2). */
  pendingOptInCount: number;
}

export interface StatementCommitExpenseRow {
  date: string;
  value: number;
  category_id: string;
  description: string;
  installments_total?: number;
  installment_number?: number;
  installment_group_id?: string | null;
  bill_competence?: string;
  report_weight?: number;
  statement_hash?: string | null;
  charge_kind?: string;
  scope?: TransactionScope;
  is_tax_deductible?: boolean;
  is_projected?: boolean;
}

export interface StatementCommitLinkAdjustmentRow {
  expense_id: string;
  new_value: number;
  statement_hash?: string | null;
}

export interface StatementCommitCompetenceMoveRow {
  expense_id: string;
  target_competence: string;
  statement_hash?: string | null;
}

export interface StatementCommitRefundRow {
  amount: number;
  date: string;
  note?: string | null;
  competence_month?: string;
  statement_hash?: string | null;
}

export type BankTransactionKind = "expense" | "income" | "transfer_ignored" | "card_payment_ignored";

export interface ExistingIncomeForReconciliation {
  id: string;
  date: string;
  description: string;
  valueCents: number;
  receiveType?: string | null;
  statementHash?: string | null;
}

export interface BankTransactionItem {
  transaction: StatementTransaction;
  kind: BankTransactionKind;
  status: MatchStatus;
  score: number;
  matchedExpenseId?: string;
  matchedExpenseDescription?: string;
  matchedExpenseDate?: string;
  matchedExpenseValueCents?: number;
  matchedIncomeId?: string;
  matchedIncomeDescription?: string;
  matchedIncomeDate?: string;
  matchedIncomeValueCents?: number;
  suggestedCategoryId: string;
  selectedCategoryId: string;
  suggestedReceiveType?: string;
  selectedReceiveType?: string;
  selected: boolean;
  ignoredByDefault?: boolean;
  ignoreReason?: string;
  isInternalDuplicate?: boolean;
  duplicateReason?: string;
  scope?: "personal" | "business";
  isTaxDeductible?: boolean;
  nature?: StatementTransactionNature;
  suggestedAction?:
    | "link_and_adjust_amount"
    | "import_and_project_series"
    | "import_single"
    | "link_existing";
}

export interface BankReconciliationResult {
  items: BankTransactionItem[];
  unmatchedExistingExpenses: ExistingExpenseForReconciliation[];
  unmatchedExistingIncomes: ExistingIncomeForReconciliation[];
}

export type StatementIngestionErrorCode =
  | "encrypted_spreadsheet"
  | "encrypted_pdf"
  | "unsupported_archive"
  | "unsupported_spreadsheet_encryption"
  | "no_tabular_rows_found"
  | "mapping_failed"
  | "empty_file";

const STATEMENT_INGESTION_ERROR_MESSAGES: Record<StatementIngestionErrorCode, string> = {
  encrypted_spreadsheet:
    "Esta planilha está protegida por senha. Digite a senha para desbloquear e importar.",
  encrypted_pdf:
    "Esta fatura em PDF está protegida por senha. Digite a senha para desbloquear e importar.",
  unsupported_archive:
    "Formato compactado não suportado. Envie uma fatura em PDF, imagem, CSV, OFX ou planilha (.xlsx/.xlsm/.xls/.ods).",
  unsupported_spreadsheet_encryption:
    "Esta planilha usa uma criptografia legada não suportada no navegador. Remova a proteção ou exporte em PDF, CSV ou XLSX.",
  no_tabular_rows_found:
    "Não encontramos lançamentos válidos nesta planilha ou arquivo. Verifique se a aba correta contém compras ou tente exportar em PDF ou CSV.",
  mapping_failed:
    "Não foi possível identificar automaticamente as colunas de data, descrição e valor. Ajuste o mapeamento de colunas para continuar.",
  empty_file:
    "O arquivo enviado está vazio. Selecione uma fatura válida para importar.",
};

export function getStatementIngestionErrorMessage(code: StatementIngestionErrorCode): string {
  return STATEMENT_INGESTION_ERROR_MESSAGES[code];
}

export class StatementIngestionError extends Error {
  readonly code: StatementIngestionErrorCode;

  constructor(code: StatementIngestionErrorCode, message?: string) {
    super(message ?? getStatementIngestionErrorMessage(code));
    this.name = "StatementIngestionError";
    this.code = code;
  }
}

export function isStatementIngestionError(err: unknown): err is StatementIngestionError {
  if (!err || typeof err !== "object") return false;
  if (err instanceof StatementIngestionError) return true;
  const candidate = err as { name?: unknown; code?: unknown };
  return candidate.name === "StatementIngestionError" && typeof candidate.code === "string";
}
