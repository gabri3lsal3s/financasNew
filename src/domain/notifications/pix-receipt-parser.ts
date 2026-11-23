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
  extractDateFromReceipt,
  extractMerchantOrRecipient,
  extractTaxId,
  isBlacklistedReceipt,
  isScheduledTransaction,
  resolveBankName,
} from "./bank-parser";
import { extractSovereignReceiptAmountCents } from "./receipt-amount-scorer";
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

export interface ExtractedPartyBlockInfo {
  name: string;
  taxId?: string;
}

const KNOWN_INSTITUTION_EXACT_NAMES = new Set([
  "nubank",
  "nu pagamentos",
  "nu financeira",
  "itau",
  "itaú",
  "itaucard",
  "itau unibanco",
  "itaú unibanco",
  "banco itau",
  "banco itaú",
  "banco inter",
  "inter",
  "c6",
  "c6 bank",
  "banco c6",
  "bradesco",
  "banco bradesco",
  "santander",
  "banco santander",
  "banco santander brasil",
  "mercado pago",
  "picpay",
  "picpay servicos",
  "pagbank",
  "pagseguro",
  "pagseguro internet",
  "neon",
  "neon pagamentos",
  "next",
  "btg",
  "btg pactual",
  "banco btg pactual",
  "xp",
  "xp investimentos",
  "caixa",
  "caixa tem",
  "caixa economica",
  "caixa econômica",
  "caixa economica federal",
  "caixa econômica federal",
  "banco do brasil",
  "bb",
  "sicoob",
  "sicredi",
  "safra",
  "banco safra",
  "banco pan",
  "banco original",
  "bco bs2",
  "bs2",
  "cielo",
  "rede",
  "stone",
  "getnet",
]);

/**
 * Detecta se o texto candidato representa nome de instituição financeira/banco/adquirente,
 * evitando falso positivo como beneficiário de Pix ou transferência.
 */
