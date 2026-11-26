/**
 * Máscaras e formatação para CPF de clientes (PII Protection).
 * Padrão brasileiro: formatação para digitação e mascaramento de privacidade.
 */

import {
  cleanCPF as domainCleanCPF,
  formatCPF as domainFormatCPF,
  isValidCPF as domainIsValidCPF,
} from "@/domain/validation/cpf";

/**
 * Remove caracteres não numéricos e limita a 11 dígitos.
 */
export function cleanCPF(value?: string | null): string {
  if (!value) return "";
  return domainCleanCPF(value).slice(0, 11);
}

/**
 * Formata um CPF durante a digitação no padrão 000.000.000-00.
 */
export function formatCPF(value?: string | null): string {
  if (!value) return "";
  return domainFormatCPF(value);
}

/**
 * Aplica mascaramento de segurança (anti-vazamento / shoulder surfing).
 * Converte 12345678901 em ***.***.789-**
 * Se já for uma string mascarada ou incompleta, preserva a segurança.
 */
export function maskCPF(value?: string | null): string {
  if (!value) return "";
  const digits = cleanCPF(value);

  if (digits.length < 11) {
    return digits.length > 2
      ? `***.***.${digits.slice(-2)}-**`
      : "***.***.***-**";
  }

  const visiblePart = digits.slice(6, 9);
  return `***.***.${visiblePart}-**`;
}

/**
 * Validação dos dígitos verificadores do CPF (módulo 11 oficial da Receita Federal).
 */
export function isValidCPF(value?: string | null): boolean {
  if (!value) return false;
  return domainIsValidCPF(cleanCPF(value));
}
