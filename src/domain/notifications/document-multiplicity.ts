/**
 * Classificador puro de multiplicidade documental para separar comprovantes únicos
 * (incluindo cupons fiscais com vários itens) de extratos bancários e faturas de cartão.
 */

export type DocumentMultiplicity = "single_receipt" | "multi_statement" | "unknown";

export interface DocumentMultiplicityAnalysis {
  multiplicity: DocumentMultiplicity;
  datedTransactionLines: number;
  hasStatementHeader: boolean;
  hasSingleReceiptSignature: boolean;
}

const SINGLE_FISCAL_RECEIPT_REGEX =
  /\b(?:danfe\s+nfc-e|nota\s+fiscal\s+de\s+consumidor|cupom\s+fiscal|extrato\s+no\.?\s*\d+\s+do\s+sat|chave\s+de\s+acesso)\b/i;

const SINGLE_RECEIPT_MARKER_REGEX =
  /\b(?:comprovante\s+(?:de\s+)?(?:pagamento|transfer[êe]ncia|envio|recebimento|agendamento|pix|ted|doc|boleto)|recibo\s+de\s+pagamento|pagamento\s+(?:d[eo]\s+)?fatura\s+(?:do\s+)?cart[ãa]o|via\s+(?:do\s+)?(?:cliente|consumidor)|endtoendid|autentica[çc][ãa]o(?:\s+mec[âa]nica)?)\b/i;

const STATEMENT_HEADER_REGEX =
  /\b(?:extrato(?:\s+(?:banc[áa]rio|de\s+conta|mensal|do\s+per[íi]odo|consolidado|financeiro))?|fatura\s+do\s+cart[ãa]o|lan[çc]amentos(?:\s+(?:na\s+fatura|do\s+m[êe]s|futuros))?|detalhamento\s+d[ae]\s+fatura|movimenta[çc][ãa]o\s+do\s+per[íi]odo|hist[óo]rico\s+de\s+lan[çc]amentos|resumo\s+das?\s+movimenta[çc][õo]es)\b/i;

const DATE_ON_LINE_REGEX =
  /\b(?:\d{2}[/.-]\d{2}(?:[/.-]\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*)\b/i;

const AMOUNT_ON_LINE_REGEX =
  /(?:(?:R\$|BRL)\s*)?-?\s*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|(?:R\$|BRL)\s*-?\s*\d+\.\d{2})\b/i;

const NON_TRANSACTION_SUMMARY_LINE_REGEX =
  /\b(?:vencimento|emiss[ãa]o|fechamento|saldo\s+(?:anterior|atual|final|dispon[íi]vel|restante)|total\s+(?:da\s+fatura|geral|a\s+pagar)|pagamento\s+(?:efetuado\s+em|m[íi]nimo)|data\s+(?:do\s+pagamento|da\s+opera[çc][ãa]o|da\s+transfer[êe]ncia|de\s+autoriza[çc][ãa]o)|realizado\s+em|protocolo\s+de\s+autoriza[çc][ãa]o|valor\s+data)\b/i;

/**
 * Analisa estruturalmente um texto de PDF/OCR para identificar se representa
 * um comprovante único, um extrato/fatura multi-lançamento ou texto indeterminado.
 */
export function analyzeDocumentMultiplicity(rawText: string): DocumentMultiplicityAnalysis {
  if (!rawText || typeof rawText !== "string") {
    return {
      multiplicity: "unknown",
      datedTransactionLines: 0,
      hasStatementHeader: false,
      hasSingleReceiptSignature: false,
    };
  }

  const trimmed = rawText.trim();
  if (trimmed.length < 15) {
    return {
      multiplicity: "unknown",
      datedTransactionLines: 0,
      hasStatementHeader: false,
      hasSingleReceiptSignature: false,
    };
  }

  const hasSingleReceiptSignature =
    SINGLE_FISCAL_RECEIPT_REGEX.test(trimmed) || SINGLE_RECEIPT_MARKER_REGEX.test(trimmed);

  // Cupons fiscais contêm várias linhas de itens (às vezes com códigos que lembram datas); nunca são extratos.
  if (SINGLE_FISCAL_RECEIPT_REGEX.test(trimmed)) {
    return {
      multiplicity: "single_receipt",
      datedTransactionLines: 0,
      hasStatementHeader: false,
      hasSingleReceiptSignature: true,
    };
  }

  const hasStatementHeader = STATEMENT_HEADER_REGEX.test(trimmed);

  const lines = trimmed
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let datedTransactionLines = 0;
  for (const line of lines) {
    if (line.length < 8) continue;
    if (NON_TRANSACTION_SUMMARY_LINE_REGEX.test(line)) continue;
    if (DATE_ON_LINE_REGEX.test(line) && AMOUNT_ON_LINE_REGEX.test(line)) {
      datedTransactionLines++;
    }
  }

  if (datedTransactionLines >= 3 || (hasStatementHeader && datedTransactionLines >= 2)) {
    return {
      multiplicity: "multi_statement",
      datedTransactionLines,
      hasStatementHeader,
      hasSingleReceiptSignature,
    };
  }

  if (hasSingleReceiptSignature || AMOUNT_ON_LINE_REGEX.test(trimmed)) {
    return {
      multiplicity: "single_receipt",
      datedTransactionLines,
      hasStatementHeader,
      hasSingleReceiptSignature,
    };
  }

  return {
    multiplicity: "unknown",
    datedTransactionLines,
    hasStatementHeader,
    hasSingleReceiptSignature,
  };
}

/**
 * Classifica diretamente um documento em `single_receipt`, `multi_statement` ou `unknown`.
 */
export function detectDocumentMultiplicity(rawText: string): DocumentMultiplicity {
  return analyzeDocumentMultiplicity(rawText).multiplicity;
}