export function isBankOrInstitutionName(candidate: string): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  const stripped = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:s\.?\/?a\.?|ltda\.?|instituicao\s+de\s+pagamento|brasil)\b/gi, "")
    .replace(/[().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (KNOWN_INSTITUTION_EXACT_NAMES.has(stripped)) {
    return true;
  }

  return (
    /^(?:banco|bco|institui[çc][ãa]o|cooperativa\s+de\s+cr[ée]dito|nu\s+pagamentos|pagseguro\s+internet|iti\s*[-–]\s*banco|bco\s+bs2|mercadopago\.com|neon\s+pagamentos|stone\s+pagamentos|picpay\s+servi[çc]os)\b/i.test(
      trimmed,
    ) ||
    /\binstitui[çc][ãa]o\s+de\s+pagamento\b/i.test(trimmed)
  );
}

/**
 * Rejeita ruídos de layout, rótulos de campo, documentos numéricos e nomes de bancos.
 */
export function isInvalidPartyCandidate(candidate: string): boolean {
  if (!candidate || typeof candidate !== "string") return true;
  const trimmed = candidate.trim();
  if (trimmed.length < 3) return true;

  // Apenas dígitos, pontuação, asteriscos ou máscara
  if (/^[\d.*\-/\s\u2022+:()]+$/.test(trimmed)) return true;

  // Exige ao menos 3 letras alfabéticas
  const lettersOnly = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (lettersOnly.length < 3) return true;

  // Rótulos de campo / termos operacionais
  if (
    /^(?:n[ãa]o\s+informad[ao]|d[ée]bito|cr[ée]dito|conta(?:\s+corrente|\s+poupan[çc]a|\s+pagamento)?|ag[êe]ncia|chave(?:\s+pix)?|cpf(?:\s*\/\s*cnpj)?|cnpj|institui[çc][ãa]o(?:\s+financeira)?|banco|valor(?:\s+pago)?|data(?:\s+e\s+hora)?|hor[áa]rio|tipo\s+de\s+(?:conta|transfer[êe]ncia|pix)|sobre\s+a\s+transa[çc][ãa]o|comprovante(?:\s+de\s+.*)?|autentica[çc][ãa]o|id\s+da\s+transa[çc][ãa]o|endtoendid|pagador|recebedor|favorecido|benefici[áa]rio|destinat[áa]rio|remetente|origem|destino|para|de)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (/^(?:r\$|brl|\$)\s*\d|\b\d{2}[/.-]\d{2}[/.-]\d{2,4}\b/i.test(trimmed)) {
    return true;
  }

  if (/^(?:cpf|cnpj|chave(?:\s+pix)?|ag[êe]ncia|conta|institui[çc][ãa]o|banco|id|autentica[çc][ãa]o)\s*[:=]/i.test(trimmed)) {
    return true;
  }

  return isBankOrInstitutionName(trimmed);
}

const RECIPIENT_BLOCK_HEADER_REGEX =
  /^(?:Dados\s+(?:do\s+Recebedor|de\s+quem\s+recebeu|de\s+destino|do\s+destino|do\s+favorecido|do\s+benefici[áa]rio|do\s+destinat[áa]rio)|Destino(?:\s*\/\s*Recebedor)?|Quem\s+recebeu|Nome\s+do\s+(?:recebedor|favorecido)|Pago\s+para|Cr[ée]dito\s+para|Creditado\s+em|Conta\s+de\s+Destino|Benefici[áa]rio|Favorecido|Destinat[áa]rio|Recebedor|Para)\s*(?:[:=]\s*(.*))?$/i;

const PAYER_BLOCK_HEADER_REGEX =
  /^(?:Dados\s+(?:do\s+Pagador|de\s+quem\s+(?:pagou|enviou)|de\s+origem|da\s+origem|da\s+conta\s+debitada)|Origem(?:\s*\/\s*Pagador)?|Quem\s+(?:te\s+)?(?:enviou|pagou)|Nome\s+do\s+(?:pagador|remetente)|Conta\s+de\s+Origem|Debitado\s+de|Pagador|Remetente|De)\s*(?:[:=]\s*(.*))?$/i;

const TERMINAL_SECTION_REGEX =
  /^(?:Sobre\s+a\s+transa[çc][ãa]o|Autentica[çc][ãa]o|C[óo]digo\s+de\s+autentica[çc][ãa]o|ID\s+(?:da\s+transa[çc][ãa]o|da\s+opera[çc][ãa]o|Fim\s+a\s+Fim)|EndToEndId|Estamos\s+aqui)\b/i;

const BLOCK_NON_NAME_LABEL_ONLY_REGEX =
  /^(?:CPF\/CNPJ|CNPJ\/CPF|CPF|CNPJ|Institui[çc][ãa]o(?:\s+(?:Financeira|Destinat[áa]ria|do\s+Recebedor|de\s+Destino|de\s+Origem|do\s+Pagador))?|Banco(?:\s+(?:Destinat[áa]rio|do\s+Recebedor|de\s+Destino|Favorecido|de\s+Origem))?|Ag[êe]ncia(?:\s*[:/]?\s*conta)?|Conta(?:\s+(?:corrente|poupan[çc]a))?|Chave(?:\s+(?:Pix|de\s+Endere[çc]amento|vinculada))?|Tipo\s+de\s+conta|Ispb)\s*[:=]?\s*$/i;

const BLOCK_INLINE_TAX_ID_REGEX =
  /^(?:CPF\/CNPJ|CNPJ\/CPF|CPF|CNPJ)\s*[:=]?\s*(.+)$/i;

function normalizeBlockTaxId(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || /^(?:n[ãa]o\s+informad|-+)$/i.test(trimmed)) return undefined;
  // CNPJ completo ou dígitos puros sem máscara -> retorna apenas dígitos
  if (!/[*\u2022]/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 14 || digits.length === 11) {
      return digits;
    }
  }
  if (/[\d*\u2022]/.test(trimmed) && trimmed.replace(/[^0-9*\u2022./-]/g, "").length >= 6) {
    return trimmed;
  }
  return undefined;
}

/**
 * Extrai nome e CPF/CNPJ dentro de blocos multilinha (com ou sem "Nome:") de Recebedor/Pagador,
 * suportando Nubank, Inter, Caixa, Itaú, PicPay, BTG, Mercado Pago e Iti.
 */
