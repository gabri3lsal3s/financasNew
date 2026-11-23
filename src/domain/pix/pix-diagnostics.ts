/**
 * Verificação pré-voo e diagnóstico estrutural EMV/CRC16 para configuração e pagamento Pix.
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import { buildPixTransferCode } from "./build-pix-transfer-code";
import {
  DEFAULT_PIX_CITY,
  DEFAULT_PIX_MERCHANT_NAME,
  decodePixBrCode,
  detectPixKeyType,
  sanitizePixCity,
  sanitizePixMerchantName,
  stripInvisiblePixChars,
  validatePixBrCode,
  type PixKeyType,
  type PixSanitizedFieldResult,
} from "./pix-br-code";
import { validateAndClassifyPixKey, type PixKeyValidationResult } from "./pix-key-validation";

export type PixConfigurationStatus = "empty" | "error" | "warning" | "ready";

export interface VerifyPixConfigurationInput {
  pixKey: string | null | undefined;
  keyType?: PixKeyType | "auto" | "unknown" | null;
  merchantName?: string | null;
  merchantCity?: string | null;
  amountCents?: number | null;
  infoAdicional?: string | null;
  profileEmail?: string | null;
  allowCnpj?: boolean;
  defaultMerchantName?: string;
  defaultMerchantCity?: string;
}

export interface PixConfigurationDiagnosis {
  status: PixConfigurationStatus;
  isReady: boolean;
  keyValidation: PixKeyValidationResult;
  resolvedName: PixSanitizedFieldResult;
  resolvedCity: PixSanitizedFieldResult;
  brCode: string | null;
  crc16: string | null;
  blockingReason: string | null;
  warnings: string[];
  autoAdjustments: string[];
}

export interface InspectPixPaymentPayloadInput {
  pixBrCode?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
}

export interface PixPaymentInspection {
  isValidEmv: boolean;
  crc16: string | null;
  embeddedKey: string | null;
  embeddedKeyType: PixKeyType | null;
  embeddedAmountCents: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  issueReason: string | null;
}

/**
 * Executa verificação completa pré-voo da configuração Pix:
 * valida a chave, aplica sanitização resiliente com fallback em nome/cidade,
 * gera o BR Code real, confere o round-trip EMV + CRC16 e lista avisos/ajustes.
 */
export function verifyPixConfiguration(
  input: VerifyPixConfigurationInput,
): PixConfigurationDiagnosis {
  const allowCnpj = input.allowCnpj ?? true;
  const fallbackName = input.defaultMerchantName ?? DEFAULT_PIX_MERCHANT_NAME;
  const fallbackCity = input.defaultMerchantCity ?? DEFAULT_PIX_CITY;

  const resolvedName = sanitizePixMerchantName(input.merchantName, fallbackName);
  const resolvedCity = sanitizePixCity(input.merchantCity, fallbackCity);
  const keyValidation = validateAndClassifyPixKey(input.pixKey, input.keyType);

  const rawKey = typeof input.pixKey === "string" ? stripInvisiblePixChars(input.pixKey).trim() : "";

  const autoAdjustments: string[] = [];
  if (keyValidation.isValid && keyValidation.normalizedKey && keyValidation.normalizedKey !== rawKey) {
    autoAdjustments.push(`Chave normalizada para "${keyValidation.normalizedKey}" no código Pix.`);
  }
  if (resolvedName.adjusted && resolvedName.reason) {
    autoAdjustments.push(resolvedName.reason);
  }
  if (resolvedCity.adjusted && resolvedCity.reason) {
    autoAdjustments.push(resolvedCity.reason);
  }

  if (!rawKey) {
    return {
      status: "empty",
      isReady: false,
      keyValidation,
      resolvedName,
      resolvedCity,
      brCode: null,
      crc16: null,
      blockingReason: null,
      warnings: [],
      autoAdjustments,
    };
  }

  if (!allowCnpj && keyValidation.resolvedType === "cnpj") {
    return {
      status: "error",
      isReady: false,
      keyValidation: {
        ...keyValidation,
        isValid: false,
        normalizedKey: null,
        errorMessage: "CNPJ não é suportado neste módulo. Use CPF, celular, e-mail ou chave aleatória.",
      },
      resolvedName,
      resolvedCity,
      brCode: null,
      crc16: null,
      blockingReason:
        "CNPJ não é suportado neste módulo. Use CPF, celular, e-mail ou chave aleatória.",
      warnings: [],
      autoAdjustments,
    };
  }

  if (!keyValidation.isValid || !keyValidation.normalizedKey || !keyValidation.resolvedType) {
    return {
      status: "error",
      isReady: false,
      keyValidation,
      resolvedName,
      resolvedCity,
      brCode: null,
      crc16: null,
      blockingReason: keyValidation.errorMessage ?? "Chave Pix inválida.",
      warnings: [],
      autoAdjustments,
    };
  }

  const normalizedAmount =
    input.amountCents !== undefined && input.amountCents !== null ? input.amountCents : undefined;

  const brCode = buildPixTransferCode({
    pixKey: keyValidation.normalizedKey,
    keyType: keyValidation.resolvedType,
    merchantName: resolvedName.value,
    merchantCity: resolvedCity.value,
    amountCents: normalizedAmount,
    txId: "***",
    infoAdicional: input.infoAdicional ?? undefined,
    defaultMerchantName: fallbackName,
    defaultMerchantCity: fallbackCity,
  });

  if (!brCode || !validatePixBrCode(brCode)) {
    const amountError =
      normalizedAmount !== undefined && (!Number.isInteger(normalizedAmount) || normalizedAmount < 0)
        ? "Valor da cobrança inválido para geração do código Pix."
        : "Não foi possível montar um código Pix EMV válido com os dados informados.";
    return {
      status: "error",
      isReady: false,
      keyValidation,
      resolvedName,
      resolvedCity,
      brCode: null,
      crc16: null,
      blockingReason: amountError,
      warnings: [],
      autoAdjustments,
    };
  }

  const decoded = decodePixBrCode(brCode);
  const roundTripAmountOk =
    normalizedAmount === undefined ||
    normalizedAmount === 0 ||
    decoded?.amountCents === normalizedAmount;

  if (
    !decoded ||
    !decoded.isValidCrc ||
    decoded.pixKey !== keyValidation.normalizedKey ||
    !roundTripAmountOk
  ) {
    return {
      status: "error",
      isReady: false,
      keyValidation,
      resolvedName,
      resolvedCity,
      brCode: null,
      crc16: null,
      blockingReason: "Falha na verificação interna de integridade CRC16 do código Pix.",
      warnings: [],
      autoAdjustments,
    };
  }

  const warnings: string[] = [];
  const cleanProfileEmail = input.profileEmail?.trim().toLowerCase() ?? "";
  if (cleanProfileEmail && keyValidation.normalizedKey.toLowerCase() === cleanProfileEmail) {
    warnings.push(
      "Esta chave coincide com o seu e-mail de login no Axir. Confirme se ele está cadastrado no Pix do seu banco.",
    );
  }
  if (keyValidation.isAmbiguousCpfOrPhone) {
    warnings.push(
      "Esta chave de 11 dígitos pode ser CPF ou Celular (+55). Confirme o tipo correto no seletor ao lado.",
    );
  }

  const status: PixConfigurationStatus = warnings.length > 0 ? "warning" : "ready";

  return {
    status,
    isReady: true,
    keyValidation,
    resolvedName,
    resolvedCity,
    brCode,
    crc16: decoded.crc,
    blockingReason: null,
    warnings,
    autoAdjustments,
  };
}

