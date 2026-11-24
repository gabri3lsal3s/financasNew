/**
 * Módulo de higienização de descrições bancárias.
 *
 * Remove prefixos de adquirentes (PAG*, MP*, IFOOD*, UBER*, etc.),
 * marcadores de parcelas e sufixos de localização geográfica para isolar
 * o nome real do estabelecimento e melhorar o matching semântico.
 */

const ADQUIRER_NAMES = [
  "PAG",
  "MP",
  "MERCADOPAGO",
  "PAYPAL",
  "IFOOD",
  "UBER",
  "99APP",
  "DL",
  "GOOGLE",
  "AMZN",
  "AMAZON",
  "IOF",
  "RECARGA",
  "EBN",
  "HOTMART",
  "APPLE\\.COM",
  "SHOPEE",
];

const PREFIX_REGEX = new RegExp(`^(${ADQUIRER_NAMES.join("|")})\\s*\\*\\s*`, "i");

const CITY_SUFFIX_REGEX =
  /\s*-\s*(BR|SAO PAULO|RIO DE JANEIRO|CURITIBA|BELO HORIZONTE|PORTO ALEGRE|RECIFE|SALVADOR|FORTALEZA|BRASILIA|GOIANIA|CAMPINAS|BRASIL)\b.*$/i;

/**
 * 1. UNCONDITIONAL_INVOICE_PAYMENT_PATTERNS
 * Termos inequívocos de liquidação/pagamento de fatura pelo titular.
 * Acionados independentemente do sinal da transação.
 */
export const UNCONDITIONAL_INVOICE_PAYMENT_PATTERNS: RegExp[] = [
  /\bpag(?:amento)?\s+(?:de\s+)?nominais\b/i,
  /\bpagto\s+tit(?:ulo)?\s+nominal\b/i,
  /\bpag(?:amento)?\s*(?:de\s+|da\s+)?fatura\b/i,
  /\bpgto\s*fatura\b/i,
  /\bpagamento\s+efetuado\b/i,
  /\bpagamento\s+recebido\b/i,
  /\bdeb(?:ito)?\s+aut(?:omatico)?\s+cart[aã]o\b/i,
  /\bdebito\s+automatico\s+fatura\b/i,
  /\bpg\s+fatura\b/i,
  /\bpgto\s+cartao\b/i,
  /\bpagamento\s+cartao\b/i,
  /\bsaldo\s+anterior\b/i,
  /\btotal\s+da\s+fatura\b/i,
];

/**
 * 2. CREDIT_ONLY_SETTLEMENT_PATTERNS
 * Termos ambíguos de liquidação/compensação que só caracterizam quitação de fatura
 * quando acompanhados de crédito (isCredit === true / sinal positivo de entrada).
 * Se forem débitos regulares (isCredit === false), tratam-se de boletos pagos no cartão (compra/purchase).
 */
export const CREDIT_ONLY_SETTLEMENT_PATTERNS: RegExp[] = [
  /\bficha\s+de\s+compensa[çc][aã]o\b/i,
  /\bpgto\s+ficha\s+compensa[çc][aã]o\b/i,
  /\bliquida[çc][aã]o\s+de\s+t[ií]tulo\b/i,
  /\bpagamento\s+de\s+t[ií]tulo\b/i,
  /\bpagto\s+t[ií]tulo\b/i,
  /\bpagamento\s+de\s+cobran[çc]a\b/i,
];

const PAYMENT_KEYWORDS = [
  "pagamento de fatura",
  "pagto fatura",
  "pagamento efetuado",
  "pagamento recebido",
  "pgto fatura",
  "pagamento em conta",
  "saldo anterior",
  "total da fatura",
  "pagamento de nominais",
  "pagto tit nominal",
  "deb aut cartao",
  "debito automatico fatura",
];

