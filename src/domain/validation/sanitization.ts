import { z } from "zod";

/**
 * Limite monetário máximo seguro em centavos (R$ 999.999.999,99).
 * Previne overflows aritméticos em JS (64-bit float seguro até 9x10^15)
 * e estouro de capacidade em colunas Postgres numeric(12,2).
 */
export const MAX_MONEY_CENTS = 99_999_999_99;

/**
 * Limite monetário máximo seguro na unidade principal (R$ 999.999.999,99).
 */
export const MAX_MONEY_AMOUNT = 999_999_999.99;

/**
 * Regex para identificação e remoção de caracteres de controle perigosos:
 * • Null bytes (\u0000);
 * • Caracteres de controle ASCII (\u0001-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F);
 * • Caracteres de controle C1 Unicode (\u0080-\u009F).
 * Preserva tabulações (\t = \u0009), quebras de linha (\n = \u000A) e retornos (\r = \u000D).
 */
// eslint-disable-next-line no-control-regex -- sanitização proposital de caracteres de controle maliciosos
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Regex para remoção de tags HTML/XML para prevenir injeção de HTML/XSS armazenado.
 */
const HTML_TAGS_REGEX = /<[^>]*>/g;

/**
 * Função pura para sanitização estrita de strings de entrada:
 * 1. Remove caracteres nulos e de controle perigosos;
 * 2. Remove tags HTML/XML;
 * 3. Normaliza espaços excedentes nas extremidades (trim).
 */
export function sanitizeString(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(HTML_TAGS_REGEX, "")
    .trim();
}

export interface CleanTextOptions {
  min?: number;
  max?: number;
  requiredMessage?: string;
  maxMessage?: string;
}

/**
 * Schema Zod defensivo para texto limpo e sanitizado:
 * - Aplica sanitizeString automaticamente;
 * - Valida limites de tamanho mínimo e máximo;
 * - Previne XSS e caracteres de controle em formulários e mutations.
 */
export function cleanTextSchema(
  maxLength = 500,
  options?: CleanTextOptions,
) {
  const min = options?.min ?? 0;
  const max = options?.max ?? maxLength;

  let base = z
    .string()
    .transform((val) => sanitizeString(val));

  if (min > 0) {
    base = base.refine(
      (val) => val.length >= min,
      { message: options?.requiredMessage ?? `Mínimo de ${min} caractere(s).` },
    ) as unknown as typeof base;
  }

  return base.pipe(
    z
      .string()
      .max(max, options?.maxMessage ?? `Máximo de ${max} caracteres.`),
  );
}

export interface MoneyCentsOptions {
  allowZero?: boolean;
  min?: number;
  max?: number;
  minMessage?: string;
  maxMessage?: string;
}

/**
 * Schema Zod para valores inteiros em centavos:
 * - Valida se é inteiro;
 * - Impõe limites contra overflows monetários (0 ou >0 até MAX_MONEY_CENTS).
 */
export function moneyCentsSchema(options?: MoneyCentsOptions) {
  const allowZero = options?.allowZero ?? false;
  const minVal = options?.min ?? (allowZero ? 0 : 1);
  const maxVal = options?.max ?? MAX_MONEY_CENTS;

  let schema = z
    .number({ message: "Informe um valor monetário válido." })
    .int("O valor em centavos deve ser um número inteiro.");

  if (minVal > 0) {
    schema = schema.min(
      minVal,
      options?.minMessage ?? "O valor deve ser maior que zero.",
    );
  } else {
    schema = schema.min(
      0,
      options?.minMessage ?? "O valor não pode ser negativo.",
    );
  }

  return schema.max(
    maxVal,
    options?.maxMessage ?? "O valor ultrapassa o limite monetário permitido (máx. R$ 999.999.999,99).",
  );
}

export interface MoneyAmountOptions {
  allowZero?: boolean;
  min?: number;
  max?: number;
  minMessage?: string;
  maxMessage?: string;
}

/**
 * Schema Zod para valores monetários na unidade principal (reais/dólares):
 * - Valida limite contra overflow (MAX_MONEY_AMOUNT);
 * - Valida precisão máxima de 2 casas decimais (centavos).
 */
export function moneyAmountSchema(options?: MoneyAmountOptions) {
  const allowZero = options?.allowZero ?? false;
  const minVal = options?.min ?? (allowZero ? 0 : 0.01);
  const maxVal = options?.max ?? MAX_MONEY_AMOUNT;

  let schema = z
    .number({ message: "Informe um valor monetário válido." })
    .refine(
      (val) => Number.isFinite(val) && Math.round(val * 100) === Math.round(val * 10000) / 100,
      "O valor deve ter no máximo 2 casas decimais (centavos).",
    );

  if (minVal > 0) {
    schema = schema.refine(
      (val) => val >= minVal,
      options?.minMessage ?? "O valor deve ser maior que zero.",
    );
  } else {
    schema = schema.refine(
      (val) => val >= 0,
      options?.minMessage ?? "O valor não pode ser negativo.",
    );
  }

  return schema.refine(
    (val) => val <= maxVal,
    options?.maxMessage ?? "O valor ultrapassa o limite monetário permitido (máx. R$ 999.999.999,99).",
  );
}
