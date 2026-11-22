/**
 * Validação estrita e classificação inteligente de chaves Pix brasileiras (BACEN).
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import { isValidCPF } from "@/domain/validation/cpf";
import { detectPixKeyType, normalizePixKey, type PixKeyType } from "./pix-br-code";

export interface PixKeyValidationResult {
  isValid: boolean;
  resolvedType: PixKeyType | null;
  normalizedKey: string | null;
  isAmbiguousCpfOrPhone: boolean;
  errorMessage: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida CNPJ matematicamente pelos dois dígitos verificadores (módulo 11).
 */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += Number(digits[i]) * weights1[i]!;
  }
  const rem1 = sum1 % 11;
  const digit1 = rem1 < 2 ? 0 : 11 - rem1;
  if (digit1 !== Number(digits[12])) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += Number(digits[i]) * weights2[i]!;
  }
  const rem2 = sum2 % 11;
  const digit2 = rem2 < 2 ? 0 : 11 - rem2;
  if (digit2 !== Number(digits[13])) return false;

  return true;
}

/**
 * Verifica se uma sequência de 10 ou 11 dígitos corresponde a um telefone brasileiro
 * (DDD válido de 11 a 99; 11 dígitos exigem nono dígito '9').
 */
export function isValidBrazilianPhoneDigits(digits: string): boolean {
  if (!/^\d{10,11}$/.test(digits)) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11) {
    return digits[2] === "9";
  }
  // Fixo de 10 dígitos: primeiro dígito do assinante normalmente 2-5 (evita sequências zeradas)
  const firstLocal = Number(digits[2]);
  return firstLocal >= 2 && firstLocal <= 9;
}

/**
 * Valida e classifica uma chave Pix para formulários e fluxos de edição do anfitrião.
 */
export function validateAndClassifyPixKey(
  rawKey: string | null | undefined,
  explicitType?: PixKeyType | "auto" | "unknown" | null,
): PixKeyValidationResult {
  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!trimmed) {
    return {
      isValid: false,
      resolvedType: null,
      normalizedKey: null,
      isAmbiguousCpfOrPhone: false,
      errorMessage: "Informe uma chave Pix para receber os pagamentos.",
    };
  }

  const hasExplicit = Boolean(explicitType && explicitType !== "auto" && explicitType !== "unknown");
  const targetType: PixKeyType | "unknown" = hasExplicit
    ? (explicitType as PixKeyType)
    : detectPixKeyType(trimmed);

  if (targetType === "email") {
    const normalized = trimmed.toLowerCase();
    if (normalized.length > 77 || !EMAIL_REGEX.test(normalized)) {
      return {
        isValid: false,
        resolvedType: "email",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "E-mail Pix inválido. Verifique o formato (ex.: nome@dominio.com).",
      };
    }
    return {
      isValid: true,
      resolvedType: "email",
      normalizedKey: normalized,
      isAmbiguousCpfOrPhone: false,
      errorMessage: null,
    };
  }

  if (targetType === "random") {
    const normalized = trimmed.toLowerCase();
    if (!UUID_REGEX.test(normalized)) {
      return {
        isValid: false,
        resolvedType: "random",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "Chave aleatória (EVP) inválida. Use o UUID de 36 caracteres.",
      };
    }
    return {
      isValid: true,
      resolvedType: "random",
      normalizedKey: normalized,
      isAmbiguousCpfOrPhone: false,
      errorMessage: null,
    };
  }

  if (targetType === "cpf") {
    const digits = trimmed.replace(/\D/g, "");
    if (!isValidCPF(digits)) {
      // Se 11 dígitos formam um celular válido quando usuário não forçou CPF manualmente,
      // detectPixKeyType já deveria classificar como phone; aqui garantimos rejeição se explícito ou inválido.
      return {
        isValid: false,
        resolvedType: "cpf",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage:
          digits.length !== 11
            ? "CPF deve conter 11 dígitos numéricos."
            : "CPF inválido. Confira os dígitos ou altere o tipo para Celular (+55).",
      };
    }
    const isAmbiguous =
      !hasExplicit &&
      !trimmed.includes(".") &&
      !trimmed.includes("-") &&
      isValidBrazilianPhoneDigits(digits);

    return {
      isValid: true,
      resolvedType: "cpf",
      normalizedKey: digits,
      isAmbiguousCpfOrPhone: isAmbiguous,
      errorMessage: null,
    };
  }

  if (targetType === "cnpj") {
    const digits = trimmed.replace(/\D/g, "");
    if (!isValidCNPJ(digits)) {
      return {
        isValid: false,
        resolvedType: "cnpj",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "CNPJ inválido. Verifique os 14 dígitos informados.",
      };
    }
    return {
      isValid: true,
      resolvedType: "cnpj",
      normalizedKey: digits,
      isAmbiguousCpfOrPhone: false,
      errorMessage: null,
    };
  }

  if (targetType === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    const localDigits =
      digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
        ? digits.slice(2)
        : digits;

    if (!isValidBrazilianPhoneDigits(localDigits)) {
      return {
        isValid: false,
        resolvedType: "phone",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "Celular inválido. Informe DDD + número (ex.: 11999998888 ou +5511999998888).",
      };
    }
    return {
      isValid: true,
      resolvedType: "phone",
      normalizedKey: normalizePixKey(trimmed, "phone"),
      isAmbiguousCpfOrPhone: false,
      errorMessage: null,
    };
  }

  return {
    isValid: false,
    resolvedType: null,
    normalizedKey: null,
    isAmbiguousCpfOrPhone: false,
    errorMessage:
      "Chave Pix não reconhecida. Informe CPF (11 dígitos), CNPJ (14), Celular com DDD, E-mail ou Chave Aleatória (EVP).",
  };
}
