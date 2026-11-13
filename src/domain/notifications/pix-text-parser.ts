/**
 * Parser puro de chaves Pix, links de cobrança e mensagens de compartilhamento bancário.
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import { toISODate } from "@/domain/money";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "evp";

export interface DetectedPixKey {
  rawKey: string;
  normalizedKey: string;
  type: PixKeyType;
}

export interface ParsedPixTextResult {
  kind: "pix_key" | "pix_link" | "pix_message";
  amountCents: number;
  description: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  recipientName?: string;
  nature: "expense" | "income";
  confidence: "high" | "medium" | "low";
  date: string;
  rawText: string;
}

/**
 * Normaliza e valida uma chave Pix isolada ou dentro de texto.
 */
export function detectPixKey(text: string): DetectedPixKey | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  // 1. Chave Aleatória (EVP) — UUIDv4 de 32 hexadecimais com 4 hífens
  const evpMatch = /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/.exec(trimmed);
  if (evpMatch && evpMatch[1]) {
    return {
      rawKey: evpMatch[1],
      normalizedKey: evpMatch[1].toLowerCase(),
      type: "evp",
    };
  }

  // 2. Chave E-mail
  const emailMatch = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/.exec(trimmed);
  if (emailMatch && emailMatch[1]) {
    return {
      rawKey: emailMatch[1],
      normalizedKey: emailMatch[1].toLowerCase(),
      type: "email",
    };
  }

  // 3. Chave CNPJ (14 dígitos)
  const formattedCnpj = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/.exec(trimmed);
  if (formattedCnpj && formattedCnpj[1]) {
    return {
      rawKey: formattedCnpj[1],
      normalizedKey: formattedCnpj[1].replace(/\D/g, ""),
      type: "cnpj",
    };
  }

  // 4. Chave CPF (11 dígitos formatados)
  const formattedCpf = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/.exec(trimmed);
  if (formattedCpf && formattedCpf[1]) {
    return {
      rawKey: formattedCpf[1],
      normalizedKey: formattedCpf[1].replace(/\D/g, ""),
      type: "cpf",
    };
  }

  // 5. Chave Telefone Celular Brasileiro (com ou sem +55, com ou sem parênteses, 9 dígitos após DDD)
  // Ex.: +5511999998888, (11) 99999-8888, 11999998888
  const phoneMatch = /(?:(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*))?(9\d{4})[-\s]?(\d{4})\b/.exec(trimmed);
  if (phoneMatch && phoneMatch[2] && phoneMatch[3]) {
    const ddd = phoneMatch[1] || "";
    const num = `${phoneMatch[2]}${phoneMatch[3]}`;
    if (ddd) {
      const fullDigits = `55${ddd}${num}`;
      return {
        rawKey: phoneMatch[0].trim(),
        normalizedKey: fullDigits,
        type: "phone",
      };
    }
  }

  // 6. CNPJ ou CPF desformatados precedidos por marcador semântico de Pix ou documento
  const unformattedPixKeyMatch = /(?:chave\s*pix|pix\s*chave|pix|cpf|cnpj|para)[\s:.-]*(\d{11}|\d{14})\b/i.exec(trimmed);
  if (unformattedPixKeyMatch && unformattedPixKeyMatch[1]) {
    const digits = unformattedPixKeyMatch[1];
    return {
      rawKey: digits,
      normalizedKey: digits,
      type: digits.length === 14 ? "cnpj" : "cpf",
    };
  }

  // 6.1 CNPJ isolado de 14 dígitos no texto (sequência exclusiva de pessoas jurídicas)
  const cnpj14Match = /\b(\d{14})\b/.exec(trimmed);
  if (cnpj14Match && cnpj14Match[1]) {
    return {
      rawKey: cnpj14Match[1],
      normalizedKey: cnpj14Match[1],
      type: "cnpj",
    };
  }

  // 7. Sequência limpa isolada de 11 ou 14 dígitos
  if (/^\d{11}$/.test(trimmed)) {
    return {
      rawKey: trimmed,
      normalizedKey: trimmed,
      type: "cpf",
    };
  }
  if (/^\d{14}$/.test(trimmed)) {
    return {
      rawKey: trimmed,
      normalizedKey: trimmed,
      type: "cnpj",
    };
  }

  return null;
}

/**
 * Extrai valor monetário em centavos a partir de qualquer string livre.
 */
export function extractAmountCentsFromText(text: string): number {
  if (!text || typeof text !== "string") return 0;

  // Formato brasileiro com vírgula (R$ 1.250,50 ou 50,00)
  const brlMatch = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\b/.exec(text);
  if (brlMatch && brlMatch[1]) {
    const raw = brlMatch[1].replace(/\./g, "").replace(",", ".");
    const num = Number.parseFloat(raw);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 100);
    }
  }

  // Formato internacional com ponto (1,250.50 ou 50.00)
  const intlMatch = /(?:\$\s*)?(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})\b/.exec(text);
  if (intlMatch && intlMatch[1]) {
    const raw = intlMatch[1].replace(/,/g, "");
    const num = Number.parseFloat(raw);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 100);
    }
  }

  // Inteiro com R$ (R$ 50 ou R$ 1.500)
  const intMatch = /(?:R\$|\$)\s*(\d{1,3}(?:\.\d{3})+|\d+)\b/i.exec(text);
  if (intMatch && intMatch[1]) {
    const raw = intMatch[1].replace(/\./g, "");
    const num = Number.parseInt(raw, 10);
    if (Number.isFinite(num) && num > 0) {
      return num * 100;
    }
  }

  return 0;
}

