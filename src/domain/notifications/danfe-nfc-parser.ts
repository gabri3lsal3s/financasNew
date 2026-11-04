/**
 * Parser puro de cupons fiscais eletrônicos ao consumidor (DANFE NFC-e e Extrato SAT CF-e).
 *
 * Suporta emissões fiscais brasileiras:
 * - NFC-e (Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica - Modelo 65).
 * - Extrato SAT CF-e (Sistema Autenticador e Transmissor de Cupons Fiscais Eletrônicos - Modelo 59).
 * - Extração de Razão Social / Nome Fantasia do emitente, CNPJ, Chave de Acesso (44 dígitos),
 *   valor total a pagar e forma de liquidação (Crédito, Débito, Pix, Dinheiro).
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import type { PaymentMethod } from "@/types/schema";
import {
  cleanMerchantName,
  extractCentsFromText,
  extractDateFromReceipt,
  extractTaxId,
  isBlacklistedReceipt,
} from "./bank-parser";
import { cleanAcquirerPrefixes } from "./merchant-catalog";
import type { UniversalReceiptData } from "./receipt-types";

/**
 * Verifica se o texto possui marcadores característicos de cupom fiscal eletrônico (NFC-e / SAT).
 */
export function isDanfeNfcReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  if (isBlacklistedReceipt(text)) return false;

  const nfcMarkers = [
    /\bdanfe\s+(?:nfc-e|nfce)\b/i,
    /\bdocumento\s+auxiliar\s+da\s+nota\s+fiscal\s+(?:de\s+consumidor\s+)?eletr[ôo]nica\b/i,
    /\bextrato\s+(?:sat|cf-e-sat|cfe-sat)\b/i,
    /\bcupom\s+fiscal\s+eletr[ôo]nico\b/i,
    /\bnfc-e\s+n[ºo°]/i,
    /\bchave\s+de\s+acesso\s*:\s*(?:\d{4}\s*){11}/i,
    /\bprotocolo\s+de\s+autoriza[çc][ãa]o\s*:\s*\d{15}/i,
  ];

  for (const rx of nfcMarkers) {
    if (rx.test(lower)) return true;
  }

  // Verifica menção conjunta de nota/cupom + valor a pagar + chave de acesso
  if (
    /\b(?:nfc-e|sat|cf-e|cupom\s+fiscal)\b/i.test(lower) &&
    /\b(?:valor\s+a\s+pagar|total\s+r\$|forma\s+de\s+pagamento)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Extrai a Chave de Acesso oficial da NFC-e / SAT (44 dígitos numéricos).
 */
export function extractDanfeAccessKey(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Chave de acesso formatada em grupos de 4 dígitos: "3526 1047 5084 ..."
  const spacedMatch =
    /(?:CHAVE\s+DE\s+ACESSO|CHAVE)[\s:.-]*((?:\d{4}[\s.-]?){11})/i.exec(text);
  if (spacedMatch && spacedMatch[1]) {
    const raw = spacedMatch[1].replace(/\D/g, "");
    if (raw.length === 44) return raw;
  }

  // 2. Sequência de 44 dígitos contínuos no texto
  const raw44Match = /\b(\d{44})\b/.exec(text);
  if (raw44Match && raw44Match[1]) {
    return raw44Match[1];
  }

  return undefined;
}

/**
 * Detecta o meio de pagamento utilizado na NFC-e / Cupom Fiscal.
 */
export function detectDanfePaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();

  if (/\b(?:cart[ãa]o\s+de\s+cr[ée]dito|cr[ée]dito)\b/i.test(lower)) {
    return "credit_card";
  }
  if (/\b(?:cart[ãa]o\s+de\s+d[ée]bito|d[ée]bito)\b/i.test(lower)) {
    return "debit";
  }
  if (/\bpix\b/i.test(lower)) {
    return "pix";
  }
  if (/\b(?:dinheiro|esp[ée]cie)\b/i.test(lower)) {
    return "cash";
  }
  if (/\b(?:vale\s+refei[çc][ãa]o|vale\s+alimenta[çc][ãa]o|vr|va|sodexo|alelo|ticket)\b/i.test(lower)) {
    return "other";
  }

  return "other";
}

/**
 * Remove sufixos societários e fiscais de razões sociais brasileiras (LTDA, S/A, ME, EPP, etc.).
 */
