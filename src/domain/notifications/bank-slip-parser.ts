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

import { toISODate } from "@/domain/money/parcelar";
import {
  cleanMerchantName,
  extractDateFromReceipt,
  extractTaxId,
  isBlacklistedReceipt,
  resolveBankName,
} from "./bank-parser";
import { parseBankSlipDigitableLine } from "./bank-slip-barcode";
import { extractSovereignReceiptAmountCents } from "./receipt-amount-scorer";
import { isPixReceipt } from "./pix-receipt-parser";
import { extractDetailedInstallments } from "./installment-extractor";
import { cleanCorporateSuffixes } from "./danfe-nfc-parser";
import type { UniversalReceiptData } from "./receipt-types";

/**
 * Verifica se o texto possui marcadores característicos de comprovante de boleto / tributo
 * ou ficha de compensação de boleto em aberto.
 */
export function isBankSlipReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Rejeita falhas e spam
  if (isBlacklistedReceipt(text)) return false;

  // Se for explicitamente um Pix, não deve ser classificado como boleto
  if (isPixReceipt(text)) return false;

  const boletoMarkers = [
    /\bcomprovante\s+(?:de\s+pagamento\s+de\s+|de\s+liquida[çc][ãa]o\s+de\s+)?(?:boleto|t[íi]tulo|concession[áa]ria|conv[êe]nio|arrecada[çc][ãa]o|carn[êe])\b/i,
    /\bpagamento\s+(?:de\s+)?(?:boleto|t[íi]tulo|concession[áa]ria|conv[êe]nio|tributo|darf|gps|das|carn[êe])\b/i,
    /\b(?:linha\s+digit[áa]vel|c[óo]digo\s+de\s+barras)\b/i,
    /\b(?:ficha\s+de\s+compensa[çc][ãa]o|recibo\s+do\s+(?:sacado|pagador)|pag[áa]vel\s+em\s+qualquer\s+banco|nosso\s+n[úu]mero)\b/i,
    /\b(?:comprovante\s+de\s+pagamento\s*-\s*darf|documento\s+de\s+arrecada[çc][ãa]o\s+de\s+receitas\s+federais)\b/i,
    /\b(?:guia\s+da\s+previd[êe]ncia\s+social|comprovante\s+gps)\b/i,
    /\b(?:benefici[áa]rio|cedente)\s*(?:original)?:\s*[^\n\r]+/i,
    /\b(?:carn[êe]|prestac[ãa]o|parcela\s+\d{1,2}\s+(?:de|\/)\s+\d{1,2})\b/i,
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
          lower.includes("carnê") ||
          lower.includes("carne") ||
          lower.includes("linha digitável") ||
          lower.includes("linha digitavel") ||
          lower.includes("código de barras") ||
          lower.includes("codigo de barras") ||
          lower.includes("ficha de compensação") ||
          lower.includes("ficha de compensacao") ||
          lower.includes("recibo do sacado") ||
          lower.includes("recibo do pagador") ||
          lower.includes("nosso número") ||
          lower.includes("nosso numero") ||
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
  if (/\b\d{5}[.-]?\d{5}\s+\d{5}[.-]?\d{6}\s+\d{5}[.-]?\d{6}\s+\d\s+\d{10,14}\b/.test(text)) {
    return true;
  }
  // Linha digitável de concessionárias (4 blocos de 11 ou 12 dígitos)
  if (/\b\d{11,12}[-\s]?\d{11,12}[-\s]?\d{11,12}[-\s]?\d{11,12}\b/.test(text)) {
    return true;
  }
  if (/\b\d{47,48}\b/.test(text)) {
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

  // 4. Sequência contínua ou em blocos de 47 ou 48 dígitos
  const continuousMatch = /\b(\d{47,48})\b/.exec(text);
  if (continuousMatch && continuousMatch[1]) {
    return continuousMatch[1].trim();
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
      return cleanCorporateSuffixes(cleanMerchantName(candidate));
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
      return cleanCorporateSuffixes(cleanMerchantName(candidate));
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

const PAID_SLIP_MARKERS_REGEX =
  /\b(?:comprovante\s+de\s+(?:pagamento|liquida[çc][ãa]o)|valor\s+pago|data\s+(?:do\s+|de\s+)?pagamento|pagamento\s+(?:efetuado|realizado)|autentica[çc][ãa]o(?:\s+banc[áa]ria)?|liquidado|pago\s+em)\b/i;

const OPEN_SLIP_MARKERS_REGEX =
  /\b(?:ficha\s+de\s+compensa[çc][ãa]o|recibo\s+do\s+(?:sacado|pagador)|pag[áa]vel\s+em\s+qualquer\s+banco|n[ãa]o\s+receber\s+ap[óo]s|instru[çc][õo]es\s+de\s+responsabilidade\s+do\s+benefici[áa]rio|nosso\s+n[úu]mero)\b/i;

function detectBankSlipDocumentStatus(text: string): "paid" | "pending_due" {
  if (PAID_SLIP_MARKERS_REGEX.test(text)) {
    return "paid";
  }
  if (OPEN_SLIP_MARKERS_REGEX.test(text)) {
    return "pending_due";
  }
  return "paid";
}

/**
 * Executa o parsing especializado de um comprovante de pagamento ou ficha de boleto / tributo.
 */
export function parseBankSlipReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  if (isBlacklistedReceipt(rawText)) return null;

  const documentStatus = detectBankSlipDocumentStatus(rawText);
  const digitableLine = extractDigitableLine(rawText);
  const decodedBarcode = digitableLine ? parseBankSlipDigitableLine(digitableLine) : null;
  const textAmountCents = extractSovereignReceiptAmountCents(rawText);

  const cents =
    documentStatus === "pending_due" &&
    decodedBarcode?.isValidChecksum &&
    decodedBarcode.amountCents &&
    decodedBarcode.amountCents > 0
      ? decodedBarcode.amountCents
      : textAmountCents && textAmountCents > 0
        ? textAmountCents
        : decodedBarcode?.amountCents ?? null;

  if (!cents || cents <= 0) return null;

  // Extrai data de pagamento (efetivação) e vencimento (texto ou fator Febraban)
  const { date: paymentDate } = extractDateFromReceipt(rawText, false);
  const dueDate = extractBankSlipDueDate(rawText) ?? decodedBarcode?.dueDate;

  // Beneficiário e Pagador
  const beneficiary =
    extractBankSlipBeneficiary(rawText) ||
    (decodedBarcode?.kind === "arrecadacao" ? decodedBarcode.segmentLabel ?? "" : "");
  const payer = extractBankSlipPayer(rawText);
  const taxId = extractTaxId(rawText);
  const installments = extractDetailedInstallments(rawText, cents);

  // Resolução do banco processador / arrecadador
  const headerLines = rawText.split(/[\r\n]+/).slice(0, 4).join(" ");
  let bankName = resolveBankName(undefined, undefined, headerLines);
  if (!bankName) {
    bankName =
      resolveBankName(undefined, undefined, rawText) ||
      decodedBarcode?.bankName ||
      "Boleto Bancário";
  }

  // Descrição limpa e informativa
  let description: string;
  if (beneficiary) {
    if (installments && installments.count > 1) {
      const part = installments.currentInstallment
        ? ` (${installments.currentInstallment}/${installments.count})`
        : ` (${installments.count}x)`;
      description = `Carnê: ${beneficiary}${part}`;
    } else if (/\b(?:darf|receita\s+federal)\b/i.test(rawText)) {
      description = `DARF: ${beneficiary}`;
    } else if (/\b(?:gps|inss)\b/i.test(rawText)) {
      description = `GPS: ${beneficiary}`;
    } else {
      description = `Boleto: ${beneficiary}`;
    }
  } else {
    description =
      installments && installments.count > 1
        ? `Carnê (${installments.count}x)`
        : `Pagamento de Boleto (${bankName})`;
  }

  const effectiveDate =
    documentStatus === "pending_due" && dueDate
      ? dueDate
      : paymentDate || dueDate || toISODate(new Date());

  const idSuffix = digitableLine
    ? digitableLine.replace(/[^0-9]/g, "").slice(-12)
    : `${Date.now()}_${cents}`;
  const id = `bank_slip_${idSuffix}`;

  return {
    id,
    kind: "bank_slip_payment",
    nature: "expense",
    amountCents: cents,
    date: effectiveDate,
    dueDate,
    documentStatus,
    ...(documentStatus === "pending_due" && dueDate
      ? { isScheduled: true, scheduledFor: dueDate }
      : {}),
    description,
    paymentMethod: "other",
    merchantOrBeneficiary: beneficiary || undefined,
    payerOrSource: payer || undefined,
    taxId,
    bankName,
    barcodeOrDigitableLine: digitableLine,
    installments: installments || undefined,
    rawCleanText: rawText,
  };
}
