/**
 * Parsing de valores monetários — entrada livre do usuário → centavos.
 * Aceita formatos pt-BR: "R$ 1.500,00", "1.500,5", "1500", "0,01" e variações de OCR ("R$ 45.00", "R$ 45 , 00").
 */

export interface ParseBrazilianCurrencyOptions {
  /** Quando true, aceita valores negativos ("-R$ 45,00", "R$ -45,00", "(45,00)", "45,00-"). Padrão: false. */
  allowNegative?: boolean;
}

function buildCents(wholeStr: string, fracStr: string): number | null {
  const whole = Number.parseInt(wholeStr, 10);
  const frac = fracStr ? Number.parseInt(fracStr.padEnd(2, "0").slice(0, 2), 10) : 0;
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null;
  const total = whole * 100 + frac;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

/**
 * Converte string monetária brasileira (ou decimal com ponto de OCR/gateway) para centavos inteiros.
 * Garante via aritmética inteira que "R$ 45,00" e "R$ 45.00" retornem 4500 (jamais 45000/450000).
 */
export function parseBrazilianCurrencyToCents(
  input: string,
  options?: ParseBrazilianCurrencyOptions,
): number | null {
  if (typeof input !== "string") return null;

  let working = input.replace(/\u00a0/g, " ").trim();
  if (!working) return null;

  let isNegative = false;
  let hasExplicitSign = false;

  // Formato contábil entre parênteses: "(R$ 45,00)" ou "(45,00)"
  if (working.startsWith("(") && working.endsWith(")")) {
    isNegative = true;
    hasExplicitSign = true;
    working = working.slice(1, -1).trim();
  }

  // Sinal antes da moeda: "-R$ 45,00", "+ R$ 45,00", "-45,00"
  const leadingSignMatch = /^([+-])\s*(.*)$/.exec(working);
  if (leadingSignMatch && leadingSignMatch[1] && leadingSignMatch[2] !== undefined) {
    if (hasExplicitSign) return null;
    isNegative = leadingSignMatch[1] === "-";
    hasExplicitSign = true;
    working = leadingSignMatch[2].trim();
  }

  // Remove prefixo monetário ("R$", "R$:", "R$.", "BRL", "$")
  working = working.replace(/^(?:R\$|BRL|\$)\s*[:.]?\s*/i, "").trim();

  // Sinal após a moeda: "R$ -45,00", "R$ +45,00"
  const midSignMatch = /^([+-])\s*(.*)$/.exec(working);
  if (midSignMatch && midSignMatch[1] && midSignMatch[2] !== undefined) {
    if (hasExplicitSign) return null;
    isNegative = midSignMatch[1] === "-";
    hasExplicitSign = true;
    working = midSignMatch[2].trim();
  }

  // Remove sufixo monetário opcional ("45,00 BRL", "45,00 R$")
  working = working.replace(/\s*(?:BRL|R\$|\$)$/i, "").trim();

  // Sinal no final: "45,00-" ou "45,00+"
  const trailingSignMatch = /^(.*?)([+-])$/.exec(working);
  if (trailingSignMatch && trailingSignMatch[1] !== undefined && trailingSignMatch[2]) {
    if (hasExplicitSign) return null;
    isNegative = trailingSignMatch[2] === "-";
    working = trailingSignMatch[1].trim();
  }

  if (!working) return null;

  // Compacta exclusivamente espaços de OCR ao redor de separadores decimais/milhar ("45 , 00" -> "45,00")
  const collapsed = working.replace(/\s*([.,])\s*/g, "$1");
  if (!/^\d[\d.,]*\d$|^\d$/.test(collapsed)) {
    return null;
  }

  let cents: number | null = null;
  const hasComma = collapsed.includes(",");
  const hasDot = collapsed.includes(".");

  if (hasComma && hasDot) {
    const lastComma = collapsed.lastIndexOf(",");
    const lastDot = collapsed.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Padrão BR: "1.234,56" ou PDV 3 decimais terminando em 0 ("1.250,000")
      const wholePart = collapsed.slice(0, lastComma);
      const fracPart = collapsed.slice(lastComma + 1);
      if (/^\d{1,3}(?:\.\d{3})+$/.test(wholePart) && (/^\d{1,2}$/.test(fracPart) || /^\d{2}0$/.test(fracPart))) {
        cents = buildCents(wholePart.replace(/\./g, ""), fracPart.slice(0, 2));
      }
    } else {
      // Padrão internacional: "1,450.00"
      const wholePart = collapsed.slice(0, lastDot);
      const fracPart = collapsed.slice(lastDot + 1);
      if (/^\d{1,3}(?:,\d{3})+$/.test(wholePart) && (/^\d{1,2}$/.test(fracPart) || /^\d{2}0$/.test(fracPart))) {
        cents = buildCents(wholePart.replace(/,/g, ""), fracPart.slice(0, 2));
      }
    }
  } else if (hasComma) {
    // Padrão BR sem milhar: "45,00", "1500,5", "0,50" ou PDV 3 decimais terminando em 0 ("45,000")
    const decimalMatch = /^(\d+),(\d{1,2})$/.exec(collapsed);
    const pdvThreeDecMatch = /^(\d+),(\d{2})0$/.exec(collapsed);
    if (decimalMatch && decimalMatch[1] && decimalMatch[2]) {
      cents = buildCents(decimalMatch[1], decimalMatch[2]);
    } else if (pdvThreeDecMatch && pdvThreeDecMatch[1] && pdvThreeDecMatch[2]) {
      cents = buildCents(pdvThreeDecMatch[1], pdvThreeDecMatch[2]);
    }
  } else if (hasDot) {
    // Ponto decimal explícito ("45.00", "45.5") vs. separador de milhar inteiro ("1.200", "1.000.000")
    const dotDecimalMatch = /^(\d+)\.(\d{1,2})$/.exec(collapsed);
    if (dotDecimalMatch && dotDecimalMatch[1] && dotDecimalMatch[2]) {
      cents = buildCents(dotDecimalMatch[1], dotDecimalMatch[2]);
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(collapsed)) {
      cents = buildCents(collapsed.replace(/\./g, ""), "");
    }
  } else {
    cents = buildCents(collapsed, "");
  }

  if (cents === null) return null;

  if (isNegative) {
    if (!options?.allowNegative) return null;
    return cents === 0 ? 0 : -cents;
  }

  return cents;
}

