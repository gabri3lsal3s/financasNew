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
      return cleanMerchantName(candidate);
    }
  }

  // 2. Os cupons fiscais colocam a Razão Social ou Nome Fantasia nas 3 primeiras linhas
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignora títulos de documentos
    if (
      /^(?:danfe|documento\s+auxiliar|extrato|cupom|nfc-e|sat|via\s+consumidor)/i.test(
        line,
      )
    ) {
      continue;
    }
    // Ignora CNPJ ou Inscrição Estadual isolada
    if (/\b\d{2}\.\d{3}\.\d{3}\b|\bIE\s*:\s*\d+/i.test(line)) {
      continue;
    }
    if (line.length >= 3 && !/^\d+$/.test(line)) {
      return cleanAcquirerPrefixes(cleanMerchantName(line));
    }
  }

  return "";
}

/**
 * Extrai o valor total a pagar declarado na NFC-e (TOTAL R$, VALOR A PAGAR).
 */
export function extractDanfeTotalCents(text: string): number | null {
  // 1. Linhas explícitas de total: "VALOR A PAGAR R$ 120,50", "TOTAL R$ 120,50"
  const totalMatch =
    /(?:VALOR\s+A\s+PAGAR|TOTAL\s+(?:A\s+PAGAR|R\$|LIQUIDO)|VALOR\s+TOTAL(?:\s+R\$)?)\s*[:=]?\s*R?\$?\s*([0-9.,]+)/i.exec(
      text,
    );
  if (totalMatch && totalMatch[1]) {
    const cents = extractCentsFromText(totalMatch[1]);
    if (cents && cents > 0) return cents;
  }

  // 2. Fallback geral
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
