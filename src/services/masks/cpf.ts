/**
 * Máscaras e formatação para CPF de clientes (PII Protection).
 * Padrão brasileiro: formatação para digitação e mascaramento de privacidade.
 */

/**
 * Remove caracteres não numéricos e limita a 11 dígitos.
 */
export function cleanCPF(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Formata um CPF durante a digitação no padrão 000.000.000-00.
 */
export function formatCPF(value?: string | null): string {
  const digits = cleanCPF(value);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
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
  const digits = cleanCPF(value);
  if (digits.length !== 11) return false;

  // Rejeita sequências de dígitos repetidos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let firstCheck = 11 - (sum % 11);
  if (firstCheck >= 10) firstCheck = 0;
  if (firstCheck !== Number.parseInt(digits.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(digits.charAt(i), 10) * (11 - i);
  }
  let secondCheck = 11 - (sum % 11);
  if (secondCheck >= 10) secondCheck = 0;
  return secondCheck === Number.parseInt(digits.charAt(10), 10);
}