/**
 * Inspeciona o payload Pix entregue ao pagador para confirmar integridade EMV/CRC16
 * ou explicar exatamente por que o QR Code / Copia e Cola não pôde ser gerado.
 */
export function inspectPixPaymentPayload(
  input: InspectPixPaymentPayloadInput,
): PixPaymentInspection {
  const rawBrCode = typeof input.pixBrCode === "string" ? stripInvisiblePixChars(input.pixBrCode).trim() : "";
  const rawKey = typeof input.pixKey === "string" ? stripInvisiblePixChars(input.pixKey).trim() : "";

  if (rawBrCode && validatePixBrCode(rawBrCode)) {
    const decoded = decodePixBrCode(rawBrCode);
    if (decoded && decoded.isValidCrc && decoded.pixKey) {
      const detectedFromKey = detectPixKeyType(decoded.pixKey);
      return {
        isValidEmv: true,
        crc16: decoded.crc,
        embeddedKey: decoded.pixKey,
        embeddedKeyType: detectedFromKey === "unknown" ? null : detectedFromKey,
        embeddedAmountCents: decoded.amountCents ?? null,
        merchantName: decoded.merchantName || null,
        merchantCity: decoded.merchantCity || null,
        issueReason: null,
      };
    }
  }

  if (!rawKey) {
    return {
      isValidEmv: false,
      crc16: null,
      embeddedKey: null,
      embeddedKeyType: null,
      embeddedAmountCents: null,
      merchantName: null,
      merchantCity: null,
      issueReason: rawBrCode
        ? "O código Pix armazenado falhou na verificação de integridade EMV/CRC16."
        : "Nenhuma chave Pix foi cadastrada pelo recebedor até o momento.",
    };
  }

  const explicitType =
    input.pixKeyType && input.pixKeyType !== "auto" && input.pixKeyType !== "unknown"
      ? (input.pixKeyType.trim().toLowerCase() as PixKeyType)
      : "auto";
  const keyCheck = validateAndClassifyPixKey(rawKey, explicitType);

  return {
    isValidEmv: false,
    crc16: null,
    embeddedKey: null,
    embeddedKeyType: keyCheck.resolvedType,
    embeddedAmountCents: null,
    merchantName: null,
    merchantCity: null,
    issueReason:
      keyCheck.errorMessage ??
      "Não foi possível validar a integridade EMV/CRC16 do código Pix com a chave cadastrada.",
  };
}