const BANK_OPERATION_PREFIX_REGEX =
  /^(?:PIX\s+(?:TRANSF(?:ERENCIA)?|ENVIAD[OA]|RECEBID[OA])|TED\s+(?:ENVIAD[OA]|RECEBID[OA]|TRANSF)|DOC\s+(?:ENVIAD[OA]|RECEBID[OA])|COMPRA\s+(?:NO\s+D[EÉ]BITO|NO\s+CR[EÉ]DITO|A\s+VISTA|CART[AÃ]O|PARCELADA)|PAGTO\s+(?:ELETRON\s+)?COBRANCA)\s*[-:]?\s*/i;

/**
 * Higieniza o texto da descrição do extrato, removendo prefixos de
 * adquirentes, operações bancárias padrão, cidades e múltiplos espaços em branco.
 */
export function cleanDescription(raw: string): string {
  if (!raw) return "";

  let cleaned = raw.trim();

  // Remove prefixos de operações bancárias apenas se houver conteúdo descritivo restante relevante (não apenas dígitos ou vazio)
  const afterBankPrefix = cleaned.replace(BANK_OPERATION_PREFIX_REGEX, "");
  if (afterBankPrefix.trim().length >= 3 && !/^\d+$/.test(afterBankPrefix.trim())) {
    cleaned = afterBankPrefix;
  }

  return cleaned
    .replace(PREFIX_REGEX, "")
    .replace(/\s*\(\d{1,2}\/\d{1,2}\)/g, "")
    .replace(/\s*\bPARC(?:ELA)?\s*\d{1,2}\s*(?:DE|\/)\s*\d{1,2}\b/gi, "")
    .replace(/\s*\b\d{1,2}\s*DE\s*\d{1,2}\b/gi, "")
    .replace(/\s*\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/\s*\b(?:parcelado\s+em\s+|em\s+)?\d{1,2}\s*(?:x|vezes)\b/gi, "")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\b(?:POS|TERM|TERM\.|NSU|DOC|AUT|AUT\.)\s*[:.-]?\s*\d{3,10}\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
    .replace(CITY_SUFFIX_REGEX, "")
    .replace(/\s+(?:por|de|em|no|na)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}


const CC_PAYMENT_KEYWORDS = [
  "pagamento de fatura",
  "pagto fatura",
  "pgto fatura",
  "pagamento fatura",
  "pagamento efetuado",
  "pagamento cartao",
  "pagto cartao",
  "pgto cartao",
  "deb aut cartao",
  "debito automatico fatura",
  "fatura nubank",
  "fatura itau",
  "fatura bradesco",
  "fatura santander",
  "fatura inter",
  "fatura c6",
  "fatura bb",
  "fatura banco do brasil",
  "pg fatura",
];

const INVESTMENT_OR_TRANSFER_KEYWORDS = [
  "aplicacao cdb",
  "aplic cdb",
  "resgate cdb",
  "aplicacao lci",
  "resgate lci",
  "aplicacao lca",
  "resgate lca",
  "aplicacao fundo",
  "resgate fundo",
  "aplicacao rdb",
  "resgate rdb",
  "resgate poupanca",
  "aplicacao poupanca",
  "investimento",
  "transf mesma titularidade",
  "ted mesma titularidade",
  "pix mesma titularidade",
  "xp investimentos",
  "btg pactual",
  "clear corretora",
  "rico investimentos",
  "nu invest",
  "inter dtvm",
  "transferencia entre contas",
  "saldo anterior",
  "total da fatura",
];

const INFLOW_KEYWORDS = [
  // Movimentos bancários padrão
  "pix recebido",
  "pix recebid",
  "recebimento pix",
  "ted recebida",
  "ted recebido",
  "doc recebido",
  "transferencia recebida",
  "transferência recebida",
  "credito em conta",
  "crédito em conta",
  "crédito recebido",
  "creditado",
  "deposito",
  "depósito",
  // Remuneração / trabalho
  "salario",
  "salário",
  "folha de pagto",
  "folha pagto",
  "folha de pagamento",
  "pro-labore",
  "pro labore",
  "remuneracao",
  "remuneração",
  "holerite",
  // Rendimentos financeiros
  "rendimento",
  "dividendos",
  "juros sobre capital",
  "jcp",
  "provento",
  "proventos",
  // Frases de linguagem natural (Quick-Paste)
  "recebi",
  "recebi de",
  "recebi via",
  "recebimento",
  "recebimento de",
  "ganhei",
  "entrou",
  "renda de",
  "pagamento recebido",
  "pagamento recebido de",
];

/**
 * Identifica se o lançamento de conta corrente é caracterizado como entrada/receita
 * a partir de padrões textuais bancários conhecidos.
 */
export function isLikelyIncomeDescription(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return INFLOW_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Identifica se o lançamento de conta corrente é pagamento de fatura de cartão.
 * Previne double-counting das despesas já lançadas no cartão.
 */
export function isCreditCardPayment(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return CC_PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Identifica transferências de mesma titularidade, aportes ou resgates de investimentos.
 * Previne distorções na taxa de poupança e renda mensal.
 */
export function isInternalTransferOrInvestment(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return INVESTMENT_OR_TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
}

const REFUND_KEYWORDS = [
  "estorno",
  "devolucao",
  "devolução",
  "reembolso",
  "devolucao pix",
  "pix devolvido",
  "estorno debito",
  "estorno compra",
];

/**
 * Identifica devoluções ou estornos em conta corrente.
 */
export function isRefundOrReturn(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return REFUND_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Deduz o tipo de recebimento provável para receitas (PIX, TED, Salário, etc.).
 */
export function inferReceiveTypeFromDescription(raw: string): string {
  const lower = raw.trim().toLowerCase();

  if (/\b(salario|salário|folha|pro-labore|pro labore|remuneracao|remuneração|holerite)\b/i.test(lower)) {
    return "salario";
  }
  if (/\b(pix|pix recebido|recebimento pix)\b/i.test(lower)) {
    return "pix";
  }
  if (/\b(ted|doc|transf|transferencia|transferência|transferencia recebida|transferência recebida)\b/i.test(lower)) {
    return "ted";
  }
  if (/\b(rendimento|dividendo|dividendos|juros|jcp|provento|proventos)\b/i.test(lower)) {
    return "rendimento";
  }

  return "outros";
}

/**
 * Determina se a linha representa pagamento de fatura do titular.
 * - Padrões incondicionais são sempre pagamento de fatura (ex.: "PAGAMENTO DE NOMINAIS", "PGTO FATURA").
 * - Padrões de liquidação ambíguos só são pagamento se isCredit for true (ficha de compensação com crédito).
 * - Boletos pagos no cartão (débito, ex.: PAGTO TITULO ENEL, RECARGAPAY*CONTA) permanecem como compras normais.
 */
export function isInvoicePayment(raw: string, isCredit = false): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (UNCONDITIONAL_INVOICE_PAYMENT_PATTERNS.some((re) => re.test(trimmed))) {
    return true;
  }
  if (isCredit && CREDIT_ONLY_SETTLEMENT_PATTERNS.some((re) => re.test(trimmed))) {
    return true;
  }
  return false;
}

/**
 * Identifica se a linha representa um pagamento de fatura ou ajuste contábil
 * que não deve ser importado como despesa de compra regular.
 */
export function isPaymentOrSettlement(raw: string, isCredit = false): boolean {
  if (!raw) return false;
  if (isInvoicePayment(raw, isCredit)) {
    return true;
  }
  const lower = raw.trim().toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw)) || isCreditCardPayment(raw);
}

const SUBCARD_HEADER_REGEX =
  /^(?:cart[aã]o\s+(?:adicional|titular|final\s+\d{4})|final\s+\d{4}\s*-\s*[a-z\s]+|lan[çc]amentos\s+do\s+cart[aã]o)\b/i;

export function isSubcardHeader(text: string): boolean {
  if (!text) return false;
  return SUBCARD_HEADER_REGEX.test(text.trim());
}

const FX_DETAIL_REGEX =
  /\b(?:cota[çc][aã]o\s+(?:do\s+d[oó]lar|usd)|taxa\s+de\s+convers[aã]o|valor\s+em\s+d[oó]lar|d[oó]lar\s*:\s*r?\$?\s*\d+[.,]\d+|convers[aã]o\s+de\s+moeda)\b/i;

export function isFxDetail(text: string): boolean {
  if (!text) return false;
  return FX_DETAIL_REGEX.test(text.trim());
}

/**
 * Atribui uma das 6 naturezas canônicas a um lançamento de fatura.
 */
export function classifyTransactionNature(params: {
  rawDescription: string;
  isCredit: boolean;
  isPayment: boolean;
  isRefund: boolean;
  hasChargeKind?: boolean;
}): import("./types").StatementTransactionNature {
  const { rawDescription, isPayment, isRefund, hasChargeKind } = params;
  if (isPayment) return "invoice_payment";
  if (isRefund) return "refund";
  if (hasChargeKind) return "fee_or_tax";
  if (isSubcardHeader(rawDescription)) return "subcard_header";
  if (isFxDetail(rawDescription)) return "fx_detail";
  return "purchase";
}

const STATEMENT_SUMMARY_OR_NOISE_KEYWORDS = [
  "saldo anterior",
  "saldo do dia",
  "saldo atual",
  "saldo final",
  "saldo disponivel",
  "saldo disponível",
  "saldo bloqueado",
  "saldo credor",
  "saldo devedor",
  "saldo em conta",
  "saldo inicial",
  "saldo do periodo",
  "saldo do período",
  "total da fatura",
  "valor total da fatura",
  "total do periodo",
  "total do período",
  "total geral",
  "total de debitos",
  "total de débitos",
  "total debitos",
  "total débitos",
  "total de creditos",
  "total de créditos",
  "total creditos",
  "total créditos",
  "total de entradas",
  "total de saidas",
  "total de saídas",
  "total de lancamentos",
  "total de lançamentos",
  "subtotal",
  "pagamento minimo",
  "pagamento mínimo",
  "pagto minimo",
  "pagto mínimo",
  "encargos e iof",
  "limite total",
  "limite disponivel",
  "limite disponível",
  "fatura anterior",
  "resumo da fatura",
  "demonstrativo",
  "valor total desta fatura",
  "custo efetivo total",
  "opcoes de parcelamento",
  "opções de parcelamento",
  "parcelamento da fatura",
  "parcelamento automatico",
  "parcelamento automático",
  "juros do rotativo",
  "credito rotativo",
  "crédito rotativo",
];

const METADATA_NOISE_REGEX =
  /^(?:extrato\b|comprovante\b|p[aá]gina\s+\d+|ag[eê]ncia\b|agencia\b|conta\s*:\s*[\d-]+|per[ií]odo\b|periodo\b|cnpj\b|cpf\b|impresso\s+em|emitido\s+em|gerado\s+em|relat[oó]rio\b|relatorio\b|banco\b|transa[çc][oõ]es\s+sujeitas|informa[çc][oõ]es\s+de\s+uso|central\s+de\s+atendimento|sac\b|ouvidoria\b)\b/i;

const RATE_OR_BARCODE_NOISE_REGEX =
  /(?:\b\d+[.,]\d+\s*%\s*a\.[ma]\b|\bcet\s+\d+[.,]\d+\s*%|^(?:[\d.\s-]{44,65})$)/i;

const DIVIDER_LINE_REGEX = /^[-–—=_*.#\s]{3,}$/;

/**
 * Identifica se uma linha de texto ou descrição representa ruído de extrato,
 * linhas de cabeçalho/rodapé de relatório ou somatórios/saldos contábeis.
 */
export function isStatementNoiseOrSummary(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (DIVIDER_LINE_REGEX.test(trimmed)) return true;
  if (METADATA_NOISE_REGEX.test(trimmed)) return true;
  if (RATE_OR_BARCODE_NOISE_REGEX.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  return STATEMENT_SUMMARY_OR_NOISE_KEYWORDS.some((kw) => lower.includes(kw));
}

