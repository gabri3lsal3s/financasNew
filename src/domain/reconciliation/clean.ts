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
    .replace(CITY_SUFFIX_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Identifica se a linha representa um pagamento de fatura ou ajuste contábil
 * que não deve ser importado como despesa de compra regular.
 */
export function isPaymentOrSettlement(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}
