/**
 * Parser estrito de chaves Pix isoladas, extração auxiliar em comprovantes e utilitários de texto Pix.
 *
 * Regras de rigor (Fase A):
 * - Chaves Pix isoladas (`PIX_KEY`) são aceitas somente quando a string inteira (ou após rótulo curto explícito)
 *   passa por validação estrita: CPF/CNPJ via Módulo 11 oficial, EVP via UUID v4 estrito, E-mail RFC completo,
 *   e Celular com DDD oficial Anatel + 9º dígito.
 * - Nunca infere valor monetário de uma chave Pix isolada (`amountCents === 0` garantido).
 * - Nunca captura decimais sem cifrão (`45.00`, `v2.50`) ou textos/mensagens comuns como lançamento Pix.
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import { parseBrazilianCurrencyToCents } from "@/domain/money/parse";
import { toISODate } from "@/domain/money/parcelar";
import { stripInvisiblePixChars } from "@/domain/pix/pix-br-code";
import { isValidCNPJ } from "@/domain/validation/cnpj";
import { isValidCPF } from "@/domain/validation/cpf";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "evp";

export interface DetectedPixKey {
  rawKey: string;
  normalizedKey: string;
  type: PixKeyType;
}

export interface ParsedPixTextResult {
  kind: "PIX_KEY";
  amountCents: number;
  description: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  recipientName?: string;
  nature: "expense" | "income";
  confidence: "high" | "medium" | "low";
  date: string;
  rawText: string;
}

const MAX_ISOLATED_KEY_INPUT_LENGTH = 80;

const VALID_BR_DDDS = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const UUID_V4_STRICT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_FULL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

const FORMATTED_CNPJ_FULL_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const FORMATTED_CPF_FULL_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const MOBILE_PHONE_FULL_REGEX = /^(?:\+?55[\s-]*)?(?:\(?(\d{2})\)?[\s-]*)(9\s?\d{4})[-\s]?(\d{4})$/;

const SHORT_KEY_LABEL_REGEX =
  /^(?:(?:chave\s*(?:do\s+)?pix|pix\s*chave)(?:\s*[:=-]\s*|\s+)|(?:chave|pix|cpf|cnpj|e-?mail|celular|telefone)\s*[:=-]\s*)/i;

function isValidBrazilianMobileMatch(candidate: string): { ddd: string; localNumber: string } | null {
  const match = MOBILE_PHONE_FULL_REGEX.exec(candidate);
  if (!match || !match[1] || !match[2] || !match[3]) return null;

  const dddNum = Number.parseInt(match[1], 10);
  if (!VALID_BR_DDDS.has(dddNum)) return null;

  const localNumber = `${match[2].replace(/\s/g, "")}${match[3]}`;
  if (!/^9\d{8}$/.test(localNumber)) return null;

  return { ddd: match[1], localNumber };
}

/**
 * Normaliza e valida estritamente uma chave Pix isolada (ou precedida por rótulo curto explícito <= 80 chars).
 * Rejeita textos longos, chats, números soltos ou documentos com dígito verificador inválido.
 */
export function detectPixKey(text: string): DetectedPixKey | null {
  if (!text || typeof text !== "string") return null;

  const cleaned = stripInvisiblePixChars(text, true).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > MAX_ISOLATED_KEY_INPUT_LENGTH) {
    return null;
  }

  let candidate = cleaned;
  let explicitPhoneHint = false;

  const labelMatch = SHORT_KEY_LABEL_REGEX.exec(cleaned);
  if (labelMatch) {
    explicitPhoneHint = /^(?:celular|telefone)/i.test(labelMatch[0]);
    candidate = cleaned.slice(labelMatch[0].length).trim();
  }

  if (!candidate) return null;

  // 1. Chave Aleatória (EVP) — UUID v4 estrito
  if (UUID_V4_STRICT_REGEX.test(candidate)) {
    return {
      rawKey: candidate,
      normalizedKey: candidate.toLowerCase(),
      type: "evp",
    };
  }

  // 2. Chave E-mail isolada (<= 77 chars padrão BACEN, sem "..")
  if (candidate.length <= 77 && !candidate.includes("..") && EMAIL_FULL_REGEX.test(candidate)) {
    return {
      rawKey: candidate,
      normalizedKey: candidate.toLowerCase(),
      type: "email",
    };
  }

  // 3. Chave CNPJ (14 dígitos formatada ou limpa, validada com Módulo 11)
  if (FORMATTED_CNPJ_FULL_REGEX.test(candidate) || /^\d{14}$/.test(candidate)) {
    const digits = candidate.replace(/\D/g, "");
    if (isValidCNPJ(digits)) {
      return {
        rawKey: candidate,
        normalizedKey: digits,
        type: "cnpj",
      };
    }
    return null;
  }

  // 4. Chave CPF formatada (XXX.XXX.XXX-XX, validada com Módulo 11)
  if (FORMATTED_CPF_FULL_REGEX.test(candidate)) {
    const digits = candidate.replace(/\D/g, "");
    if (isValidCPF(digits)) {
      return {
        rawKey: candidate,
        normalizedKey: digits,
        type: "cpf",
      };
    }
    return null;
  }

  // 5. Sequência exata de 11 dígitos sem formatação de telefone
  if (/^\d{11}$/.test(candidate)) {
    if (explicitPhoneHint) {
      const phone = isValidBrazilianMobileMatch(candidate);
      if (phone) {
        return {
          rawKey: candidate,
          normalizedKey: `+55${phone.ddd}${phone.localNumber}`,
          type: "phone",
        };
      }
      return null;
    }

    if (isValidCPF(candidate)) {
      return {
        rawKey: candidate,
        normalizedKey: candidate,
        type: "cpf",
      };
    }

    const phone = isValidBrazilianMobileMatch(candidate);
    if (phone) {
      return {
        rawKey: candidate,
        normalizedKey: `+55${phone.ddd}${phone.localNumber}`,
        type: "phone",
      };
    }

    return null;
  }

  // 6. Chave Telefone Celular Brasileiro formatado / com +55
  const phone = isValidBrazilianMobileMatch(candidate);
  if (phone) {
    return {
      rawKey: candidate,
      normalizedKey: `+55${phone.ddd}${phone.localNumber}`,
      type: "phone",
    };
  }

  return null;
}

