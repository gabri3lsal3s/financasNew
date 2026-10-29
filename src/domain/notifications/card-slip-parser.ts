/**
 * Parser puro de comprovantes de maquininhas de cartão (Slips POS / TEF).
 *
 * Suporta terminais e adquirentes brasileiros:
 * - Cielo, Rede, Stone, PagBank/PagSeguro, Getnet, SafraPay, Mercado Pago, Vero.
 * - Detecção de modalidade: Crédito à Vista, Crédito Parcelado, Débito.
 * - Extração de bandeira, 4 dígitos finais, estabelecimento comercial, CNPJ e parcelamento.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import type { PaymentMethod } from "@/types/schema";
import {
  extractCardBrand,
  extractCardLastDigits,
  extractCentsFromText,
  extractDateFromReceipt,
  extractTaxId,
} from "./bank-parser";
import { cleanAcquirerPrefixes } from "./merchant-catalog";
import { extractDetailedInstallments } from "./installment-extractor";
import type { UniversalReceiptData } from "./receipt-types";

const ACQUIRER_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /\bcielo\b/i, name: "Cielo" },
  { regex: /\brede(?:\s+card)?\b/i, name: "Rede" },
  { regex: /\bstone\b/i, name: "Stone" },
  { regex: /\b(?:pagbank|pagseguro)\b/i, name: "PagBank" },
  { regex: /\bgetnet\b/i, name: "Getnet" },
  { regex: /\bsafrapay\b/i, name: "SafraPay" },
  { regex: /\bmercado\s+pago\b/i, name: "Mercado Pago" },
  { regex: /\bvero\b/i, name: "Vero" },
];

/**
 * Identifica o nome da adquirente/maquininha presente no cabeçalho ou rodapé do slip.
 */
export function extractTerminalAcquirer(text: string): string | undefined {
  for (const { regex, name } of ACQUIRER_PATTERNS) {
    if (regex.test(text)) {
      return name;
    }
  }
  return undefined;
}

/**
 * Detecta se o slip corresponde a pagamento em Cartão de Crédito ou Cartão de Débito.
 */
export function detectCardPaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();

  // Se contiver menção explícita a débito
  if (
    /\b(?:d[ée]bito|visa\s+electron|maestro|mastercard\s+debit|elo\s+d[ée]bito)\b/i.test(lower) &&
    !/\bcr[ée]dito\b/i.test(lower)
  ) {
    return "debit";
  }

  // Padrão de comprovantes de maquininhas: crédito
  return "credit_card";
}

/**
 * Extrai o nome do estabelecimento comercial em comprovantes de maquininha.
 */
export function extractCardSlipMerchant(text: string): string {
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

  // 1. Procura linhas precedidas por marcadores explícitos
  const labeledMatch =
    /(?:ESTABELECIMENTO|LOJA|EMPRESA|FANTASIA|RAZ[ÃA]O\s+SOCIAL)[\s:.-]*([^\n\r]+)/i.exec(text);
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].trim();
    if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
      return cleanAcquirerPrefixes(candidate);
    }
  }

  // 2. Comprovantes térmicos geralmente colocam o nome do estabelecimento nas 3 primeiras linhas
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignora linhas que são nomes da maquininha ou títulos operacionais
    if (
      /^(?:comprovante|via\s+cliente|via\s+estabelecimento|cielo|rede|stone|pagseguro|pagbank|getnet|safrapay|cupom|tef)/i.test(
        line,
      )
    ) {
      continue;
    }
    // Ignora CNPJ ou data isolada
    if (/\b\d{2}\.\d{3}\.\d{3}\b|\b\d{2}[/.-]\d{2}[/.-]\d{4}\b/.test(line)) {
      continue;
    }
    if (line.length >= 3 && !/^\d+$/.test(line)) {
      return cleanAcquirerPrefixes(line);
    }
  }

  return "";
}

/**
 * Extrai o código de autorização / NSU / DOC da transação no terminal.
 */
