/**
 * Extrator e motor puro de identificação de parcelamento em comprovantes e notas.
 *
 * Suporta múltiplos formatos brasileiros:
 * 1. Multiplicador com valor de parcela (ex.: "em 3x de R$ 50,00", "3 x R$ 50,00").
 * 2. Total com quantidade de parcelas (ex.: "R$ 300,00 em 3x", "PARC: 03", "QTDE PARCELAS: 3").
 * 3. Parcela isolada de controle contínuo (ex.: "Parcela 02/10 de R$ 45,00", "PARC 02 DE 10").
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import type { ParsedInstallmentData } from "./receipt-types";

/**
 * Converte string com formato monetário ("42,90", "1.250,50", "R$ 50,00") em centavos inteiros.
 */
function parseCents(wholeStr: string, fractionStr: string): number {
  const whole = parseInt(wholeStr.replace(/\./g, ""), 10);
  const fraction = parseInt(fractionStr, 10);
  return whole * 100 + fraction;
}

/**
 * Extrai dados estruturados de parcelamento a partir do texto do comprovante.
 *
 * @param text Texto normalizado do comprovante
 * @param fallbackAmountCents Valor monetário de referência (ex: valor total do comprovante)
 */
export function extractDetailedInstallments(
  text: string,
  fallbackAmountCents: number | null = null,
): ParsedInstallmentData | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // =========================================================================
  // CASO 1: Parcela isolada periódica (ex: "Parcela 2/10 de R$ 45,00", "PARC 02/10")
  // =========================================================================
  const isolatedMatch =
    /\b(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})(?:[\s-]+(?:de\s+)?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2}))?\b/i.exec(
      text,
    );

  if (isolatedMatch && isolatedMatch[1] && isolatedMatch[2]) {
    const current = parseInt(isolatedMatch[1], 10);
    const total = parseInt(isolatedMatch[2], 10);

    if (current >= 1 && total >= current && total <= 60) {
      let amountCents = fallbackAmountCents ?? 0;
      if (isolatedMatch[3] && isolatedMatch[4]) {
        amountCents = parseCents(isolatedMatch[3], isolatedMatch[4]);
      }

      return {
        count: total,
        currentInstallment: current,
        installmentAmountCents: amountCents,
        totalAmountCents: amountCents,
        isNewFinancedPurchase: false,
      };
    }
  }

  // =========================================================================
  // CASO 2: Multiplicador com valor de parcela (ex: "em 3x de R$ 50,00", "3 x 50,00", "3 parcelas de R$ 50,00")
  // =========================================================================
  const multiplierMatch =
    /\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\s*(?:de\s+)?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\b/i.exec(
      text,
    );

  if (multiplierMatch && multiplierMatch[1] && multiplierMatch[2] && multiplierMatch[3]) {
    const count = parseInt(multiplierMatch[1], 10);
    if (count >= 2 && count <= 60) {
      const instCents = parseCents(multiplierMatch[2], multiplierMatch[3]);
      if (Number.isFinite(instCents) && instCents > 0) {
        return {
          count,
          installmentAmountCents: instCents,
          totalAmountCents: count * instCents,
          isNewFinancedPurchase: true,
        };
      }
    }
  }

  // =========================================================================
  // CASO 3: Padrão de Maquininhas POS / TEF (ex: "PARC: 03", "QTDE PARCELAS: 3", "PARCELAS: 03", "PARC 03/03")
  // =========================================================================
  const posMatch =
    /(?:PARC(?:ELAS?)?|QTDE\s+PARC(?:ELAS?)?|NUMERO\s+DE\s+PARCELAS)\s*[:=]?\s*(\d{1,2})[xX]?(?:\/\d{1,2})?\b/i.exec(
      text,
    );

  if (posMatch && posMatch[1]) {
    const count = parseInt(posMatch[1], 10);
    if (count >= 2 && count <= 60 && fallbackAmountCents && fallbackAmountCents > 0) {
      const instCents = Math.round(fallbackAmountCents / count);
      return {
        count,
        totalAmountCents: fallbackAmountCents,
        installmentAmountCents: instCents,
        isNewFinancedPurchase: true,
      };
    }
  }

  // =========================================================================
  // CASO 4: Quantidade de parcelas vinculada a valor total ("R$ 300,00 em 3x", "parcelado em 3x", "(3x)")
  // =========================================================================
  const countOnlyMatch =
    /\b(?:em|parcelad[ao]\s+em)\s+(\d{1,2})\s*(?:x|vezes|parcelas)\b|\((\d{1,2})x\)/i.exec(text);

  if (countOnlyMatch) {
    const countStr = countOnlyMatch[1] || countOnlyMatch[2];
    if (countStr) {
      const count = parseInt(countStr, 10);
      if (count >= 2 && count <= 60 && fallbackAmountCents && fallbackAmountCents > 0) {
        return {
          count,
          totalAmountCents: fallbackAmountCents,
          installmentAmountCents: Math.round(fallbackAmountCents / count),
          isNewFinancedPurchase: true,
        };
      }
    }
  }

  return null;
}
