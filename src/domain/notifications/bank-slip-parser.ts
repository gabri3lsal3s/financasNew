/**
 * Parser puro de comprovantes de pagamento de Boletos Bancários, Títulos e Guias de Tributos.
 *
 * Suporta:
 * - Boletos bancários de cobrança (Febraban / Bancos comerciais).
 * - Boletos de concessionárias e convênios (água, luz, gás, telefone, internet).
 * - Guias de tributos federais, estaduais e municipais (DARF, GPS, DAS / Simples Nacional, IPVA, IPTU).
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import {
  cleanMerchantName,
  extractCentsFromText,
  extractDateFromReceipt,
  extractTaxId,
  isBlacklistedReceipt,
  resolveBankName,
} from "./bank-parser";
import { isPixReceipt } from "./pix-receipt-parser";
import type { UniversalReceiptData } from "./receipt-types";

/**
 * Verifica se o texto possui marcadores característicos de comprovante de boleto / tributo.
 */
export function isBankSlipReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Rejeita falhas e spam
  if (isBlacklistedReceipt(text)) return false;

  // Se for explicitamente um Pix, não deve ser classificado como boleto
  if (isPixReceipt(text)) return false;

  const boletoMarkers = [
    /\bcomprovante\s+(?:de\s+pagamento\s+de\s+|de\s+liquida[çc][ãa]o\s+de\s+)?(?:boleto|t[íi]tulo|concession[áa]ria|conv[êe]nio|arrecada[çc][ãa]o)\b/i,
    /\bpagamento\s+(?:de\s+)?(?:boleto|t[íi]tulo|concession[áa]ria|conv[êe]nio|tributo|darf|gps|das)\b/i,
    /\b(?:linha\s+digit[áa]vel|c[óo]digo\s+de\s+barras)\b/i,
    /\b(?:comprovante\s+de\s+pagamento\s*-\s*darf|documento\s+de\s+arrecada[çc][ãa]o\s+de\s+receitas\s+federais)\b/i,
    /\b(?:guia\s+da\s+previd[êe]ncia\s+social|comprovante\s+gps)\b/i,
    /\b(?:benefici[áa]rio|cedente)\s*(?:original)?:\s*[^\n\r]+/i,
  ];

  let matches = 0;
  for (const rx of boletoMarkers) {
    if (rx.test(lower)) {
      matches++;
      if (
        matches >= 1 &&
        (lower.includes("boleto") ||
          lower.includes("título") ||
          lower.includes("titulo") ||
          lower.includes("linha digitável") ||
          lower.includes("código de barras") ||
          lower.includes("darf") ||
          lower.includes("gps") ||
          lower.includes("tributo") ||
          lower.includes("convênio") ||
          lower.includes("convenio") ||
          lower.includes("concessionária") ||
          lower.includes("concessionaria"))
      ) {
        return true;
      }
    }
  }

  // Detecção por linha digitável padrão Febraban de 47/48 dígitos
  if (/\b\d{5}[.-]?\d{5}\s+\d{5}[.-]?\d{6}\s+\d{5}[.-]?\d{6}\s+\d\s+\d{14}\b/.test(text)) {
    return true;
  }
  // Linha digitável de concessionárias (4 blocos de 11 ou 12 dígitos)
  if (/\b\d{11,12}[-\s]?\d{11,12}[-\s]?\d{11,12}[-\s]?\d{11,12}\b/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Extrai a linha digitável ou código de barras do boleto/guia.
 */
export function extractDigitableLine(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Linha digitável de boleto bancário padrão Febraban (47 dígitos)
  // Ex: 00190.00009 01234.567802 01234.567802 1 89010000015000
  const febrabanMatch =
    /\b(\d{5}[.-]?\d{5}\s+\d{5}[.-]?\d{6}\s+\d{5}[.-]?\d{6}\s+\d\s+\d{10,14})\b/.exec(
      text,
    );
  if (febrabanMatch && febrabanMatch[1]) {
    return febrabanMatch[1].trim();
  }

  // 2. Linha digitável de concessionárias/tributos (48 dígitos, 4 blocos de 11 ou 12)
  // Ex: 84670000001-4 23450067008-9 12345678901-2 34567890123-4
  const utilityMatch =
    /\b(\d{11,12}[-.\s]\d{1,2}\s+\d{11,12}[-.\s]\d{1,2}\s+\d{11,12}[-.\s]\d{1,2}\s+\d{11,12}[-.\s]\d{1,2})\b/.exec(
      text,
    );
  if (utilityMatch && utilityMatch[1]) {
    return utilityMatch[1].trim();
  }

  // 3. Rótulo explícito "Linha digitável: ..." ou "Código de barras: ..."
  const labeledMatch =
    /(?:Linha\s+digit[áa]vel|C[óo]digo\s+de\s+barras)\s*[:=]?\s*([0-9. -]{30,60})/i.exec(
      text,
    );
  if (labeledMatch && labeledMatch[1]) {
    const raw = labeledMatch[1].trim();
    if (raw.replace(/\D/g, "").length >= 30) {
      return raw;
    }
  }

  return undefined;
}

/**
 * Extrai o beneficiário / cedente do boleto ou órgão arrecadador.
 */
export function extractBankSlipBeneficiary(text: string): string {
  if (!text) return "";

  // 1. Identificação de tributos federais
  if (/\b(?:DARF|RECEITA\s+FEDERAL|MINIST[ÉE]RIO\s+DA\s+FAZENDA)\b/i.test(text)) {
    return "Receita Federal (DARF)";
  }
  if (/\b(?:GPS|PREVID[ÊE]NCIA\s+SOCIAL|INSS)\b/i.test(text)) {
    return "Previdência Social (GPS)";
  }
  if (/\b(?:DAS\s+SIMPLES|SIMPLES\s+NACIONAL)\b/i.test(text)) {
    return "Simples Nacional (DAS)";
  }

  // 2. Beneficiário ou Cedente explícito
  const match =
    /(?:Benefici[áa]rio(?:\s+Final)?|Cedente|Raz[ãa]o\s+Social|Empresa(?:\s+Conveniada)?|Concession[áa]ria|Nome\s+da\s+Empresa)\s*[:=]\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 3 && !/^(?:n[ãa]o\s+informado|-+)$/i.test(candidate)) {
      return cleanMerchantName(candidate);
    }
  }

  // 3. Fallback: Concessionárias famosas citadas no texto
  const utilityVendors = [
    { regex: /\b(?:enel|eletropaulo|cpfl|cemig|copel|light|coelba|energisa)\b/i, name: "Energia Elétrica" },
    { regex: /\b(?:sabesp|copasa|sanepar|cedae|caesb|embasa|saneago)\b/i, name: "Água e Esgoto" },
    { regex: /\b(?:comgas|naturgy|sulgas)\b/i, name: "Gás Encanado" },
    { regex: /\b(?:vivo|claro|tim|oi|embratel)\b/i, name: "Telecom / Telefonia" },
  ];

  for (const { regex, name } of utilityVendors) {
    if (regex.test(text)) {
      // Se conseguir extrair o nome exato da linha
      const lineMatch = new RegExp(`^.*${regex.source}.*$`, "im").exec(text);
      if (lineMatch && lineMatch[0]) {
        return cleanMerchantName(lineMatch[0].trim());
      }
      return name;
    }
  }

  return "";
}

