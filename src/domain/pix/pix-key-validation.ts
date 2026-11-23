/**
 * Validação estrita e classificação inteligente de chaves Pix brasileiras (BACEN).
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import { isValidCPF } from "@/domain/validation/cpf";
import {
  detectPixKeyType,
  extractBrazilianPhoneLocalDigits,
  stripInvisiblePixChars,
  type PixKeyType,
} from "./pix-br-code";

export interface PixKeyValidationResult {
  isValid: boolean;
  resolvedType: PixKeyType | null;
  normalizedKey: string | null;
  isAmbiguousCpfOrPhone: boolean;
  errorMessage: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

function hasNonAsciiPrintable(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      return true;
    }
  }
  return false;
}

const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular (+55)",
  random: "Chave Aleatória (EVP)",
};

/**
 * Formata o rotulo amigavel em pt-BR de um tipo de chave Pix.
 */
export function formatPixKeyTypeLabel(type: PixKeyType | string | null | undefined): string {
  if (!type) return "Chave Pix";
  const normalized = String(type).trim().toLowerCase() as PixKeyType;
  return PIX_KEY_TYPE_LABELS[normalized] ?? "Chave Pix";
}

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
  const trimmed = typeof rawKey === "string" ? stripInvisiblePixChars(rawKey).trim() : "";
  if (!trimmed) {
    return {
      isValid: false,
      resolvedType: null,
      normalizedKey: null,
      isAmbiguousCpfOrPhone: false,
      errorMessage: "Informe uma chave Pix já cadastrada no seu banco.",
    };
  }

  const hasExplicit = Boolean(explicitType && explicitType !== "auto" && explicitType !== "unknown");
  const targetType: PixKeyType | "unknown" = hasExplicit
    ? (explicitType as PixKeyType)
    : detectPixKeyType(trimmed);

  if (targetType === "email") {
    const normalized = trimmed.toLowerCase();
    if (/\s/.test(trimmed)) {
      return {
        isValid: false,
        resolvedType: "email",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "O e-mail Pix não pode conter espaços.",
      };
    }
    if (hasNonAsciiPrintable(normalized)) {
      return {
        isValid: false,
        resolvedType: "email",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "O e-mail Pix não pode conter acentos ou caracteres fora do padrão ASCII.",
      };
    }
    if (normalized.length > 77) {
      return {
        isValid: false,
        resolvedType: "email",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "O e-mail excede o limite máximo de 77 caracteres do Banco Central.",
      };
    }
    if (!EMAIL_REGEX.test(normalized)) {
      return {
        isValid: false,
        resolvedType: "email",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage: "E-mail Pix incompleto. Confira o formato (ex.: nome@dominio.com).",
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
        errorMessage: `Chave aleatória (EVP) inválida (${normalized.length}/36 caracteres). Copie o UUID completo no app do banco (ex.: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).`,
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
      const errorMessage =
        digits.length !== 11
          ? `CPF deve ter 11 dígitos numéricos (informados: ${digits.length}).`
          : extractBrazilianPhoneLocalDigits(digits) !== null
            ? "CPF inválido — se for um número de celular, troque o tipo para Celular (+55)."
            : "CPF inválido. Confira os 11 dígitos informados.";
      return {
        isValid: false,
        resolvedType: "cpf",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage,
      };
    }
    const isAmbiguous =
      !hasExplicit &&
      !trimmed.includes(".") &&
      !trimmed.includes("-") &&
      digits.length === 11 &&
      extractBrazilianPhoneLocalDigits(digits) !== null;

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
        errorMessage:
          digits.length !== 14
            ? `CNPJ deve ter 14 dígitos numéricos (informados: ${digits.length}).`
            : "CNPJ inválido. Confira os dígitos verificadores informados.",
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
    const localDigits = extractBrazilianPhoneLocalDigits(trimmed);

    if (!localDigits) {
      const digits = trimmed.replace(/\D/g, "");
      let errorMessage = "Número de celular inválido para o padrão Pix (+55 + DDD + número).";
      if (digits.length < 10) {
        errorMessage =
          "Celular incompleto — informe DDD + número (ex.: 11 99999-8888). O +55 é adicionado automaticamente.";
      } else if (digits.length === 11 && digits[2] !== "9") {
        errorMessage =
          "Celular com 11 dígitos deve começar com 9 após o DDD (ex.: 11 9XXXX-XXXX).";
      }
      return {
        isValid: false,
        resolvedType: "phone",
        normalizedKey: null,
        isAmbiguousCpfOrPhone: false,
        errorMessage,
      };
    }
    return {
      isValid: true,
      resolvedType: "phone",
      normalizedKey: `+55${localDigits}`,
      isAmbiguousCpfOrPhone: false,
      errorMessage: null,
    };
  }

  const digits = trimmed.replace(/\D/g, "");
  let unknownError =
    "Chave Pix não reconhecida. Informe CPF (11 dígitos), CNPJ (14), Celular com DDD, E-mail ou Chave Aleatória (EVP).";
  if (trimmed.includes("-") && /[0-9a-f-]{12,}/i.test(trimmed) && /^[0-9a-f-]+$/i.test(trimmed)) {
    unknownError = `Parece uma chave aleatória (EVP) incompleta (${trimmed.length}/36 caracteres). Copie a chave inteira no app do banco.`;
  } else if (/^[\d\s().+-]+$/.test(trimmed) && digits.length > 0 && digits.length < 10) {
    unknownError = `Faltam dígitos (${digits.length} informados): use Celular com DDD (11 dígitos), CPF (11) ou CNPJ (14).`;
  }

  return {
    isValid: false,
    resolvedType: null,
    normalizedKey: null,
    isAmbiguousCpfOrPhone: false,
    errorMessage: unknownError,
  };
}
