/**
 * Motor Puro de Geracao de Pix Copia e Cola (BR Code EMV QRCPS-MPM).
 * Conforme especificacao oficial do Banco Central do Brasil (BACEN)
 * e padrao internacional EMVCo QR Code Specification for Payment Systems.
 *
 * Motor 100% puro: sem dependencias de UI, React ou Supabase (AGENTS.md secao 3).
 */

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

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

/**
 * Formata um campo no formato EMV TLV (Tag-Length-Value).
 * ID: 2 digitos.
 * Length: 2 digitos zero-padded indicando a quantidade de caracteres do valor.
 * Value: conteudo textual do campo.
 */
export function formatEmvField(id: string, value: string): string {
  const normalizedId = id.padStart(2, "0");
  const lengthStr = String(value.length).padStart(2, "0");
  return `${normalizedId}${lengthStr}${value}`;
}

/**
 * Calcula o checksum CRC16-CCITT (polinomio 0x1021, seed 0xFFFF)
 * conforme especificacao estrita do Banco Central do Brasil para BR Code.
 * O calculo e efetuado sobre a string completa que encerra com "6304".
 */
export function calculatePixCrc16(payloadToSign: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payloadToSign.length; i++) {
    crc ^= payloadToSign.charCodeAt(i) << 8;
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
 * Remove acentos, caracteres diacriticos e restringe a caracteres permitidos no EMV.
 */
export function sanitizeMerchantText(text: string, maxLength: number, uppercase = false): string {
  if (!text) return "";
  let clean = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s.,\-_/]/g, "")
    .trim();

  if (uppercase) {
    clean = clean.toUpperCase();
  }

  return clean.slice(0, maxLength).trim();
}

/**
 * Sanitiza o TXID para padrao alfanumerico [a-zA-Z0-9] de 1 a 25 caracteres.
 * Se vazio ou nao informado, retorna o padrao BACEN estatico "***".
 */
export function sanitizeTxId(txId?: string): string {
  if (!txId) return "***";
  const clean = txId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
  return clean.length > 0 ? clean : "***";
}

/**
 * Detecta o tipo de chave Pix a partir do formato dos dados.
 */
export function detectPixKeyType(key: string): PixKeyType | "unknown" {
  const trimmed = key.trim();
  if (trimmed.includes("@")) return "email";
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return "random";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") || trimmed.includes("(") || (digits.length === 11 && trimmed.includes("-") && !trimmed.includes("."))) {
    return "phone";
  }
  if (digits.length === 14 || trimmed.includes("/")) return "cnpj";
  if (digits.length === 11) return "cpf";
  if (digits.length >= 10 && digits.length <= 13 && trimmed.startsWith("+")) return "phone";

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
  const trimmed = key.trim();
  const type = keyType ?? detectPixKeyType(trimmed);

  switch (type) {
    case "email":
      return trimmed.toLowerCase();
    case "random":
      return trimmed.toLowerCase();
    case "cpf":
      return trimmed.replace(/\D/g, "");
    case "cnpj":
      return trimmed.replace(/\D/g, "");
    case "phone": {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return `+${digits}`;
      }
      if (digits.length === 10 || digits.length === 11) {
        return `+55${digits}`;
      }
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
  if (!options.pixKey || typeof options.pixKey !== "string" || !options.pixKey.trim()) {
    throw new Error("Chave Pix e obrigatoria.");
  }
  const normalizedKey = normalizePixKey(options.pixKey, options.keyType);
  if (!normalizedKey) {
    throw new Error("Chave Pix invalida.");
  }

  // 2. Nome do recebedor (max 25 caracteres)
  if (!options.merchantName || typeof options.merchantName !== "string" || !options.merchantName.trim()) {
    throw new Error("Nome do recebedor (merchantName) e obrigatorio.");
  }
  const cleanName = sanitizeMerchantText(options.merchantName, 25);
  if (!cleanName) {
    throw new Error("Nome do recebedor contem apenas caracteres invalidos.");
  }

  // 3. Cidade do recebedor (max 15 caracteres, maiusculas)
  if (!options.merchantCity || typeof options.merchantCity !== "string" || !options.merchantCity.trim()) {
    throw new Error("Cidade do recebedor (merchantCity) e obrigatoria.");
  }
  const cleanCity = sanitizeMerchantText(options.merchantCity, 15, true);
  if (!cleanCity) {
    throw new Error("Cidade do recebedor contem apenas caracteres invalidos.");
  }

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
    // Espaco maximo permitido para o template 26 e 99 caracteres
    const maxSub02Len = Math.max(0, 99 - sub00.length - sub01.length - 4);
    const cleanInfo = sanitizeMerchantText(options.infoAdicional, Math.min(25, maxSub02Len));
    if (cleanInfo) {
      sub02 = formatEmvField("02", cleanInfo);
    }
  }

  const template26Value = `${sub00}${sub01}${sub02}`;
  const tag26 = formatEmvField("26", template26Value);

  // 6. Demais campos fixos e opcionais
  const tag00 = formatEmvField("00", "01"); // Payload Format Indicator (000201)
  const tag01 = formatEmvField("01", "11"); // Point of Initiation Method: 11 = QR Estático / Reutilizável (010211)
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
 * Deserializa um payload TLV recursivo simples.
 */
function parseRawTlv(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "string") return map;

  let index = 0;
  const len = raw.length;

  while (index + 4 <= len) {
    const tag = raw.slice(index, index + 2);
    const lengthStr = raw.slice(index + 2, index + 4);
    const tagLen = parseInt(lengthStr, 10);

    if (isNaN(tagLen) || tagLen < 0 || index + 4 + tagLen > len) {
      break;
    }

    const value = raw.slice(index + 4, index + 4 + tagLen);
    map.set(tag, value);
    index += 4 + tagLen;
  }

  return map;
}

/**
 * Valida a integridade sintatica e a integridade de CRC16 de um payload Pix.
 */
export function validatePixBrCode(payload: string): boolean {
  if (!payload || typeof payload !== "string" || payload.length < 30) {
    return false;
  }

  const trimmed = payload.trim();
  if (!trimmed.startsWith("000201")) {
    return false;
  }

  const tag63Index = trimmed.lastIndexOf("6304");
  if (tag63Index === -1 || tag63Index !== trimmed.length - 8) {
    return false;
  }

  const payloadToSign = trimmed.slice(0, tag63Index + 4);
  const expectedCrc = trimmed.slice(tag63Index + 4).toUpperCase();
  const calculatedCrc = calculatePixCrc16(payloadToSign);

  return calculatedCrc === expectedCrc;
}

/**
 * Decodifica uma string Pix Copia e Cola / BR Code em estrutura legivel.
 */
export function decodePixBrCode(payload: string): DecodedPixBrCode | null {
  if (!payload || typeof payload !== "string") return null;

  const trimmed = payload.trim();
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
  const tag63Index = cleanPayload.lastIndexOf("6304");
  const isValidCrc =
    tag63Index !== -1 &&
    tag63Index === cleanPayload.length - 8 &&
    calculatePixCrc16(cleanPayload.slice(0, tag63Index + 4)) === rawCrc.toUpperCase();

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