export function cleanCorporateSuffixes(name: string): string {
  if (!name) return "";
  return name
    .replace(/\b(?:LTDA|LIMITADA|S[/.]?A\.?|ME|EPP|EIRELI|CIA|COMPANHIA|MEI)\b/gi, "")
    .replace(/\s*-\s*ME\b/gi, "")
    .replace(/\s*-\s*EPP\b/gi, "")
    .replace(/\s*-\s*LTDA\b/gi, "")
    .replace(/\s*-\s*EIRELI\b/gi, "")
    .replace(/[\s.-]+$/, "")
    .replace(/^[\s.-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai a razão social ou nome fantasia do estabelecimento emissor da NFC-e.
 */
export function extractDanfeIssuer(text: string): string {
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

  // 1. Procura rótulos explícitos
  const labelMatch =
    /(?:EMITENTE|RAZ[ÃA]O\s+SOCIAL|NOME\s+FANTASIA)[\s:.-]*([^\n\r]+)/i.exec(text);
  if (labelMatch && labelMatch[1]) {
    const candidate = labelMatch[1].trim();
    if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
      return cleanCorporateSuffixes(cleanMerchantName(candidate));
    }
  }

  // 2. Os cupons fiscais colocam a Razão Social ou Nome Fantasia nas primeiras 5 linhas
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignora títulos operacionais de documentos
    if (
      /^(?:danfe|documento\s+auxiliar|extrato|cupom|nfc-e|sat|cf-e|via\s+consumidor|via\s+cliente|n[ãa]o\s+[ée]\s+documento\s+fiscal)/i.test(
        line,
      )
    ) {
      continue;
    }
    // Ignora CNPJ, CPF ou Inscrição Estadual isolada
    if (/\b\d{2}\.\d{3}\.\d{3}\b|\bIE\s*:\s*\d+|\bCNPJ\b|\bCPF\b/i.test(line)) {
      continue;
    }
    // Ignora endereços óbvios (Rua, Av, etc.)
    if (/^(?:rua|av\b|avenida|alameda|rodovia|estrada|praca|pra[çc]a|cep)\b/i.test(line)) {
      continue;
    }

    if (line.length >= 3 && !/^\d+$/.test(line)) {
      const cleaned = cleanCorporateSuffixes(cleanAcquirerPrefixes(cleanMerchantName(line)));
      if (cleaned.length >= 3) {
        return cleaned;
      }
    }
  }

  return "";
}

/**
 * Extrai o valor total a pagar declarado na NFC-e / SAT através de busca reversa (Bottom-Up).
 * Varrida do final para o início isola os totalizadores fiscais da SEFAZ, eliminando
 * conflitos com subtotais de itens parciais, troco, descontos ou contadores de itens.
 */
export function extractDanfeTotalCents(text: string): number | null {
  if (!text) return null;

  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  // Filtro de linhas a ignorar (troco, contadores, descontos parciais, tributos)
  const isIgnoredLine = (line: string): boolean => {
    return (
      /\b(?:troco|troco\s+r\$)\b/i.test(line) ||
      /\b(?:qtd|quantidade)\s+(?:total\s+de\s+)?itens\b/i.test(line) ||
      /\b(?:tributos|lei\s+12\.741|ibpt)\b/i.test(line)
    );
  };

  // 1ª Passagem: Prioridade A — "VALOR A PAGAR" ou "TOTAL A PAGAR" (do final para o início)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (isIgnoredLine(line)) continue;

    const matchA = line.match(
      /(?:VALOR\s+A\s+PAGAR|TOTAL\s+A\s+PAGAR)\s*[:=]?\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
    );
    if (matchA && matchA[1]) {
      const cents = extractCentsFromText(matchA[1]);
      if (cents && cents > 0) return cents;
    }

    // Suporte a valor na linha seguinte:
    // Linha N: "VALOR A PAGAR R$"
    // Linha N+1: "150,00"
    if (/(?:VALOR\s+A\s+PAGAR|TOTAL\s+A\s+PAGAR)\s*[:=]?\s*R?\$?$/i.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]!;
      const nextCents = extractCentsFromText(nextLine);
      if (nextCents && nextCents > 0) return nextCents;
    }
  }

  // 2ª Passagem: Prioridade B — "TOTAL LIQUIDO" ou "VALOR LIQUIDO" (do final para o início)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (isIgnoredLine(line)) continue;

    const matchB = line.match(
      /(?:TOTAL\s+L[ÍI]QUIDO|VALOR\s+L[ÍI]QUIDO)\s*[:=]?\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
    );
    if (matchB && matchB[1]) {
      const cents = extractCentsFromText(matchB[1]);
      if (cents && cents > 0) return cents;
    }
  }

  // 3ª Passagem: Prioridade C — "VALOR TOTAL" ou "TOTAL R$" ou "TOTAL:" (do final para o início)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (isIgnoredLine(line)) continue;

    const matchC = line.match(
      /(?:VALOR\s+TOTAL(?:\s+R\$)?|TOTAL\s+R\$|TOTAL\s*[:=])\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
    );
    if (matchC && matchC[1]) {
      const cents = extractCentsFromText(matchC[1]);
      if (cents && cents > 0) return cents;
    }
  }

  // 4ª Passagem: Procura qualquer linha que comece com R$ na parte final do cupom
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i]!;
    if (isIgnoredLine(line)) continue;

    const matchD = line.match(
      /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
    );
    if (matchD && matchD[1]) {
      const cents = extractCentsFromText(matchD[1]);
      if (cents && cents > 0) return cents;
    }
  }

  // 5. Fallback geral de segurança
  return extractCentsFromText(text);
}

/**
 * Executa o parsing especializado de um cupom fiscal NFC-e ou SAT.
 */
export function parseDanfeNfcReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  if (isBlacklistedReceipt(rawText)) return null;

  const cents = extractDanfeTotalCents(rawText);
  if (!cents || cents <= 0) return null;

  const paymentMethod = detectDanfePaymentMethod(rawText);
  const issuer = extractDanfeIssuer(rawText);
  const taxId = extractTaxId(rawText);
  const accessKey = extractDanfeAccessKey(rawText);
  const { date: issueDate } = extractDateFromReceipt(rawText, false);

  const description = issuer ? issuer : "Cupom Fiscal NFC-e";
  const idSuffix = accessKey ? accessKey.slice(-12) : `${Date.now()}_${cents}`;
  const id = `danfe_${idSuffix}`;

  return {
    id,
    kind: "invoice_danfe",
    nature: "expense",
    amountCents: cents,
    date: issueDate || toISODate(new Date()),
    description,
    paymentMethod,
    merchantOrBeneficiary: issuer || undefined,
    taxId,
    nfeAccessKey: accessKey,
    rawCleanText: rawText,
  };
}
