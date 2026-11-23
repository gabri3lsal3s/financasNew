/**
 * Funções puras de domínio para validação, sanitização e formatação de CNPJ.
 * Algoritmo oficial de dígitos verificadores da Receita Federal do Brasil (módulo 11).
 */

/** Remove todos os caracteres não numéricos de uma string. */
export function cleanCNPJ(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata dígitos numéricos no padrão 00.000.000/0000-00. */
export function formatCNPJ(value: string): string {
  const digits = cleanCNPJ(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Valida se um CNPJ é matematicamente autêntico através do cálculo dos dois dígitos verificadores.
 */
export function isValidCNPJ(value: string): boolean {
  const digits = cleanCNPJ(value);
  if (digits.length !== 14) {
    return false;
  }

  // Sequências de dígitos repetidos são inválidas (ex.: 11.111.111/1111-11)
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += Number(digits.charAt(i)) * weights1[i]!;
  }
  const rem1 = sum1 % 11;
  const digit1 = rem1 < 2 ? 0 : 11 - rem1;
  if (digit1 !== Number(digits.charAt(12))) {
    return false;
  }

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += Number(digits.charAt(i)) * weights2[i]!;
  }
  const rem2 = sum2 % 11;
  const digit2 = rem2 < 2 ? 0 : 11 - rem2;
  if (digit2 !== Number(digits.charAt(13))) {
    return false;
  }

  return true;
}
