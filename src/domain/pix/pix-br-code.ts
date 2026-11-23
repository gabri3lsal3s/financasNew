/**
 * Motor Puro de Geracao de Pix Copia e Cola (BR Code EMV QRCPS-MPM).
 * Conforme especificacao oficial do Banco Central do Brasil (BACEN)
 * e padrao internacional EMVCo QR Code Specification for Payment Systems.
 *
 * Motor 100% puro: sem dependencias de UI, React ou Supabase (AGENTS.md secao 3).
 */

import { isValidCPF } from "@/domain/validation/cpf";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export const DEFAULT_PIX_CITY = "BRASILIA";
export const DEFAULT_PIX_MERCHANT_NAME = "RECEBEDOR";

export interface PixSanitizedFieldResult {
  value: string;
  adjusted: boolean;
  usedFallback: boolean;
  reason: string | null;
}

export interface GeneratePixBrCodeOptions {
  /**
   * Chave Pix do recebedor (CPF, CNPJ, E-mail, Celular ou EVP/Aleatoria).
   * Obrigatoria. Sera normalizada automaticamente para o padrao BACEN.
   */
  pixKey: string;

  /**
   * Tipo explicito da chave Pix (opcional, para desambiguacao de celular sem +55).
   */
  keyType?: PixKeyType;

  /**
   * Nome do recebedor / beneficiario (Merchant Name - ID 59).
   * Obrigatorio. Sanitizado sem acentos, maximo 25 caracteres.
   */
  merchantName: string;

  /**
   * Cidade do recebedor / beneficiario (Merchant City - ID 60).
   * Obrigatoria. Sanitizada sem acentos, em maiusculas, maximo 15 caracteres.
   */
  merchantCity: string;

  /**
   * Valor da cobranca em centavos (Transaction Amount - ID 54).
   * Opcional. Se for inteiro positivo (ex.: 1500 para R$ 15,00),
   * sera formatado com 2 casas decimais ("15.00").
   * Se 0 ou undefined, o campo e omitido (valor em aberto).
   */
  amountCents?: number;

  /**
   * Identificador da transacao (TXID / Reference Label - ID 62.05).
   * Opcional. Se nao informado ou vazio, o padrao BACEN estatico adota "***".
   * Se fornecido, sanitizado para alfanumerico [a-zA-Z0-9], maximo 25 caracteres.
   */
  txId?: string;

  /**
   * Mensagem ou informacao adicional livre (infoAdicional - ID 26.02).
   * Opcional. Texto livre com ate 25 caracteres dentro do template 26.
   */
  infoAdicional?: string;

  /**
   * CEP do recebedor (Postal Code - ID 61).
   * Opcional. Ate 9 caracteres alfanumericos.
   */
  postalCode?: string;

  /**
   * Quando `true`, emite Tag 01 = "12" (QR Code de uso unico).
   * Quando omitido ou `false`, omite Tag 01 conforme Manual do BR Code do BACEN
   * para Pix Estatico reutilizavel (evita rejeicao de `010211` por bancos estritos).
   */
  oneTime?: boolean;
}

export interface DecodedPixBrCode {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents?: number;
  txId: string;
  infoAdicional?: string;
  postalCode?: string;
  pointOfInitiationMethod?: string;
  rawPayload: string;
  crc: string;
  isValidCrc: boolean;
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF8_LENIENT_DECODER = new TextDecoder("utf-8");

/**
 * Remove caracteres invisiveis (zero-width, BiDi, BOM) e caracteres de controle
 * frequentemente inseridos ao colar chaves Pix ou codigos de WhatsApp/Contatos.
 */
export function stripInvisiblePixChars(value: string, replaceNbspWithSpace = false): string {
  if (!value || typeof value !== "string") return "";

  const withoutZeroWidth = value.replace(
    /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g,
    "",
  );

  let result = "";
  for (let i = 0; i < withoutZeroWidth.length; i++) {
    const code = withoutZeroWidth.charCodeAt(i);
    if (code === 0x00a0) {
      if (replaceNbspWithSpace) result += " ";
      continue;
    }
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      if (replaceNbspWithSpace && (code === 0x09 || code === 0x0a || code === 0x0d)) {
        result += " ";
      }
      continue;
    }
    result += withoutZeroWidth[i]!;
  }

  return result;
}

/**
 * Extrai e valida os 10 ou 11 digitos locais brasileiros (DDD + numero),
 * tratando DDI +55/0055 e prefixo 0 de operadora (ex.: 011999998888, +55 (011) 99999-8888).
 */
