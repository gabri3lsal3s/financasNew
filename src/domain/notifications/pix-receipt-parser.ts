/**
 * Parser puro de comprovantes de transferências e pagamentos Pix.
 *
 * Suporta comprovantes de instituições financeiras brasileiras (Nubank, Itaú, Bradesco, Inter,
 * Santander, Banco do Brasil, C6 Bank, Mercado Pago, PicPay, Caixa, etc.).
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import {
  cleanMerchantName,
  detectPixTransactionNature,
  extractCentsFromText,
  extractDateFromReceipt,
  extractMerchantOrRecipient,
  extractTaxId,
  isBlacklistedReceipt,
  isScheduledTransaction,
  resolveBankName,
} from "./bank-parser";
import type { UniversalReceiptData } from "./receipt-types";

/**
 * Verifica se o texto possui marcadores característicos de comprovante Pix.
 */
export function isPixReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Rejeita notificações ou comprovantes inválidos (falhas, 2FA, etc)
  if (isBlacklistedReceipt(text)) return false;

  const pixMarkers = [
    /\bcomprovante\s+(?:de\s+envio\s+|de\s+transfer[êe]ncia\s+|de\s+pagamento\s+|de\s+opera[çc][ãa]o\s+)?(?:do\s+|de\s+)?pix\b/i,
    /\bpix\s+(?:enviado|recebido|agendado|realizado|conclu[íi]do)\b/i,
    /\btransfer[êe]ncia\s+pix\b/i,
    /\bpagamento\s+(?:com\s+|via\s+)?pix\b/i,
    /\bchave\s+pix\b/i,
    /\bendtoendid\b/i,
    /\bid\s+da\s+transa[çc][ãa]o\s*:\s*e\d{8}/i,
    /\bcomprovante\s+de\s+transa[çc][ãa]o\s+pix\b/i,
    /\bcomprovante\s+pix\b/i,
  ];

  for (const marker of pixMarkers) {
    if (marker.test(lower)) return true;
  }

  // Se tiver a palavra "pix" acompanhada de identificador ou comprovante
  if (/\bpix\b/i.test(lower)) {
    if (
      /\b(?:comprovante|autentica[çc][ãa]o|dados\s+do\s+recebedor|dados\s+do\s+pagador|valor\s+pago|institui[çc][ãa]o|favorecido|benefici[áa]rio)\b/i.test(
        lower,
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai a instituição financeira destinatária (banco do recebedor/favorecido).
 */
export function extractPixDestinationBank(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Bloco de destino / recebedor com instituição ou banco
  const destBlock =
    /(?:Destino|Recebedor|Destinat[áa]rio|Dados\s+(?:do\s+Recebedor|de\s+quem\s+recebeu|do\s+Destinat[áa]rio|do\s+favorecido|do\s+benefici[áa]rio)|Favorecido|Benefici[áa]rio|Para)[\s\S]*?(?:Institui[çc][ãa]o(?:\s+(?:Financeira|Destinat[áa]ria|do\s+Recebedor|de\s+Destino))?|Banco(?:\s+(?:Destinat[áa]rio|do\s+Recebedor|de\s+Destino))?)\s*[:=]\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (destBlock && destBlock[1]) {
    const rawBank = destBlock[1].trim();
    const resolved = resolveBankName(undefined, undefined, rawBank);
    if (resolved) return resolved;
    return cleanMerchantName(rawBank);
  }

  // 2. Rótulo explícito isolado com qualificador de destino
  const directMatch =
    /(?:Institui[çc][ãa]o\s+(?:Financeira\s+)?(?:Destinat[áa]ria|do\s+Recebedor|de\s+Destino)|Banco\s+(?:Destinat[áa]rio|do\s+Recebedor|de\s+Destino))\s*[:=]?\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (directMatch && directMatch[1]) {
    const rawBank = directMatch[1].trim();
    const resolved = resolveBankName(undefined, undefined, rawBank);
    if (resolved) return resolved;
    return cleanMerchantName(rawBank);
  }

  // 3. Fallback: Instituição isolada após o valor/chave
  const genericInstMatch =
    /(?:Institui[çc][ãa]o(?:\s+Financeira)?|Banco)\s*[:=]\s*([^\n\r,]+)/i.exec(text);
  if (genericInstMatch && genericInstMatch[1]) {
    const rawBank = genericInstMatch[1].trim();
    const resolved = resolveBankName(undefined, undefined, rawBank);
    if (resolved) return resolved;
  }

  return undefined;
}

/**
 * Extrai a chave Pix citada no comprovante (email, CPF/CNPJ, telefone ou EVP/aleatória).
 */
export function extractPixKey(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Chave explícita: "Chave Pix: ...", "Chave: ..."
  const labeledMatch =
    /(?:Chave\s+Pix|Chave\s+de\s+Endere[çc]amento|Chave\s+vinculada|Chave)\s*[:=]?\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].trim();
    if (candidate.length >= 4 && !/^(?:n[ãa]o\s+informada?|-+)$/i.test(candidate)) {
      return candidate;
    }
  }

  // 2. Chave EVP / Chave aleatória padrão UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const evpMatch =
    /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i.exec(text);
  if (evpMatch && evpMatch[1]) {
    return evpMatch[1];
  }

  return undefined;
}

/**
 * Extrai o EndToEndId ou identificador da transação Pix (E00000000YYYYMMDD...).
 */
export function extractPixEndToEndId(text: string): string | undefined {
  if (!text) return undefined;

  // Formato padrão Bacen de EndToEndId: E + 8 dígitos ISPB + 12 caracteres timestamp + sufixo
  const e2eMatch = /\b(E[0-9]{8}[0-9]{4}[0-9]{4}[A-Za-z0-9]{5,24})\b/.exec(text);
  if (e2eMatch && e2eMatch[1]) {
    return e2eMatch[1].trim();
  }

  // Identificador genérico de transação
  const txMatch =
    /(?:ID\s+(?:da\s+transa[çc][ãa]o|da\s+opera[çc][ãa]o|do\s+pix)|EndToEndId|Identificador)\s*[:=]?\s*([A-Za-z0-9.-]{6,50})\b/i.exec(
      text,
    );
  if (txMatch && txMatch[1]) {
    return txMatch[1].trim();
  }

  return undefined;
}

/**
 * Executa o parsing especializado de um comprovante de Pix.
 */
export function parsePixReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Descarta se pertencer à blacklist de comprovantes inválidos (falhas, 2FA, spam)
  if (isBlacklistedReceipt(rawText)) return null;

  const cents = extractCentsFromText(rawText);
  if (!cents || cents <= 0) return null;

  const nature = detectPixTransactionNature(rawText);
  const isScheduled = isScheduledTransaction(rawText);
  const { date: txDate, scheduledFor } = extractDateFromReceipt(rawText, isScheduled);

  // Resolução da instituição bancária
  const headerLines = rawText.split(/[\r\n]+/).slice(0, 4).join(" ");
  let bankName = resolveBankName(undefined, undefined, headerLines);

  if (!bankName) {
    const originMatch =
      /(?:Institui[çc][ãa]o\s+de\s+Origem|Institui[çc][ãa]o\s+do\s+Pagador|Canal(?:\s*:\s*Aplicativo)?|Banco\s+emissor)\s*[:=]?\s*([^\n\r]+)/i.exec(
        rawText,
      );
    if (originMatch && originMatch[1]) {
      bankName = resolveBankName(undefined, undefined, originMatch[1]);
    }
  }

  if (!bankName) {
    bankName = resolveBankName(undefined, undefined, rawText) || "Pix";
  }

  // 1. Extração do recebedor / favorecido
  const recipientMatch =
    /(?:(?:Dados\s+(?:do\s+Recebedor|de\s+quem\s+recebeu|de\s+destino|do\s+destino|do\s+favorecido|do\s+benefici[áa]rio)|Destino|Dados\s+do\s+Destinat[áa]rio)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Para|Destinat[áa]rio|Nome\s+do\s+recebedor|Recebedor|Pago\s+para|Benefici[áa]rio|Favorecido|Quem\s+recebeu|Destino)\s*[:=]\s*([^\n\r,]+))/i.exec(
      rawText,
    );
  let rawRecipient = recipientMatch
    ? (recipientMatch[1] || recipientMatch[2] || "").trim()
    : "";
  rawRecipient = rawRecipient.replace(/^(?:Nome|Raz[ãa]o\s+Social)\s*[:=]?\s*/i, "").trim();

  // 2. Extração do pagador / remetente
  const payerMatch =
    /(?:(?:Dados\s+(?:do\s+Pagador|de\s+quem\s+(?:pagou|enviou)|de\s+origem|da\s+origem)|Origem|Quem\s+te\s+enviou)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Quem\s+te\s+enviou|Pagador|De|Origem|Nome\s+do\s+pagador|Remetente)\s*[:=]\s*([^\n\r,]+))/i.exec(
      rawText,
    );
  let rawPayer = payerMatch
    ? (payerMatch[1] || payerMatch[2] || "").trim()
    : "";
  rawPayer = rawPayer.replace(/^(?:Nome|Raz[ãa]o\s+Social)\s*[:=]?\s*/i, "").trim();

  const recipient = cleanMerchantName(
    rawRecipient || (nature === "expense" ? extractMerchantOrRecipient(rawText) : ""),
  );
  const payer = cleanMerchantName(
    rawPayer || (nature === "income" ? extractMerchantOrRecipient(rawText) : ""),
  );

  let taxId = extractTaxId(rawText);
  if (!taxId) {
    const maskedMatch =
      /\b([0-9*]{3}\.[0-9*]{3}\.[0-9*]{3}-[0-9*]{2})\b|\b([0-9*]{2}\.[0-9*]{3}\.[0-9*]{3}\/[0-9*]{4}-[0-9*]{2})\b/.exec(
        rawText,
      );
    if (maskedMatch) {
      taxId = (maskedMatch[1] || maskedMatch[2] || "").trim();
    }
  }
  const pixKey = extractPixKey(rawText);
  const txId = extractPixEndToEndId(rawText);
  const destinationBank = extractPixDestinationBank(rawText);

  let description: string;
  if (isScheduled) {
    description = recipient
      ? `Pix Agendado: ${recipient}`
      : `Pix Agendado (${bankName})`;
  } else if (nature === "income") {
    description = payer ? `Pix Recebido: ${payer}` : `Pix Recebido (${bankName})`;
  } else {
    description = recipient ? `Pix para ${recipient}` : `Pix (${bankName})`;
  }

  const idSuffix = txId ? txId.slice(-12) : `${Date.now()}_${cents}`;
  const id = `pix_${idSuffix}`;

  return {
    id,
    kind: "pix",
    nature,
    amountCents: cents,
    date: txDate || toISODate(new Date()),
    description,
    paymentMethod: "pix",
    merchantOrBeneficiary: recipient || undefined,
    payerOrSource: payer || undefined,
    taxId,
    bankName,
    issuerBank: bankName,
    destinationBank,
    isScheduled,
    scheduledFor,
    txId,
    pixKey,
    rawCleanText: rawText,
  };
}