export function extractPartyBlockInfo(
  rawText: string,
  role: "recipient" | "payer",
): ExtractedPartyBlockInfo {
  if (!rawText || typeof rawText !== "string") {
    return { name: "" };
  }

  const lines = rawText
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const targetRegex = role === "recipient" ? RECIPIENT_BLOCK_HEADER_REGEX : PAYER_BLOCK_HEADER_REGEX;
  const oppositeRegex = role === "recipient" ? PAYER_BLOCK_HEADER_REGEX : RECIPIENT_BLOCK_HEADER_REGEX;

  let extractedName = "";
  let extractedTaxId: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headerMatch = targetRegex.exec(line);
    if (!headerMatch) continue;

    // Caso 1: valor inline após ":" ou "=" na própria linha do cabeçalho
    const inlineVal = headerMatch[1]?.trim();
    if (inlineVal) {
      const cleanedInline = cleanMerchantName(
        inlineVal.replace(/^(?:Nome|Raz[ãa]o\s+Social)\s*[:=]?\s*/i, ""),
      );
      if (!extractedName && !isInvalidPartyCandidate(cleanedInline)) {
        extractedName = cleanedInline;
      }
    }

    // Caso 2: varre até 8 linhas seguintes do bloco até mudar de seção
    const limit = Math.min(lines.length, i + 9);
    for (let j = i + 1; j < limit; j++) {
      const subLine = lines[j]!;

      if (oppositeRegex.test(subLine) || TERMINAL_SECTION_REGEX.test(subLine)) {
        break;
      }
      // Subcabeçalho explícito do próprio papel continua no mesmo bloco (ex: "Creditado em:\nFavorecido: X")
      if (targetRegex.test(subLine)) {
        const nestedInline = targetRegex.exec(subLine)?.[1]?.trim();
        if (nestedInline) {
          const cleanedNested = cleanMerchantName(
            nestedInline.replace(/^(?:Nome|Raz[ãa]o\s+Social)\s*[:=]?\s*/i, ""),
          );
          if (!extractedName && !isInvalidPartyCandidate(cleanedNested)) {
            extractedName = cleanedNested;
          }
        }
        continue;
      }

      // 2a. Linha explícita de Nome / Razão Social
      const namePrefixMatch =
        /^(?:Nome(?:\s+completo|\s+do\s+(?:recebedor|favorecido|pagador|remetente))?|Raz[ãa]o\s+Social)(?:\s*[:=]\s*(.+)|\s+(.+))?$/i.exec(
          subLine,
        );
      if (namePrefixMatch) {
        const inlineName = (namePrefixMatch[1] || namePrefixMatch[2] || "").trim();
        let resolvedName = inlineName;
        if (!resolvedName && j + 1 < limit) {
          const nextLine = lines[j + 1]!;
          if (!oppositeRegex.test(nextLine) && !BLOCK_NON_NAME_LABEL_ONLY_REGEX.test(nextLine)) {
            resolvedName = nextLine;
            j++;
          }
        }
        const cleaned = cleanMerchantName(resolvedName);
        if (!extractedName && !isInvalidPartyCandidate(cleaned)) {
          extractedName = cleaned;
        }
        continue;
      }

      // 2b. Rótulo isolado de metadado (CPF / CNPJ / Instituição / Agência / Chave)
      if (BLOCK_NON_NAME_LABEL_ONLY_REGEX.test(subLine)) {
        const isTaxField = /^(?:CPF|CNPJ)/i.test(subLine);
        if (j + 1 < limit) {
          const nextLine = lines[j + 1]!;
          if (isTaxField && !extractedTaxId) {
            extractedTaxId = normalizeBlockTaxId(nextLine);
          }
          j++; // Pula o valor desse metadado para nunca virar nome de favorecido
        }
        continue;
      }

      // 2c. CPF / CNPJ inline
      const inlineTaxMatch = BLOCK_INLINE_TAX_ID_REGEX.exec(subLine);
      if (inlineTaxMatch && inlineTaxMatch[1]) {
        if (!extractedTaxId) {
          extractedTaxId = normalizeBlockTaxId(inlineTaxMatch[1]);
        }
        continue;
      }

      // 2d. Outro rótulo inline (Instituição:, Banco:, Agência:, Chave Pix:, Conta:)
      if (
        /^(?:Institui[çc][ãa]o|Banco|Ag[êe]ncia|Conta|Chave(?:\s+Pix)?|Ispb|Tipo\s+de\s+conta|Documento)\b(?:\s*[:=]|\s+)/i.test(
          subLine,
        )
      ) {
        continue;
      }

      // 2e. Layout moderno sem rótulo "Nome:" (Nubank / Inter / PicPay / BTG / Iti):
      // primeira linha nominal válida logo após o cabeçalho Destino / Origem / Para / De
      if (!extractedName) {
        const cleanedFreeLine = cleanMerchantName(subLine);
        if (!isInvalidPartyCandidate(cleanedFreeLine)) {
          extractedName = cleanedFreeLine;
        }
      }
    }

    if (extractedName) {
      return { name: extractedName, taxId: extractedTaxId };
    }
  }

  // Fallback para textos colapsados em linha única (ex.: Web Share Target)
  if (!extractedName) {
    const inlineFallbackRegex =
      role === "recipient"
        ? /\b(?:Benefici[áa]rio|Favorecido|Destinat[áa]rio|Recebedor|Nome\s+do\s+recebedor|Pago\s+para)\s*[:=]\s*([^\n\r,;]+)/i
        : /\b(?:Pagador|Remetente|Quem\s+te\s+enviou|Nome\s+do\s+pagador)\s*[:=]\s*([^\n\r,;]+)/i;
    const inlineFallbackMatch = inlineFallbackRegex.exec(rawText);
    if (inlineFallbackMatch && inlineFallbackMatch[1]) {
      const trimmedTail = inlineFallbackMatch[1]
        .split(/\s+(?:CPF|CNPJ|Chave(?:\s+Pix)?|Institui[çc][ãa]o|Banco|Valor|Data|ID\b|Autentica[çc][ãa]o)\b/i)[0]
        ?.replace(/^(?:Nome|Raz[ãa]o\s+Social)\s*[:=]?\s*/i, "")
        .trim();
      const cleanedFallback = cleanMerchantName(trimmedTail ?? "");
      if (!isInvalidPartyCandidate(cleanedFallback)) {
        extractedName = cleanedFallback;
      }
    }
  }

  return { name: extractedName, taxId: extractedTaxId };
}