/** Converte texto monetário pt-BR em centavos (não negativos); retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  return parseBrazilianCurrencyToCents(input, { allowNegative: false });
}

// Formatação exibível (R$ 1.500,00) vive em `services/masks/money`
// (`formatCentsAsBRL`) — fonte única (DRY); não duplicar aqui.

/**
 * Helper canônico de conversão para centavos (F19).
 * Guarda `isFinite` — NaN/Infinity viram 0 (contrato único; antes havia
 * ~8 `toCents` locais divergentes, metade sem a guarda). Nunca lança.
 */
export function numberToCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

/**
 * Converte texto numérico (pt-BR ou internacional) para float não negativo.
 * Trata vírgulas, pontos decimais, percentuais e separadores de milhar com resiliência.
 *
 * Exemplos:
 *   "8,52"     -> 8.52
 *   "8.52"     -> 8.52
 *   "110"      -> 110
 *   "12,5%"    -> 12.5
 *   "1.234,56" -> 1234.56
 *   "1234.56"  -> 1234.56
 */
export function parseDecimalNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const trimmed = String(raw).trim().replace(/^R\$\s*/i, "").replace(/^\$\s*/, "").replace(/[%]/g, "").trim();
  if (!trimmed || trimmed === "-") return 0;

  // Se possui ponto e vírgula juntos (ex: 1.234,56)
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const clean = trimmed.replace(/\./g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui múltiplos pontos (ex: 1.000.000)
  if ((trimmed.match(/\./g) || []).length > 1) {
    const clean = trimmed.replace(/\./g, "");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui vírgula como separador decimal (ex: 8,52)
  if (trimmed.includes(",")) {
    const clean = trimmed.replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui apenas ponto decimal ou número inteiro (ex: 8.52 ou 110)
  const val = Number(trimmed);
  return Number.isFinite(val) && val >= 0 ? val : 0;
}

/**
 * Formata um número decimal para exibição em input pt-BR amigável.
 * Mantém inteiros limpos (ex: 100 -> "100") e decimais com vírgula (ex: 8.52 -> "8,52").
 */
export function formatDecimalNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

