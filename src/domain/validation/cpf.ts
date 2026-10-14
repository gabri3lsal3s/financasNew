/**
 * Funções puras de domínio para validação, sanitização e formatação de CPF.
 * Algoritmo oficial de dígitos verificadores da Receita Federal do Brasil (módulo 11).
 */

/** Remove todos os caracteres não numéricos de uma string. */
export function cleanCPF(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata dígitos numéricos no padrão 000.000.000-00. */
export function formatCPF(value: string): string {
  const digits = cleanCPF(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Valida se um CPF é matematicamente autêntico através do cálculo dos dois dígitos verificadores.
 */
export function isValidCPF(value: string): boolean {
  const digits = cleanCPF(value);

  // CPF deve conter exatamente 11 dígitos
  if (digits.length !== 11) {
    return false;
  }

  // Sequências de dígitos repetidos são inválidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  // 1º dígito verificador
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  const remainder1 = sum1 % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  if (digit1 !== parseInt(digits.charAt(9), 10)) {
    return false;
  }

  // 2º dígito verificador
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  const remainder2 = sum2 % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;
  if (digit2 !== parseInt(digits.charAt(10), 10)) {
    return false;
  }

  return true;
}
