/**
 * Módulo de extração de parcelas embutidas no texto da descrição bancária.
 */

export interface ParsedInstallment {
  current: number;
  total: number;
}

/**
 * Extrai informações de parcelas embutidas em descrições bancárias:
 * - "(02/10)"
 * - "PARC 02/10" ou "PARCELA 02/10"
 * - "02 DE 10" ou "PARC 02 DE 10"
 * - "02/10" isolado
 */
export function extractInstallmentInfo(raw: string): ParsedInstallment | undefined {
  if (!raw) return undefined;

  const patterns = [
    /\((\d{1,2})\/(\d{1,2})\)/,
    /\bPARC(?:ELA)?\s*(\d{1,2})\s*(?:DE|\/)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*DE\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\/(\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (match && match[1] && match[2]) {
      const current = Number.parseInt(match[1], 10);
      const total = Number.parseInt(match[2], 10);

      if (
        !Number.isNaN(current) &&
        !Number.isNaN(total) &&
        current >= 1 &&
        total >= 2 &&
        current <= total &&
        total <= 60
      ) {
        return { current, total };
      }
    }
  }

  return undefined;
}