export function extractBrazilianPhoneLocalDigits(raw: string): string | null {
  const cleaned = stripInvisiblePixChars(raw).trim();
  if (!cleaned) return null;

  let digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("0055") && digits.length >= 14) {
    digits = digits.slice(2);
  }

  let local: string | null = null;
  if (digits.startsWith("55")) {
    if (digits[2] === "0" && (digits.length === 13 || digits.length === 14)) {
      local = digits.slice(3);
    } else if (digits.length === 12 || digits.length === 13) {
      local = digits.slice(2);
    } else if (digits.length === 10 || digits.length === 11) {
      local = digits;
    }
  } else if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    local = digits.slice(1);
  } else if (digits.length === 10 || digits.length === 11) {
    local = digits;
  }

  if (!local || !/^\d{10,11}$/.test(local)) {
    return null;
  }

  const ddd = Number(local.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return null;
  }

  if (local.length === 11) {
    return local[2] === "9" ? local : null;
  }

  const firstLocal = Number(local[2]);
  return firstLocal >= 2 && firstLocal <= 9 ? local : null;
}

/**
 * Formata um campo no formato EMV TLV (Tag-Length-Value) usando tamanho em bytes UTF-8.
 * ID: 2 digitos.
 * Length: 2 digitos zero-padded indicando a quantidade de bytes UTF-8 do valor.
 * Value: conteudo textual do campo.
 */
export function formatEmvField(id: string, value: string): string {
  const normalizedId = id.padStart(2, "0");
  const byteLen = UTF8_ENCODER.encode(value).length;
  if (byteLen > 99) {
    throw new Error(`Campo EMV ${normalizedId} excede o limite maximo de 99 bytes.`);
  }
  const lengthStr = String(byteLen).padStart(2, "0");
  return `${normalizedId}${lengthStr}${value}`;
}

/**
 * Calcula o checksum CRC16-CCITT (polinomio 0x1021, seed 0xFFFF) sobre bytes UTF-8
 * conforme especificacao estrita do Banco Central do Brasil para BR Code.
 * O calculo e efetuado sobre o payload completo que encerra com "6304".
 */
export function calculatePixCrc16(payloadToSign: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  const bytes = UTF8_ENCODER.encode(payloadToSign);

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Remove acentos, caracteres diacriticos e restringe a caracteres ASCII seguros no EMV.
 */
export function sanitizeMerchantText(text: string, maxLength: number, uppercase = false): string {
  if (!text) return "";
  let clean = stripInvisiblePixChars(text, true)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/.,]+/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (uppercase) {
    clean = clean.toUpperCase();
  }

  return clean.slice(0, maxLength).trim();
}

const BRAZILIAN_UF_SUFFIX_REGEX =
  /[\s,\-/()]+(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s*\)?$/i;

/**
 * Corta texto em fronteira de palavra para evitar palavras quebradas no meio em tags EMV curtas.
 */
export function truncateAtWordBoundary(
  text: string,
  maxLength: number,
  minWordBoundaryLen: number,
): string {
  if (text.length <= maxLength) {
    return text;
  }
  const slice = text.slice(0, maxLength);
  if (text[maxLength] === " ") {
    return slice.trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= minWordBoundaryLen) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

/**
 * Sanitiza a cidade do recebedor (Tag 60 BACEN: ate 15 letras ASCII em maiusculas)
 * removendo sufixos de UF, acentos e digitos, cortando em fronteira de palavra e
 * aplicando fallback automatico resiliente quando vazia ou invalida.
 */
export function sanitizePixCity(
  rawCity?: string | null,
  fallback = DEFAULT_PIX_CITY,
): PixSanitizedFieldResult {
  const cleanFallbackRaw = stripInvisiblePixChars(fallback || DEFAULT_PIX_CITY, true)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const safeFallback =
    cleanFallbackRaw.replace(/[^A-Z]/g, "").length >= 2
      ? truncateAtWordBoundary(cleanFallbackRaw, 15, 5)
      : DEFAULT_PIX_CITY;

  const rawTrimmed = typeof rawCity === "string" ? stripInvisiblePixChars(rawCity, true).trim() : "";
  if (!rawTrimmed) {
    return {
      value: safeFallback,
      adjusted: false,
      usedFallback: true,
      reason: `Cidade não informada — usando padrão BACEN (${safeFallback}), aceito por todos os bancos.`,
    };
  }

  const withoutUf = rawTrimmed.replace(BRAZILIAN_UF_SUFFIX_REGEX, "").trim();
  const lettersOnly = withoutUf
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/.,()]+/g, " ")
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (lettersOnly.replace(/\s/g, "").length < 2) {
    return {
      value: safeFallback,
      adjusted: true,
      usedFallback: true,
      reason: `Cidade inválida para o padrão Pix — ajustada automaticamente para ${safeFallback}.`,
    };
  }

  const truncated = truncateAtWordBoundary(lettersOnly, 15, 5);
  const adjusted = truncated !== rawTrimmed.toUpperCase();

  return {
    value: truncated,
    adjusted,
    usedFallback: false,
    reason: adjusted
      ? `No código Pix será enviado como "${truncated}" (padrão BACEN: sem acentos/UF e até 15 letras).`
      : null,
  };
}

