/**
 * Normalizador espacial de comprovantes, boletos e cupons fiscais em PDF digital.
 *
 * Reutiliza `SpatialPdfLine` (coordenadas X/Y de `domain/reconciliation`) para reconstruir
 * o texto na ordem visual correta de leitura e ranquear páginas candidatas em PDFs multi-página
 * (ex.: boleto com demonstrativo na página 1 e ficha de compensação na página 2).
 *
 * Função 100% pura: sem dependências de UI, DOM ou rede.
 */

import type { SpatialPdfLine } from "@/domain/reconciliation";

const RECEIPT_CANDIDATE_KEYWORDS_REGEX =
  /\b(?:linha\s+digit[áa]vel|c[óo]digo\s+de\s+barras|ficha\s+de\s+compensa[çc][ãa]o|valor\s+(?:do\s+documento|pago|a\s+pagar|total)|benefici[áa]rio|cedente|vencimento|comprovante|pix|danfe|nfc-e|cupom\s+fiscal|chave\s+de\s+acesso)\b/gi;

const RECEIPT_MONETARY_REGEX = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/i;
const RECEIPT_BARCODE_LINE_REGEX =
  /\b(?:\d{5}[.-]?\d{5}\s+\d{5}[.-]?\d{6}\s+\d{5}[.-]?\d{6}\s+\d\s+\d{10,14}|\d{11,12}[-.\s]\d\s+\d{11,12}[-.\s]\d\s+\d{11,12}[-.\s]\d\s+\d{11,12}[-.\s]\d|\d{44,48})\b/;

/**
 * Reconstrói o texto de comprovante/boleto preservando a ordem de páginas e leitura top-down,
 * mantendo campos na mesma linha visual separados por espaço duplo para evitar concatenação colada.
 */
export function reconstructSpatialReceiptText(lines: readonly SpatialPdfLine[]): string {
  if (!lines || lines.length === 0) return "";

  const sorted = [...lines].sort((a, b) => {
    const pageDiff = (a.pageNumber ?? 1) - (b.pageNumber ?? 1);
    if (pageDiff !== 0) return pageDiff;
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.xStart - b.xStart;
  });

  const rows: string[] = [];
  let currentPage = sorted[0]?.pageNumber ?? 1;
  let currentY = sorted[0]?.y ?? 0;
  let currentParts: string[] = [];

  for (const line of sorted) {
    const clean = line.text.trim();
    if (!clean) continue;

    const linePage = line.pageNumber ?? 1;
    const sameVisualRow = linePage === currentPage && Math.abs(line.y - currentY) <= 3;

    if (sameVisualRow) {
      currentParts.push(clean);
    } else {
      if (currentParts.length > 0) {
        rows.push(currentParts.join("  "));
      }
      currentPage = linePage;
      currentY = line.y;
      currentParts = [clean];
    }
  }

  if (currentParts.length > 0) {
    rows.push(currentParts.join("  "));
  }

  return rows.join("\n").trim();
}

function scoreReceiptPageText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let score = 0;
  const keywordMatches = trimmed.match(RECEIPT_CANDIDATE_KEYWORDS_REGEX);
  if (keywordMatches) score += keywordMatches.length * 10;
  if (RECEIPT_BARCODE_LINE_REGEX.test(trimmed)) score += 35;
  if (RECEIPT_MONETARY_REGEX.test(trimmed)) score += 15;
  if (trimmed.length >= 60) score += 5;
  return score;
}

/**
 * Seleciona até `maxPages` páginas mais relevantes de um PDF de boleto/cupom/comprovante
 * para envio ao fallback Vision (ex.: prioriza a página com código de barras ou totais).
 */
export function selectCandidateReceiptVisionPages(
  pageTexts: readonly string[],
  totalPages?: number,
  maxPages = 2,
): number[] {
  const effectiveTotal = Math.max(
    1,
    totalPages && totalPages > 0 ? totalPages : pageTexts.length || 1,
  );
  const cap = Math.max(1, Math.min(maxPages, effectiveTotal));

  if (pageTexts.length === 0) {
    return Array.from({ length: cap }, (_, idx) => idx + 1);
  }

  const scored = pageTexts.map((txt, idx) => ({
    page: idx + 1,
    score: scoreReceiptPageText(txt),
  }));

  const hasSignal = scored.some((item) => item.score > 0);
  if (!hasSignal) {
    return Array.from({ length: cap }, (_, idx) => idx + 1);
  }

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.page - b.page));
  const selected = scored.slice(0, cap).map((item) => item.page);

  // Garante página 1 inclusa quando houver espaço ou em empate para manter cabeçalho/emissor
  if (cap >= 2 && !selected.includes(1) && effectiveTotal > 1) {
    selected[selected.length - 1] = 1;
  }

  return [...new Set(selected)].sort((a, b) => a - b);
}
