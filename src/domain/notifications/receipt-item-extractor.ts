/**
 * Extrator especializado e puro de itens de cupons fiscais e tickets de compra.
 *
 * Analisa linhas de produtos em cupons fiscais brasileiros (NFC-e, SAT, ECF, PDV)
 * extraindo código, descrição, quantidade, valor unitário em centavos e valor total.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { formatCentsAsCurrency } from "@/services/masks/money";
import { extractCentsFromText } from "./bank-parser";
import type { ReceiptItem } from "./receipt-types";

/**
 * Normaliza valores com vírgula ou ponto em centavos inteiros.
 */
function parseCentsCandidate(valStr: string): number {
  if (!valStr) return 0;
  const cleaned = valStr.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return 0;

  // Se terminar com 3 zeros decimais (ex: 6,000 -> 6,00 -> 600 cents)
  if (/[.,]\d{3}$/.test(cleaned)) {
    const parts = cleaned.split(/[.,]/);
    const intPart = parseInt(parts[0] || "0", 10);
    const decPart = (parts[1] || "").slice(0, 2).padEnd(2, "0");
    return intPart * 100 + parseInt(decPart, 10);
  }

  const commaIdx = cleaned.lastIndexOf(",");
  const dotIdx = cleaned.lastIndexOf(".");
  const sepIdx = Math.max(commaIdx, dotIdx);

  if (sepIdx !== -1 && (sepIdx === cleaned.length - 3 || sepIdx === cleaned.length - 2)) {
    const intPart = parseInt(cleaned.slice(0, sepIdx).replace(/\D/g, "") || "0", 10);
    const decPart = cleaned.slice(sepIdx + 1).padEnd(2, "0").slice(0, 2);
    return intPart * 100 + parseInt(decPart, 10);
  }

  // Se for valor sem pontuação de 3 a 6 dígitos (ex: 1990 -> 1990 centavos, 3980 -> 3980 centavos)
  if (/^\d{3,6}$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }

  return extractCentsFromText(valStr) ?? 0;
}

/**
 * Limpa o nome do produto descartando fragmentos mecânicos de OCR.
 */