/**
 * Sanitiza o nome do recebedor (Tag 59 BACEN: ate 25 caracteres ASCII)
 * cortando em fronteira de palavra e aplicando fallback automatico quando vazio ou invalido.
 */
export function sanitizePixMerchantName(
  rawName?: string | null,
  fallback = DEFAULT_PIX_MERCHANT_NAME,
): PixSanitizedFieldResult {
  const cleanFallbackText = sanitizeMerchantText(fallback || DEFAULT_PIX_MERCHANT_NAME, 25);
  const safeFallback =
    cleanFallbackText.replace(/[^a-zA-Z0-9]/g, "").length >= 2
      ? cleanFallbackText
      : DEFAULT_PIX_MERCHANT_NAME;

  const rawTrimmed = typeof rawName === "string" ? stripInvisiblePixChars(rawName, true).trim() : "";
  if (!rawTrimmed) {
    return {
      value: safeFallback,
      adjusted: false,
      usedFallback: true,
      reason: `Nome não informado — usando "${safeFallback}" no código Pix (o banco confirma o titular real pela chave).`,
    };
  }

  const cleanFull = sanitizeMerchantText(rawTrimmed, 120);
  if (cleanFull.replace(/[^a-zA-Z0-9]/g, "").length < 2) {
    return {
      value: safeFallback,
      adjusted: true,
      usedFallback: true,
      reason: `Nome inválido para o padrão Pix — ajustado automaticamente para "${safeFallback}".`,
    };
  }

  const truncated = truncateAtWordBoundary(cleanFull, 25, 8);
  const adjusted = truncated !== rawTrimmed;

  return {
    value: truncated,
    adjusted,
    usedFallback: false,
    reason: adjusted
      ? `No código Pix será enviado como "${truncated}" (padrão BACEN: sem acentos e até 25 caracteres).`
      : null,
  };
}

/**
 * Sanitiza o TXID para padrao alfanumerico [a-zA-Z0-9] de 1 a 25 caracteres.
 * Se vazio ou nao informado, retorna o padrao BACEN estatico "***".
 */
export function sanitizeTxId(txId?: string): string {
  if (!txId) return "***";
  const clean = stripInvisiblePixChars(txId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
  return clean.length > 0 ? clean : "***";
}

/**
 * Detecta o tipo de chave Pix a partir do formato dos dados.
 */
export function detectPixKeyType(key: string): PixKeyType | "unknown" {
  const trimmed = stripInvisiblePixChars(key).trim();
  if (!trimmed) return "unknown";
  if (trimmed.includes("@")) return "email";
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return "random";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (
    trimmed.startsWith("+") ||
    trimmed.includes("(") ||
    digits.startsWith("0055") ||
    (digits.startsWith("0") && (digits.length === 11 || digits.length === 12) && extractBrazilianPhoneLocalDigits(trimmed) !== null) ||
    (digits.length === 11 && trimmed.includes("-") && !trimmed.includes(".")) ||
    (digits.length === 11 && /\s/.test(trimmed) && !trimmed.includes(".") && extractBrazilianPhoneLocalDigits(trimmed) !== null)
  ) {
    return "phone";
  }
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 14 && extractBrazilianPhoneLocalDigits(trimmed) !== null) {
    return "phone";
  }
  if (digits.length === 14 || trimmed.includes("/")) return "cnpj";
  if (digits.length === 11) {
    const looksLikeBrazilianMobile = extractBrazilianPhoneLocalDigits(trimmed) !== null;
    if (looksLikeBrazilianMobile && !isValidCPF(digits)) {
      return "phone";
    }
    return "cpf";
  }
  if (digits.length === 10 && extractBrazilianPhoneLocalDigits(trimmed) !== null) {
    return "phone";
  }

  return "unknown";
}