/**
 * Executa o parsing especializado de um comprovante de Pix.
 */
export function parsePixReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Descarta se pertencer à blacklist de comprovantes inválidos (falhas, 2FA, spam)
  if (isBlacklistedReceipt(rawText)) return null;

  const cents = extractSovereignReceiptAmountCents(rawText);
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

  // 1. Extração do recebedor / favorecido e do pagador / remetente (com suporte a blocos sem "Nome:")
  const recipientBlock = extractPartyBlockInfo(rawText, "recipient");
  const payerBlock = extractPartyBlockInfo(rawText, "payer");

  let recipient = recipientBlock.name;
  if (!recipient && nature === "expense") {
    const fallbackRecipient = cleanMerchantName(extractMerchantOrRecipient(rawText));
    if (!isInvalidPartyCandidate(fallbackRecipient)) {
      recipient = fallbackRecipient;
    }
  }

  let payer = payerBlock.name;
  if (!payer && nature === "income") {
    const fallbackPayer = cleanMerchantName(extractMerchantOrRecipient(rawText));
    if (!isInvalidPartyCandidate(fallbackPayer)) {
      payer = fallbackPayer;
    }
  }

  let taxId = extractTaxId(rawText);
  if (!taxId) {
    const maskedMatch =
      /\b([0-9*\u2022]{3}\.[0-9*\u2022]{3}\.[0-9*\u2022]{3}-[0-9*\u2022]{2})\b|\b([0-9*\u2022]{2}\.[0-9*\u2022]{3}\.[0-9*\u2022]{3}\/[0-9*\u2022]{4}-[0-9*\u2022]{2})\b/.exec(
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
    taxId: taxId || recipientBlock.taxId || payerBlock.taxId,
    recipientTaxId: recipientBlock.taxId,
    payerTaxId: payerBlock.taxId,
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