function cleanItemDescription(name: string): string {
  return name
    .replace(/^[-—:*~.\s]+/, "")
    .replace(/[-—:*~.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai a lista de itens e produtos discriminados no comprovante.
 */
export function extractReceiptItems(rawText: string): ReceiptItem[] {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const items: ReceiptItem[] = [];
  const processedLineIndices = new Set<number>();

  // Padrão 1: Duas linhas consecutivas (Comprovante Adicional / PDV)
  // Linha 1: "38 CERVEJA LONGNECK UN"
  // Linha 2: "1,000 x R$ 6,000 => R$ 6,000"
  for (let i = 0; i < lines.length - 1; i++) {
    if (processedLineIndices.has(i) || processedLineIndices.has(i + 1)) continue;

    const lineCurrent = lines[i]!;
    const lineNext = lines[i + 1]!;

    const calcMatch = lineNext.match(
      /([0-9]+(?:[.,][0-9]+)?)\s*(?:UN|UM|KG|LT)?\s*[xX]\s*R?\$?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*(?:=>|->|=|R\$)\s*R?\$?\s*([0-9]+(?:[.,][0-9]+)?))?/i,
    );

    if (calcMatch) {
      const descLine = lineCurrent.replace(/^\d+\s+/, "").replace(/\s+(?:UN|UM|KG|LT)\b/i, "");
      const cleanDesc = cleanItemDescription(descLine);

      if (cleanDesc.length >= 2 && !/^(?:TOTAL|SUBTOTAL|DESCONTO|VALOR)/i.test(cleanDesc)) {
        const qtyRaw = parseFloat((calcMatch[1] ?? "1").replace(",", "."));
        const unitCents = parseCentsCandidate(calcMatch[2] ?? "0");
        const totalCents = calcMatch[3]
          ? parseCentsCandidate(calcMatch[3])
          : Math.round(qtyRaw * unitCents);

        if (totalCents > 0 || unitCents > 0) {
          items.push({
            description: cleanDesc,
            quantity: Math.max(1, Math.round(qtyRaw)),
            unitPriceCents: unitCents || totalCents,
            totalPriceCents: totalCents || unitCents,
          });
          processedLineIndices.add(i);
          processedLineIndices.add(i + 1);
          continue;
        }
      }
    }
  }

  // Padrão 2: ECF Clássico (Daruma/Bematech)
  // "001 21259003 DESOD SANIT PINH-SANIFECT -35G"
  // "1X1,09 717,00% 1,09"
  for (let i = 0; i < lines.length - 1; i++) {
    if (processedLineIndices.has(i) || processedLineIndices.has(i + 1)) continue;

    const lineCurrent = lines[i]!;
    const lineNext = lines[i + 1]!;

    const ecfItemHeader = lineCurrent.match(/^(?:\(?\d{3}\)?)\s+(?:\d{5,14}\s+)?([A-Za-z0-9\s\-+*./]+)$/i);
    const ecfCalcLine = lineNext.match(/^([0-9]+(?:[.,][0-9]+)?)\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?).*?([0-9]+(?:[.,][0-9]+)?)\s*$/i);

    if (ecfItemHeader && ecfCalcLine && ecfItemHeader[1]) {
      const desc = cleanItemDescription(ecfItemHeader[1]);
      if (desc.length >= 2 && !/^(?:TOTAL|SUBTOTAL|IMPOSTOS|VALOR)/i.test(desc)) {
        const qty = parseFloat((ecfCalcLine[1] ?? "1").replace(",", "."));
        const unitCents = parseCentsCandidate(ecfCalcLine[2] ?? "0");
        const totalCents = parseCentsCandidate(ecfCalcLine[3] ?? "0");

        if (totalCents > 0 || unitCents > 0) {
          items.push({
            description: desc,
            quantity: Math.max(1, Math.round(qty)),
            unitPriceCents: unitCents,
            totalPriceCents: totalCents,
          });
          processedLineIndices.add(i);
          processedLineIndices.add(i + 1);
        }
      }
    }
  }

  // Padrão 3: Linha Única NFC-e / Danfe
  // "3834 BOLAS COURO 2UN 1990 3980"
  // "Gbi69 FILTROLINHASTOM — GUN 3590 21540"
  // "— 5501 PULVERIZADOR 3UN 786 2397"
  for (let i = 0; i < lines.length; i++) {
    if (processedLineIndices.has(i)) continue;

    const line = lines[i]!;
    // Ignora linhas de totalizadores
    if (/(?:VALOR\s+A\s+PAGAR|TOTAL\s+A\s+PAGAR|TOTAL\s+R\$|SUBTOTAL|DESCONTO|TROCO|QUANTIDADE)/i.test(line)) {
      continue;
    }

    const nfcSingleMatch = line.match(
      /(?:^|[-—:\s]+)(?:[A-Za-z0-9]{3,8}\s+)?([A-Za-zÀ-ÿ0-9\s/]+?)\s+([0-9]{1,3})\s*(?:UN|UM|KG|PC|CX)?\s+([0-9]{2,5})\s+([0-9]{2,5})\s*$/i,
    );

    if (nfcSingleMatch && nfcSingleMatch[1] && nfcSingleMatch[2] && nfcSingleMatch[3] && nfcSingleMatch[4]) {
      const desc = cleanItemDescription(nfcSingleMatch[1]);
      if (desc.length >= 3 && !/^(?:total|subtotal|desconto|acrescimo|dinheiro|debito|credito)/i.test(desc)) {
        const qty = parseInt(nfcSingleMatch[2], 10);
        const unitCents = parseCentsCandidate(nfcSingleMatch[3]);
        const totalCents = parseCentsCandidate(nfcSingleMatch[4]);

        if (totalCents > 0) {
          // Evita duplicar se já foi adicionado
          if (!items.some((it) => it.description.toLowerCase() === desc.toLowerCase())) {
            items.push({
              description: desc,
              quantity: Math.max(1, qty),
              unitPriceCents: unitCents,
              totalPriceCents: totalCents,
            });
            processedLineIndices.add(i);
          }
        }
      }
    }
  }

  return items;
}

/**
 * Formata a lista de itens discriminados para o campo de observações da transação.
 */
export function formatReceiptItemsObservation(items: ReceiptItem[]): string {
  if (!items || items.length === 0) return "";

  const formattedItems = items.map((it) => {
    const totalStr = formatCentsAsCurrency(it.totalPriceCents).replace(/\u00A0/g, " ");
    return `${it.quantity}x ${it.description} (${totalStr})`;
  });

  return `Itens do Cupom: ${formattedItems.join(" · ")}`;
}
