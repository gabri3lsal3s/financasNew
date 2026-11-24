/**
 * Máscaras e validações para dados de contato de faturamento (Telefone BR e CEP).
 */

/**
 * Remove caracteres não numéricos e limita a 11 dígitos (DDD + número).
 */
export function cleanPhoneBR(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Formata telefone brasileiro durante a digitação:
 * - Até 10 dígitos: (XX) XXXX-XXXX
 * - 11 dígitos: (XX) XXXXX-XXXX
 */
export function formatPhoneBR(value?: string | null): string {
  const digits = cleanPhoneBR(value);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Valida telefone brasileiro (10 ou 11 dígitos, DDD >= 11 e sem dígitos repetidos).
 */
export function isValidPhoneBR(value?: string | null): boolean {
  const digits = cleanPhoneBR(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const ddd = Number(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

/**
 * Remove caracteres não numéricos e limita a 8 dígitos de CEP.
 */
export function cleanCep(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "").slice(0, 8);
}

/**
 * Formata CEP brasileiro durante a digitação no padrão XXXXX-XXX.
 */
export function formatCep(value?: string | null): string {
  const digits = cleanCep(value);
  if (!digits) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Valida CEP brasileiro (8 dígitos numéricos e sem sequência idêntica repetida).
 */
export function isValidCep(value?: string | null): boolean {
  const digits = cleanCep(value);
  if (digits.length !== 8) return false;
  return !/^(\d)\1+$/.test(digits);
}