/**
 * Extrai o pagador / sacado do boleto bancário.
 */
export function extractBankSlipPayer(text: string): string {
  if (!text) return "";

  const match =
    /(?:Pagador|Sacado|Nome\s+do\s+Cliente|Cliente|Devedor)\s*[:=]?\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 3 && !/^(?:n[ãa]o\s+informado|-+)$/i.test(candidate)) {
      return cleanMerchantName(candidate);
    }
  }
  return "";
}

/**
 * Extrai a data de vencimento do boleto, se informada no comprovante.
 */
export function extractBankSlipDueDate(text: string): string | undefined {
  const match =
    /(?:Vencimento|Data\s+de\s+Vencimento|Data\s+Vencimento|Venc)\s*[:=]?\s*(\d{2})[/.-](\d{2})[/.-](\d{4})/i.exec(
      text,
    );
  if (match && match[1] && match[2] && match[3]) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return undefined;
}

/**
 * Executa o parsing especializado de um comprovante de pagamento de boleto / tributo.
 */
export function parseBankSlipReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  if (isBlacklistedReceipt(rawText)) return null;

  const cents = extractCentsFromText(rawText);
  if (!cents || cents <= 0) return null;

  // Extrai data de pagamento (efetivação)
  const { date: paymentDate } = extractDateFromReceipt(rawText, false);
  const dueDate = extractBankSlipDueDate(rawText);

  // Beneficiário e Pagador
  const beneficiary = extractBankSlipBeneficiary(rawText);
  const payer = extractBankSlipPayer(rawText);
  const taxId = extractTaxId(rawText);
  const digitableLine = extractDigitableLine(rawText);

  // Resolução do banco processador / arrecadador
  const headerLines = rawText.split(/[\r\n]+/).slice(0, 4).join(" ");
  let bankName = resolveBankName(undefined, undefined, headerLines);
  if (!bankName) {
    bankName = resolveBankName(undefined, undefined, rawText) || "Boleto Bancário";
  }

  // Descrição limpa e informativa
  let description: string;
  if (beneficiary) {
    if (/\b(?:darf|receita\s+federal)\b/i.test(rawText)) {
      description = `DARF: ${beneficiary}`;
    } else if (/\b(?:gps|inss)\b/i.test(rawText)) {
      description = `GPS: ${beneficiary}`;
    } else {
      description = `Boleto: ${beneficiary}`;
    }
  } else {
    description = `Pagamento de Boleto (${bankName})`;
  }

  const idSuffix = digitableLine
    ? digitableLine.replace(/[^0-9]/g, "").slice(-12)
    : `${Date.now()}_${cents}`;
  const id = `bank_slip_${idSuffix}`;

  return {
    id,
    kind: "bank_slip_payment",
    nature: "expense",
    amountCents: cents,
    date: paymentDate || toISODate(new Date()),
    dueDate,
    description,
    paymentMethod: "other",
    merchantOrBeneficiary: beneficiary || undefined,
    payerOrSource: payer || undefined,
    taxId,
    bankName,
    barcodeOrDigitableLine: digitableLine,
    rawCleanText: rawText,
  };
}
