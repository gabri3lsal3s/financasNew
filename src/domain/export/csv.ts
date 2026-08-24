/**
 * Serialização CSV — F22 (Central de Exportação).
 *
 * Decisão (registrada no ROADMAP F22): o padrão pt-BR de compatibilidade com
 * Excel usa **delimitador `;`** (campo) + **vírgula como separador decimal** +
 * **BOM UTF-8** — valores numéricos e caracteres acentuados abrem sem corrupção
 * em planilhas. Motor 100% puro — sem DOM/Supabase.
 */

const CSV_DELIMITER = ";";

/**
 * Sanitiza valores de texto para proteção contra CSV/Formula Injection (DDE).
 * Previne execução de comandos em planilhas iniciados por '=', '+', '-', '@', '\t' ou '\r'.
 */
export function sanitizeFormulaInjection(value: string): string {
  if (/^[-=+@\t\r]/.test(value)) {
    // Permite números legítimos com sinal (ex.: "-15,50" ou "+100")
    if (/^[-+]?\d+(?:[.,]\d+)?$/.test(value.trim())) {
      return value;
    }
    return `'${value}`;
  }
  return value;
}

/** Escapa um campo: sanitiza contra injeção e aplica aspas duplas quando necessário. */
export function escapeCsvField(value: string): string {
  const sanitized = sanitizeFormulaInjection(value);
  if (/[";\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/** Concatena um arquivo CSV com quebras de linha Windows (Excel-friendly). */
export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvField(String(cell))).join(CSV_DELIMITER));
  return lines.join("\r\n") + "\r\n";
}

/** Prefixa o BOM UTF-8 (Excel abre corretamente acentos sem "mojibake"). */
export function csvWithBom(csv: string): string {
  return `\uFEFF${csv}`;
}

/**
 * Formata centavos como moeda pt-BR (ex.: "1234,56") SEM separador de milhar.
 *
 * Decisão Excel (compatibilidade): valores com agrupamento ("1.234,56") são
 * interpretados como TEXTO em vários locais/versões — sem agrupamento o Excel
 * lê o número de verdade (soma/formatos funcionam). Acentos e "R$" seguem
 * via BOM UTF-8 + delimitador `;` (padrão pt-BR).
 */
export function formatCsvDecimal(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Formata um float com até `maxDecimals` casas, vírgula decimal (ex.: "0,5"). */
export function formatCsvFloat(value: number, maxDecimals = 2): string {
  const rounded = Number(value.toFixed(maxDecimals));
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: maxDecimals });
}

/** Formata data ISO (YYYY-MM-DD) como dd/mm/aaaa. */
export function formatCsvDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Serializadores de domínio (entradas em centavos — conversão nas bordas)
// ---------------------------------------------------------------------------

export interface ExportExpenseRow {
  date: string;
  description: string;
  categoryName: string;
  valueCents: number;
  /** Valor com peso de relatório aplicado (report_weight). */
  reportValueCents: number;
  paymentMethodLabel: string;
  cardName: string | null;
  /** Ex.: "1/3" ou "—" (à vista). */
  installments: string;
}

export interface ExportIncomeRow {
  date: string;
  description: string;
  categoryName: string;
  valueCents: number;
  reportValueCents: number;
  receiveTypeLabel: string;
}

export interface ExportInvoiceRow {
  competenceMonth: string;
  cardName: string;
  amountCents: number;
  date: string;
  note: string | null;
  /** true = estorno (is_refund). */
  isRefund: boolean;
}

export interface ExportCardInvoiceRow {
  date: string;
  description: string;
  categoryName: string;
  valueCents: number;
  /** Valor com peso de relatório aplicado (report_weight). */
  reportValueCents: number;
  /** Ex.: "2/3" ou "—" (à vista). */
  installments: string;
}

export interface ExportPositionRow {
  ticker: string;
  assetClass: string | null;
  currency: string;
  quantity: number;
  averageCost: number;
  priceBRL: number;
  valueBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  dividends?: number;
  totalReturnPnl?: number;
  totalReturnPct?: number | null;
  /** % do patrimônio (0–100). */
  pct: number;
}

const EXPENSE_HEADERS = [
  "Data",
  "Descrição",
  "Categoria",
  "Valor (R$)",
  "Valor p/ relatório (R$)",
  "Forma de pagamento",
  "Cartão",
  "Parcelas",
];