/**
 * Normaliza a chave Pix para o formato aceito pelo BACEN:
 * - CPF: 11 digitos numericos
 * - CNPJ: 14 digitos numericos
 * - Celular: formato E.164 (+55...)
 * - E-mail: minusculo e trim
 * - EVP/Aleatoria: UUID minusculo
 */
export function normalizePixKey(key: string, keyType?: PixKeyType): string {
  const trimmed = stripInvisiblePixChars(key).trim();
  const type = keyType ?? detectPixKeyType(trimmed);

  switch (type) {
    case "email":
      return trimmed.replace(/\s+/g, "").toLowerCase();
    case "random":
      return trimmed.replace(/\s+/g, "").toLowerCase();
    case "cpf":
      return trimmed.replace(/\D/g, "");
    case "cnpj":
      return trimmed.replace(/\D/g, "");
    case "phone": {
      const localDigits = extractBrazilianPhoneLocalDigits(trimmed);
      if (localDigits) {
        return `+55${localDigits}`;
      }
      const digits = trimmed.replace(/\D/g, "");
      return trimmed.startsWith("+") ? `+${digits}` : `+55${digits}`;
    }
    default:
      return trimmed;
  }
}

/**
 * Converte valor em centavos (inteiro) para formato decimal BACEN ("0.00").
 */
export function formatPixAmount(amountCents: number): string {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("Valor em centavos deve ser um numero inteiro nao-negativo.");
  }
  return (amountCents / 100).toFixed(2);
}

/**
 * Gera a string do Pix Copia e Cola / BR Code completa com CRC16 valido.
 */
