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

const PAYMENT_KEYWORDS = [
  "pagamento de fatura",
  "pagto fatura",
  "pagamento efetuado",
  "pagamento recebido",
  "pgto fatura",
  "pagamento em conta",
  "saldo anterior",
  "total da fatura",
];

/**
 * Higieniza o texto da descrição do extrato, removendo prefixos de
 * adquirentes, cidades e múltiplos espaços em branco.
 */
export function cleanDescription(raw: string): string {
  if (!raw) return "";

  return raw
    .trim()
    .replace(PREFIX_REGEX, "")
    .replace(/\s*\(\d{1,2}\/\d{1,2}\)/g, "")
    .replace(/\s*\bPARC(?:ELA)?\s*\d{1,2}\s*(?:DE|\/)\s*\d{1,2}\b/gi, "")
    .replace(/\s*\b\d{1,2}\s*DE\s*\d{1,2}\b/gi, "")
    .replace(/\s*\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/\s*\b(?:parcelado\s+em\s+|em\s+)?\d{1,2}\s*(?:x|vezes)\b/gi, "")
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
  "pix recebido",
  "pix recebid",
  "ted recebida",
  "doc recebido",
  "credito em conta",
  "crédito em conta",
  "deposito",
  "depósito",
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
  "rendimento",
  "dividendos",
  "juros sobre capital",
  "jcp",
  "provento",
  "proventos",
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
  if (/\b(pix)\b/i.test(lower)) {
    return "pix";
  }
  if (/\b(ted|doc|transf|transferencia|transferência)\b/i.test(lower)) {
    return "ted";
  }
  if (/\b(rendimento|dividendo|dividendos|juros|jcp|provento|proventos)\b/i.test(lower)) {
    return "rendimento";
  }

  return "outros";
}

/**
 * Identifica se a linha representa um pagamento de fatura ou ajuste contábil
 * que não deve ser importado como despesa de compra regular.
 */
export function isPaymentOrSettlement(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw)) || isCreditCardPayment(raw);
}

