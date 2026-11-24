/**
 * Módulo de extração de parcelas embutidas no texto da descrição bancária.
 */

export interface ParsedInstallment {
  current: number;
  total: number;
}

function isValidInstallmentRange(current: number, total: number): boolean {
  return (
    !Number.isNaN(current) &&
    !Number.isNaN(total) &&
    current >= 1 &&
    total >= 2 &&
    current <= total &&
    total <= 60
  );
}

/**
 * Extrai informações de parcelas embutidas em descrições bancárias com blindagem
 * contra falsos positivos de datas (ex.: "COMPRA 04/11" ou "MERCADO 02/08"):
 * - "(02/10)"
 * - "PARC 02/10" ou "PARCELA 02/10"
 * - "PC 03 DE 06" ou "03 DE 06"
 * - "PARC 02-10"
 * - "02/10" estritamente no final da string ou delimitado sem prefixo temporal
 */
export function extractInstallmentInfo(
  raw: string,
  txDate?: string,
): ParsedInstallment | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();

  // 1. Padrões inequívocos (com delimitadores ou palavras-chave explícitas)
  const explicitPatterns = [
    /\((\d{1,2})\/(\d{1,2})\)/,
    /\b(?:PARC(?:ELA)?|PC)\s*(\d{1,2})\s*(?:DE|\/|-)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*DE\s*(\d{1,2})\b/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[2]) {
      const current = Number.parseInt(match[1], 10);
      const total = Number.parseInt(match[2], 10);
      if (isValidInstallmentRange(current, total)) {
        return { current, total };
      }
    }
  }

  // 2. Padrão numérico genérico X/Y
  const genericSlashMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(trimmed);
  if (genericSlashMatch && genericSlashMatch[1] && genericSlashMatch[2]) {
    const current = Number.parseInt(genericSlashMatch[1], 10);
    const total = Number.parseInt(genericSlashMatch[2], 10);

    // Prevenção de falso positivo 1: Precedido por marcador temporal (ex.: "em 04/11", "dia 02/08")
    const beforeToken = trimmed.slice(0, genericSlashMatch.index).trimEnd();
    const isTemporalPrefix = /\b(?:em|dia|no dia|data)\s*$/i.test(beforeToken);

    // Prevenção de falso positivo 2: Coincidência com dia/mês da data da transação (ex.: 2026-11-04)
    let isDateCollision = false;
    if (txDate && /^\d{4}-\d{2}-\d{2}$/.test(txDate)) {
      const txMonth = Number.parseInt(txDate.slice(5, 7), 10);
      const txDay = Number.parseInt(txDate.slice(8, 10), 10);
      if (current === txDay && total === txMonth) {
        isDateCollision = true;
      }
    }

    // Prevenção de falso positivo 3: Se total <= 12 e não estiver no final da string, risco de ser data no texto
    const isAtEnd = genericSlashMatch.index + genericSlashMatch[0].length === trimmed.length;
    const isLikelyDate = isTemporalPrefix || isDateCollision || (!isAtEnd && total <= 12);

    if (!isLikelyDate && isValidInstallmentRange(current, total)) {
      return { current, total };
    }
  }

  // 3. Formato "3x", "em 3x", "parcelado em 3x", "3 vezes"
  const multiplierMatch = /\b(?:parcelado\s+em\s+|em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i.exec(trimmed);
  if (multiplierMatch && multiplierMatch[1]) {
    const total = Number.parseInt(multiplierMatch[1], 10);
    if (!Number.isNaN(total) && total >= 2 && total <= 60) {
      return { current: 1, total };
    }
  }

  return undefined;
}