/** Extrato CSV de despesas (padrão pt-BR + BOM). */
export function serializeExpensesCsv(rows: readonly ExportExpenseRow[]): string {
  const data = rows.map((r) => [
    formatCsvDate(r.date),
    r.description,
    r.categoryName,
    formatCsvDecimal(r.valueCents),
    formatCsvDecimal(r.reportValueCents),
    r.paymentMethodLabel,
    r.cardName ?? "",
    r.installments,
  ]);
  return csvWithBom(toCsv(EXPENSE_HEADERS, data));
}

const INCOME_HEADERS = [
  "Data",
  "Descrição",
  "Categoria",
  "Valor (R$)",
  "Valor p/ relatório (R$)",
  "Forma de recebimento",
];

/** Extrato CSV de receitas (padrão pt-BR + BOM). */
export function serializeIncomesCsv(rows: readonly ExportIncomeRow[]): string {
  const data = rows.map((r) => [
    formatCsvDate(r.date),
    r.description,
    r.categoryName,
    formatCsvDecimal(r.valueCents),
    formatCsvDecimal(r.reportValueCents),
    r.receiveTypeLabel,
  ]);
  return csvWithBom(toCsv(INCOME_HEADERS, data));
}

const INVOICE_HEADERS = ["Competência", "Cartão", "Valor (R$)", "Data", "Nota", "Tipo"];

/** Extrato CSV de faturas/pagamentos de cartão (padrão pt-BR + BOM). */
export function serializeInvoicesCsv(rows: readonly ExportInvoiceRow[]): string {
  const data = rows.map((r) => [
    r.competenceMonth,
    r.cardName,
    formatCsvDecimal(r.amountCents),
    formatCsvDate(r.date),
    r.note ?? "",
    r.isRefund ? "Estorno" : "Pagamento",
  ]);
  return csvWithBom(toCsv(INVOICE_HEADERS, data));
}

const CARD_INVOICE_HEADERS = [
  "Data",
  "Descrição",
  "Categoria",
  "Valor (R$)",
  "Valor p/ relatório (R$)",
  "Parcelas",
];

/**
 * Fatura do cartão em CSV — apenas os GASTOS lançados no cartão da competência
 * (compara com a fatura do banco). Sem cartão/forma de pagamento por coluna:
 * são redundantes aqui (todos os itens são do mesmo cartão, no crédito).
 */
export function serializeCardInvoiceCsv(rows: readonly ExportCardInvoiceRow[]): string {
  const data = rows.map((r) => [
    formatCsvDate(r.date),
    r.description,
    r.categoryName,
    formatCsvDecimal(r.valueCents),
    formatCsvDecimal(r.reportValueCents),
    r.installments,
  ]);
  return csvWithBom(toCsv(CARD_INVOICE_HEADERS, data));
}

const POSITION_HEADERS = [
  "Ticker",
  "Classe",
  "Moeda",
  "Quantidade",
  "Preço médio (R$)",
  "Preço atual (R$)",
  "Valor (R$)",
  "Lucro/Prejuízo (R$)",
  "Proventos (R$)",
  "Rentabilidade %",
  "% do patrimônio",
];

/** Posições da carteira em CSV (padrão pt-BR + BOM). */
export function serializePositionsCsv(rows: readonly ExportPositionRow[]): string {
  const data = rows.map((r) => {
    const effectivePct = r.totalReturnPct !== undefined ? r.totalReturnPct : r.unrealizedPct;
    return [
      r.ticker,
      r.assetClass ?? "",
      r.currency,
      formatCsvFloat(r.quantity, 8),
      formatCsvDecimal(Math.round(r.averageCost * 100)),
      formatCsvDecimal(Math.round(r.priceBRL * 100)),
      formatCsvDecimal(Math.round(r.valueBRL * 100)),
      formatCsvDecimal(Math.round(r.unrealizedPnl * 100)),
      formatCsvDecimal(Math.round((r.dividends ?? 0) * 100)),
      effectivePct === null ? "" : formatCsvFloat(effectivePct, 2),
      formatCsvFloat(r.pct, 2),
    ];
  });
  return csvWithBom(toCsv(POSITION_HEADERS, data));
}