export function generatePixBrCode(options: GeneratePixBrCodeOptions): string {
  if (!options || typeof options !== "object") {
    throw new Error("Opcoes de geracao Pix sao obrigatorias.");
  }

  // 1. Chave Pix
  if (!options.pixKey || typeof options.pixKey !== "string" || !stripInvisiblePixChars(options.pixKey).trim()) {
    throw new Error("Chave Pix e obrigatoria.");
  }
  const normalizedKey = normalizePixKey(options.pixKey, options.keyType);
  if (!normalizedKey) {
    throw new Error("Chave Pix invalida.");
  }
  if (UTF8_ENCODER.encode(normalizedKey).length > 77) {
    throw new Error("Chave Pix excede o limite de 77 caracteres do BACEN.");
  }

  // 2. Nome do recebedor (max 25 caracteres)
  if (!options.merchantName || typeof options.merchantName !== "string" || !sanitizeMerchantText(options.merchantName, 25)) {
    throw new Error("Nome do recebedor (merchantName) e obrigatorio.");
  }
  const cleanName = sanitizeMerchantText(options.merchantName, 25);

  // 3. Cidade do recebedor (max 15 caracteres, maiusculas)
  if (!options.merchantCity || typeof options.merchantCity !== "string" || !sanitizeMerchantText(options.merchantCity, 15, true)) {
    throw new Error("Cidade do recebedor (merchantCity) e obrigatoria.");
  }
  const cleanCity = sanitizeMerchantText(options.merchantCity, 15, true);

  // 4. Valor em centavos (opcional)
  let tag54 = "";
  if (options.amountCents !== undefined && options.amountCents !== null) {
    if (!Number.isInteger(options.amountCents) || options.amountCents < 0) {
      throw new Error("Valor em centavos deve ser um numero inteiro nao-negativo.");
    }
    if (options.amountCents > 0) {
      const amountStr = formatPixAmount(options.amountCents);
      tag54 = formatEmvField("54", amountStr);
    }
  }

  // 5. Montagem do Template 26 (Merchant Account Information)
  const sub00 = formatEmvField("00", "br.gov.bcb.pix");
  const sub01 = formatEmvField("01", normalizedKey);

  let sub02 = "";
  if (options.infoAdicional && typeof options.infoAdicional === "string" && options.infoAdicional.trim()) {
    // Espaco maximo permitido para o template 26 e 99 bytes UTF-8
    const fixed26Bytes = UTF8_ENCODER.encode(sub00).length + UTF8_ENCODER.encode(sub01).length;
    const maxSub02Len = Math.max(0, 99 - fixed26Bytes - 4);
    const cleanInfo = sanitizeMerchantText(options.infoAdicional, Math.min(25, maxSub02Len));
    if (cleanInfo) {
      sub02 = formatEmvField("02", cleanInfo);
    }
  }

  const template26Value = `${sub00}${sub01}${sub02}`;
  const tag26 = formatEmvField("26", template26Value);

  // 6. Demais campos fixos e opcionais
  const tag00 = formatEmvField("00", "01"); // Payload Format Indicator (000201)
  const tag01 = options.oneTime ? formatEmvField("01", "12") : ""; // BACEN Manual do BR Code: estático reutilizável omite Tag 01; uso único usa "12"
  const tag52 = formatEmvField("52", "0000"); // Merchant Category Code
  const tag53 = formatEmvField("53", "986"); // Transaction Currency (986 = BRL)
  const tag58 = formatEmvField("58", "BR"); // Country Code
  const tag59 = formatEmvField("59", cleanName); // Merchant Name
  const tag60 = formatEmvField("60", cleanCity); // Merchant City

  // Tag 61 (Postal Code opcional)
  let tag61 = "";
  if (options.postalCode && typeof options.postalCode === "string" && options.postalCode.trim()) {
    const cleanPostal = options.postalCode.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 9).trim();
    if (cleanPostal) {
      tag61 = formatEmvField("61", cleanPostal);
    }
  }

  // Tag 62 (Additional Data Field Template com txId)
  const finalTxId = sanitizeTxId(options.txId);
  const sub62_05 = formatEmvField("05", finalTxId);
  const tag62 = formatEmvField("62", sub62_05);

  // 7. Concatenacao para calculo do CRC16
  const payloadToSign = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag61}${tag62}6304`;
  const crc = calculatePixCrc16(payloadToSign);

  return `${payloadToSign}${crc}`;
}

/**
 * Deserializa um payload TLV em bytes UTF-8 de forma tolerante para exibicao/decodificacao.
 */
function parseRawTlv(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "string") return map;

  const bytes = UTF8_ENCODER.encode(raw);
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const t0 = bytes[offset]!;
    const t1 = bytes[offset + 1]!;
    const l0 = bytes[offset + 2]!;
    const l1 = bytes[offset + 3]!;
    if (
      t0 < 0x30 || t0 > 0x39 ||
      t1 < 0x30 || t1 > 0x39 ||
      l0 < 0x30 || l0 > 0x39 ||
      l1 < 0x30 || l1 > 0x39
    ) {
      break;
    }

    const tag = String.fromCharCode(t0, t1);
    const tagLen = (l0 - 0x30) * 10 + (l1 - 0x30);
    if (offset + 4 + tagLen > bytes.length) {
      break;
    }

    const value = UTF8_LENIENT_DECODER.decode(bytes.subarray(offset + 4, offset + 4 + tagLen));
    map.set(tag, value);
    offset += 4 + tagLen;
  }

  return map;
}

/**
 * Deserializa um payload TLV estrito em bytes UTF-8 do inicio ao fim sem sobras ou blocos invalidos.
 */
function parseStrictTlv(raw: string): Map<string, string> | null {
  if (!raw || typeof raw !== "string") return null;

  const bytes = UTF8_ENCODER.encode(raw);
  if (bytes.length < 4) return null;

  const map = new Map<string, string>();
  let offset = 0;

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) return null;

    const t0 = bytes[offset]!;
    const t1 = bytes[offset + 1]!;
    const l0 = bytes[offset + 2]!;
    const l1 = bytes[offset + 3]!;
    if (
      t0 < 0x30 || t0 > 0x39 ||
      t1 < 0x30 || t1 > 0x39 ||
      l0 < 0x30 || l0 > 0x39 ||
      l1 < 0x30 || l1 > 0x39
    ) {
      return null;
    }

    const tag = String.fromCharCode(t0, t1);
    const tagLen = (l0 - 0x30) * 10 + (l1 - 0x30);
    if (offset + 4 + tagLen > bytes.length) {
      return null;
    }

    try {
      const value = UTF8_DECODER.decode(bytes.subarray(offset + 4, offset + 4 + tagLen));
      map.set(tag, value);
    } catch {
      return null;
    }

    offset += 4 + tagLen;
  }

  return offset === bytes.length ? map : null;
}

/**
 * Valida a integridade sintatica completa (TLV UTF-8 + tags obrigatorias BACEN) e o CRC16 de um payload Pix.
 */
export function validatePixBrCode(payload: string): boolean {
  if (!payload || typeof payload !== "string") {
    return false;
  }

  const trimmed = stripInvisiblePixChars(payload).trim();
  if (trimmed.length < 30 || !trimmed.startsWith("000201")) {
    return false;
  }

  const tag63Index = trimmed.lastIndexOf("6304");
  if (tag63Index === -1 || tag63Index !== trimmed.length - 8) {
    return false;
  }

  const expectedCrc = trimmed.slice(tag63Index + 4).toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(expectedCrc)) {
    return false;
  }

  const payloadToSign = trimmed.slice(0, tag63Index + 4);
  if (calculatePixCrc16(payloadToSign) !== expectedCrc) {
    return false;
  }

  const root = parseStrictTlv(trimmed);
  if (!root) {
    return false;
  }

  if (root.get("00") !== "01") {
    return false;
  }

  const poi = root.get("01");
  if (poi !== undefined && poi !== "11" && poi !== "12") {
    return false;
  }

  const tag26Raw = root.get("26");
  if (!tag26Raw) {
    return false;
  }
  const tag26 = parseStrictTlv(tag26Raw);
  if (!tag26 || tag26.get("00")?.toLowerCase() !== "br.gov.bcb.pix") {
    return false;
  }

  const pixKey = tag26.get("01");
  const dynUrl = tag26.get("25");
  const pixKeyBytes = pixKey ? UTF8_ENCODER.encode(pixKey).length : 0;
  const hasValidKey = pixKeyBytes >= 1 && pixKeyBytes <= 77;
  const hasValidUrl = Boolean(dynUrl && dynUrl.trim().length > 0);
  if (!hasValidKey && !hasValidUrl) {
    return false;
  }

  if (!/^\d{4}$/.test(root.get("52") ?? "")) {
    return false;
  }
  if (root.get("53") !== "986") {
    return false;
  }

  const amount = root.get("54");
  if (amount !== undefined && (!/^\d+(?:\.\d{1,2})?$/.test(amount) || amount.length > 13)) {
    return false;
  }

  if (root.get("58")?.toUpperCase() !== "BR") {
    return false;
  }

  const merchantName = root.get("59");
  if (!merchantName || UTF8_ENCODER.encode(merchantName).length > 25) {
    return false;
  }

  const merchantCity = root.get("60");
  if (!merchantCity || UTF8_ENCODER.encode(merchantCity).length > 15) {
    return false;
  }

  const tag62Raw = root.get("62");
  if (tag62Raw !== undefined) {
    const tag62 = parseStrictTlv(tag62Raw);
    if (!tag62) {
      return false;
    }
    const txId = tag62.get("05");
    if (txId !== undefined && txId !== "***" && !/^[a-zA-Z0-9]{1,25}$/.test(txId)) {
      return false;
    }
  }

  return root.get("63")?.toUpperCase() === expectedCrc;
}

/**
 * Decodifica uma string Pix Copia e Cola / BR Code em estrutura legivel.
 */
export function decodePixBrCode(payload: string): DecodedPixBrCode | null {
  if (!payload || typeof payload !== "string") return null;

  const trimmed = stripInvisiblePixChars(payload).trim();
  const emvHeaderIndex = trimmed.indexOf("000201");
  if (emvHeaderIndex === -1) return null;

  const cleanPayload = trimmed.slice(emvHeaderIndex);
  const rootTags = parseRawTlv(cleanPayload);

  if (rootTags.get("00") !== "01" || !rootTags.has("26")) {
    return null;
  }

  const tag26Raw = rootTags.get("26") || "";
  const tag26Sub = parseRawTlv(tag26Raw);
  const pixKey = tag26Sub.get("01") || "";
  const infoAdicional = tag26Sub.get("02");

  const merchantName = rootTags.get("59") || "";
  const merchantCity = rootTags.get("60") || "";
  const postalCode = rootTags.get("61");

  let amountCents: number | undefined;
  const rawAmount = rootTags.get("54");
  if (rawAmount) {
    const parsedFloat = parseFloat(rawAmount);
    if (!isNaN(parsedFloat) && parsedFloat >= 0) {
      amountCents = Math.round(parsedFloat * 100);
    }
  }

  const tag62Raw = rootTags.get("62") || "";
  const tag62Sub = parseRawTlv(tag62Raw);
  const txId = tag62Sub.get("05") || "***";

  const rawCrc = rootTags.get("63") || "";
  const isValidCrc = validatePixBrCode(cleanPayload);

  return {
    pixKey,
    merchantName,
    merchantCity,
    amountCents,
    txId,
    infoAdicional,
    postalCode,
    pointOfInitiationMethod: rootTags.get("01"),
    rawPayload: cleanPayload,
    crc: rawCrc,
    isValidCrc,
  };
}