/**
 * Extrai chave Pix explicitamente rotulada (ou UUID v4) de dentro de um comprovante bancário formal.
 */
export function extractPixKeyFromReceiptText(text: string): DetectedPixKey | null {
  if (!text || typeof text !== "string") return null;

  const labeledMatch =
    /(?:Chave\s+Pix|Chave\s+de\s+Endere[çc]amento|Chave\s+vinculada|Chave)\s*[:=]\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].trim();
    const detected = detectPixKey(candidate);
    if (detected) return detected;
  }

  const evpMatch =
    /\b([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/i.exec(text);
  if (evpMatch && evpMatch[1]) {
    return {
      rawKey: evpMatch[1],
      normalizedKey: evpMatch[1].toLowerCase(),
      type: "evp",
    };
  }

  return null;
}

/**
 * Extrai valor monetário em centavos a partir de texto com moeda brasileira explícita (R$)
 * ou formato decimal brasileiro com vírgula. Ignora decimais sem cifrão com ponto (ex.: "45.00", "v2.50").
 */
export function extractAmountCentsFromText(text: string): number {
  if (!text || typeof text !== "string") return 0;

  // 1. Valor com prefixo monetário explícito ("R$ 1.250,50", "R$ 100", "R$ 45.00")
  const currencyMatch =
    /(?:R\$|BRL)\s*[:.]?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i.exec(text);
  if (currencyMatch && currencyMatch[1]) {
    const cents = parseBrazilianCurrencyToCents(currencyMatch[1]);
    if (cents !== null && cents > 0) return cents;
  }

  // 2. Formato brasileiro com vírgula decimal ("1.250,50" ou "45,90")
  const brlMatch = /\b(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\b/.exec(text);
  if (brlMatch && brlMatch[1]) {
    const cents = parseBrazilianCurrencyToCents(brlMatch[1]);
    if (cents !== null && cents > 0) return cents;
  }

  return 0;
}

/**
 * Tenta extrair o nome da pessoa / recebedor / pagador a partir de marcadores em frases.
 */
export function extractRecipientFromText(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;

  const recipientMatch =
    /(?:para|favorecido|destinat[aá]rio|recebedor|recebido de|de)[\s:]+([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{3,35}?)(?=\s+(?:chave|pix|cpf|cnpj|banco|ag[eê]ncia|conta|no\s+valor|valor)|[\n,.;-]|$)/i.exec(
      text,
    );

  if (recipientMatch && recipientMatch[1]) {
    const candidate = recipientMatch[1].trim();
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
 * Determina se uma mensagem indica entrada (receita) ou saída (despesa).
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
 * Tenta fazer o parsing estrito de chave Pix isolada no texto livre.
 * Textos longos, mensagens de chat, links genéricos e números soltos retornam null.
 */
export function parsePixFreeText(text: string): ParsedPixTextResult | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const detectedKey = detectPixKey(trimmed);
  if (!detectedKey) {
    return null;
  }

  return {
    kind: "PIX_KEY",
    amountCents: 0,
    description: `Pix: ${detectedKey.rawKey}`,
    pixKey: detectedKey.normalizedKey,
    pixKeyType: detectedKey.type,
    nature: "expense",
    confidence: "medium",
    date: toISODate(new Date()),
    rawText: trimmed,
  };
}