export function extractAuthorizationCode(text: string): string | undefined {
  const match =
    /(?:AUT(?:ORIZA[ÇC][ÃA]O)?|NSU|DOC|AUTOR\.)\s*[:=]?\s*([A-Za-z0-9]{4,15})\b/i.exec(text);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Verifica se o texto possui marcadores característicos de comprovante de maquininha (POS / TEF).
 */
export function isCardSlipReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const posIndicators = [
    /\b(?:via\s+cliente|via\s+do\s+cliente|via\s+consumidor)\b/i,
    /\b(?:cielo|rede\s+card|stone|pagseguro|pagbank|getnet|safrapay|vero)\b/i,
    /\b(?:cr[ée]dito\s+(?:a\s+vista|parcelado|loja|adm)|d[ée]bito\s+(?:a\s+vista)?)\b/i,
    /\b(?:parc(?:elas?)?:\s*\d{1,2}|qtde\s+parc(?:elas?)?:\s*\d{1,2})\b/i,
    /\b(?:autoriza[çc][ãa]o|nsu|cod\s+aut):\s*[A-Za-z0-9]+\b/i,
    /\b(?:mastercard|visa|elo|hipercard|american\s+express)\s+(?:cr[ée]dito|d[ée]bito)\b/i,
  ];

  let matches = 0;
  for (const rx of posIndicators) {
    if (rx.test(lower)) {
      matches++;
      if (matches >= 2) return true;
    }
  }

  return false;
}

/**
 * Executa o parsing especializado de um comprovante de maquininha de cartão.
 */
export function parseCardSlipReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText) return null;

  // Prioriza valor total explícito quando presente no slip
  const totalMatch =
    /(?:VALOR\s+TOTAL|TOTAL(?:\s+A\s+PAGAR)?|VALOR\s+DA\s+OPERA[ÇC][ÃA]O)\s*[:=]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/i.exec(
      rawText,
    );
  const cents =
    totalMatch && totalMatch[1] && totalMatch[2]
      ? parseInt(totalMatch[1].replace(/\./g, ""), 10) * 100 + parseInt(totalMatch[2], 10)
      : (extractCentsFromText(rawText) ?? 0);

  if (!cents || cents <= 0) return null;

  const paymentMethod = detectCardPaymentMethod(rawText);
  const cardBrand = extractCardBrand(rawText);
  const cardLastDigits = extractCardLastDigits(rawText);
  const acquirer = extractTerminalAcquirer(rawText);
  const authorizationCode = extractAuthorizationCode(rawText);
  const taxId = extractTaxId(rawText);
  const merchant = extractCardSlipMerchant(rawText);
  const { date: txDate } = extractDateFromReceipt(rawText, false);

  // Extrai informações completas de parcelamento
  const installments = extractDetailedInstallments(rawText, cents);

  const finalAmountCents =
    installments?.isNewFinancedPurchase && installments.totalAmountCents > 0
      ? installments.totalAmountCents
      : cents;

  const authPart = authorizationCode ? `_${authorizationCode}` : "";
  const id = `card_slip_${Date.now()}_${finalAmountCents}${authPart}`;

  let description: string;
  const merchantLabel = merchant || "Estabelecimento";
  if (installments && installments.count > 1) {
    description = `${merchantLabel} (${installments.count}x)`;
  } else {
    description = merchantLabel;
  }

  const bankName = acquirer || (cardBrand ? `Cartão ${cardBrand}` : "Cartão");

  return {
    id,
    kind: "card_slip",
    nature: "expense",
    amountCents: finalAmountCents,
    date: txDate || toISODate(new Date()),
    description,
    paymentMethod,
    merchantOrBeneficiary: merchant || undefined,
    taxId,
    bankName,
    cardBrand,
    cardLastDigits,
    authorizationCode,
    terminalAcquirer: acquirer,
    installments: installments || undefined,
    rawCleanText: rawText,
  };
}