/**
 * Tenta extrair o nome da pessoa / recebedor / pagador a partir de marcadores em frases.
 */
export function extractRecipientFromText(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;

  // Marcadores comuns: "para [Nome]", "favorecido: [Nome]", "destinatário: [Nome]", "recebedor: [Nome]"
  const recipientMatch = /(?:para|favorecido|destinat[aá]rio|recebedor|recebido de|de)[\s:]+([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{3,35}?)(?=\s+(?:chave|pix|cpf|cnpj|banco|ag[eê]ncia|conta|no\s+valor|valor)|[\n,.;-]|$)/i.exec(
    text,
  );

  if (recipientMatch && recipientMatch[1]) {
    const candidate = recipientMatch[1].trim();
    // Filtra palavras comuns de preposição ou termos genéricos
    if (
      !/^(mim|voc[eê]|conta|chave|pix|banco|valor|outro|ag[eê]ncia|hoje|ontem)$/i.test(candidate) &&
      candidate.length >= 3
    ) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Determina se a mensagem indica uma despesa (pagamento/cobrança enviada) ou receita (recebimento/depósito).
 */
export function inferNatureFromText(text: string): "expense" | "income" {
  const lower = text.toLowerCase();
  if (
    lower.includes("você recebeu") ||
    lower.includes("voce recebeu") ||
    lower.includes("transferência recebida") ||
    lower.includes("transferencia recebida") ||
    lower.includes("pix recebido") ||
    lower.includes("recebimento de pix") ||
    lower.includes("crédito em conta") ||
    lower.includes("credito em conta")
  ) {
    return "income";
  }
  return "expense";
}

/**
 * Tenta fazer o parsing de links de cobrança Pix (ex.: pix.bcb.gov.br, Nubank, Mercado Pago, etc.).
 */
export function parsePixUrl(text: string): ParsedPixTextResult | null {
  if (!text || typeof text !== "string") return null;

  // Verifica se há URL de Pix
  const urlMatch = /(https?:\/\/[^\s]+)/i.exec(text);
  if (!urlMatch || !urlMatch[1]) return null;

  const urlString = urlMatch[1];
  const isPixUrl =
    urlString.includes("pix.bcb.gov.br") ||
    urlString.includes("nubank.com.br/cobrar") ||
    urlString.includes("picpay") ||
    urlString.includes("mercadopago") ||
    urlString.includes("/pix") ||
    urlString.includes("pix=");

  if (!isPixUrl) return null;

  let amountCents = 0;
  let pixKey: string | undefined;
  let recipient: string | undefined;

  try {
    const parsedUrl = new URL(urlString);
    const params = parsedUrl.searchParams;

    // Busca valor nos query params
    const valParam = params.get("valor") || params.get("value") || params.get("amount") || params.get("v");
    if (valParam) {
      amountCents = extractAmountCentsFromText(valParam);
    }

    // Busca chave Pix nos query params
    const keyParam = params.get("chave") || params.get("key") || params.get("pix_key") || params.get("k");
    if (keyParam) {
      const detected = detectPixKey(keyParam);
      if (detected) {
        pixKey = detected.normalizedKey;
      }
    }

    // Busca beneficiário / nome
    const recParam = params.get("nome") || params.get("name") || params.get("favorecido") || params.get("recipient");
    if (recParam) {
      recipient = recParam.trim();
    }
  } catch {
    // URL mal formatada
  }

  // Se não extraiu valor da URL, tenta extrair do restante do texto
  if (amountCents === 0) {
    amountCents = extractAmountCentsFromText(text);
  }
  if (!recipient) {
    recipient = extractRecipientFromText(text);
  }

  return {
    kind: "pix_link",
    amountCents,
    description: recipient ? `Pix: ${recipient}` : "Cobrança Pix via Link",
    pixKey,
    recipientName: recipient,
    nature: inferNatureFromText(text),
    confidence: amountCents > 0 ? "high" : "medium",
    date: toISODate(new Date()),
    rawText: text.trim(),
  };
}

/**
 * Tenta fazer o parsing de um texto livre contendo informações de Pix (chave, valor ou mensagem).
 */
export function parsePixFreeText(text: string): ParsedPixTextResult | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Tenta como link Pix
  const urlCandidate = parsePixUrl(trimmed);
  if (urlCandidate) {
    return urlCandidate;
  }

  // 2. Extrai chave Pix e valor do texto
  const detectedKey = detectPixKey(trimmed);
  const amountCents = extractAmountCentsFromText(trimmed);
  const recipient = extractRecipientFromText(trimmed);
  const nature = inferNatureFromText(trimmed);

  // Se tem pelo menos chave Pix ou tem valor com menção a Pix
  const hasPixMention = /pix/i.test(trimmed);

  if (detectedKey || (amountCents > 0 && hasPixMention)) {
    const isOnlyKey = Boolean(detectedKey && trimmed.length <= detectedKey.rawKey.length + 4);
    const kind = isOnlyKey ? "pix_key" : "pix_message";

    const description = recipient
      ? `Pix: ${recipient}`
      : detectedKey
        ? `Pix: ${detectedKey.rawKey}`
        : "Transferência Pix";

    return {
      kind,
      amountCents,
      description,
      pixKey: detectedKey?.normalizedKey,
      pixKeyType: detectedKey?.type,
      recipientName: recipient,
      nature,
      confidence: amountCents > 0 && detectedKey ? "high" : amountCents > 0 || detectedKey ? "medium" : "low",
      date: toISODate(new Date()),
      rawText: trimmed,
    };
  }

  return null;
}
