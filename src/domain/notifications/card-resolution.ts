/**
 * Motor puro de resolução e auto-vínculo de cartão de crédito (§11.4).
 * Responsável por casar tokens bancários (emissor, nome do banco, últimos 4 dígitos)
 * com a carteira de cartões cadastrados do usuário.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependência de UI, React ou banco de dados.
 */

import type { CreditCard } from "@/types/schema";
import { lookupCardByDigits, type CardDigitsMapping } from "./merchant-memory";

export interface CardResolutionParams {
  /** UUID explícito do cartão ou token textual de banco/dígitos */
  cardId?: string | null;
  /** Últimos 4 dígitos do cartão (ex.: "1234") */
  cardLastDigits?: string | null;
  /** Nome da instituição bancária de origem (ex.: "Rico", "Nubank", "BTG") */
  bankName?: string | null;
  /** Banco emissor específico (ex.: "Rico", "XP Investimentos", "Itaú") */
  issuerBank?: string | null;
  /** Bandeira do cartão (ex.: "Visa", "Mastercard") para desempate */
  cardBrand?: string | null;
  /** Mapa dinâmico de 4 dígitos aprendidos para IDs de cartões (§11.4 / Fase 3) */
  cardDigitsMapping?: CardDigitsMapping | null;
  /** ID do cartão preferencial memorizado para o estabelecimento */
  preferredCardId?: string | null;
}

const BANK_CARD_ALIASES: Record<string, string[]> = {
  nubank: ["nubank", "roxinho", "ultravioleta", "nu"],
  itau: ["itau", "itaú", "itaucard", "personnalite", "personnalité"],
  inter: ["inter", "banco inter"],
  "c6 bank": ["c6", "c6 bank", "carbon"],
  c6: ["c6", "c6 bank", "carbon"],
  bradesco: ["bradesco", "bradesco cartoes"],
  santander: ["santander", "way"],
  "banco do brasil": ["banco do brasil", "ourocard", "bb"],
  caixa: ["caixa", "caixa tem"],
  "btg pactual": ["btg", "btg pactual", "btg investimentos"],
  "btg investimentos": ["btg", "btg pactual", "btg investimentos"],
  "xp investimentos": ["xp", "xp investimentos"],
  xp: ["xp", "xp investimentos"],
  rico: ["rico", "cartao rico", "cartão rico"],
  nomad: ["nomad"],
  wise: ["wise"],
  "mercado pago": ["mercado pago", "mercadopago"],
  picpay: ["picpay", "picpay card"],
  pagbank: ["pagbank", "pagseguro"],
  neon: ["neon"],
  next: ["next"],
  safra: ["safra"],
  sicredi: ["sicredi"],
  sicoob: ["sicoob"],
  binance: ["binance"],
};

/**
 * Normaliza string para comparação sem acentos, pontuação e minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Verifica se o nome do cartão ou sua bandeira corresponde ao termo do banco.
 */
function cardMatchesBankTerm(cardName: string, bankTerm: string): boolean {
  const normName = normalizeText(cardName);
  const normBank = normalizeText(bankTerm);

  if (!normBank || !normName) return false;

  // 1. Contenção direta de substring ou igualdade
  if (normName.includes(normBank)) {
    return true;
  }

  // 2. Consulta a aliases cadastrados
  for (const [key, aliases] of Object.entries(BANK_CARD_ALIASES)) {
    const normKey = normalizeText(key);
    const keyMatches = normBank.includes(normKey) || normKey.includes(normBank);

    if (keyMatches) {
      for (const alias of aliases) {
        const normAlias = normalizeText(alias);
        // Para termos curtos (ex: "xp", "nu", "bb", "c6"), exige fronteira de palavra
        if (normAlias.length <= 3) {
          const rx = new RegExp(`(?:^|\\b)${normAlias}(?:$|\\b)`);
          if (rx.test(normName)) {
            return true;
          }
        } else if (normName.includes(normAlias)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Desempate entre múltiplos cartões do mesmo banco usando bandeira ou dígitos.
 */
function tieBreakCards(
  candidates: CreditCard[],
  params: CardResolutionParams,
): CreditCard | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  // 1. Desempate por bandeira
  if (params.cardBrand) {
    const normBrand = normalizeText(params.cardBrand);
    const brandMatch = candidates.find((c) => {
      const cBrand = c.brand ? normalizeText(c.brand) : "";
      const cName = normalizeText(c.name);
      return cBrand.includes(normBrand) || cName.includes(normBrand);
    });
    if (brandMatch) return brandMatch;
  }

  // 2. Desempate por 4 dígitos
  if (params.cardLastDigits) {
    const digits = params.cardLastDigits;
    const digitMatch = candidates.find((c) => c.name.includes(digits));
    if (digitMatch) return digitMatch;
  }

  // Fallback: primeiro da lista de candidatos
  return candidates[0];
}

/**
 * Resolve o cartão de crédito mais aderente a partir da carteira de cartões do usuário
 * e parâmetros contextuais capturados (ID, dígitos finais, nome do banco, emissor ou bandeira).
 */
export function resolveBestMatchingCard(
  cards: CreditCard[] | undefined | null,
  params: CardResolutionParams = {},
): CreditCard | undefined {
  if (!cards || cards.length === 0) return undefined;

  // Filtragem inicial: apenas cartões ativos
  const activeCards = cards.filter((c) => c.is_active !== false);
  if (activeCards.length === 0) return undefined;

  // 0. Se cardId for fornecido e corresponder exatamente ao id de um cartão ativo
  if (params.cardId) {
    const exactIdMatch = activeCards.find((c) => c.id === params.cardId);
    if (exactIdMatch) {
      return exactIdMatch;
    }
  }

  const digits =
    params.cardLastDigits ||
    (params.cardId && /^\d{4}$/.test(params.cardId.trim()) ? params.cardId.trim() : undefined);

  // =========================================================================
  // 1ª Prioridade: Dígitos Aprendidos na Memória Contínua (cardDigitsMapping)
  // =========================================================================
  if (digits && params.cardDigitsMapping) {
    const learnedCardId = lookupCardByDigits(digits, params.cardDigitsMapping);
    if (learnedCardId) {
      const learnedCard = activeCards.find((c) => c.id === learnedCardId);
      if (learnedCard) {
        return learnedCard;
      }
    }
  }

  // =========================================================================
  // 2ª Prioridade: Dígitos no Nome do Cartão Cadastrado
  // =========================================================================
  if (digits) {
    const digitMatches = activeCards.filter((c) => {
      const normName = c.name.toLowerCase();
      return (
        normName.includes(digits) ||
        new RegExp(`(?:\\b|\\D)${digits}(?:\\b|\\D|$)`).test(normName)
      );
    });

    if (digitMatches.length === 1) {
      return digitMatches[0];
    }

    if (digitMatches.length > 1) {
      const broken = tieBreakCards(digitMatches, params);
      if (broken) return broken;
    }
  }

  // =========================================================================
  // 3ª Prioridade: Emissor / Banco + Desempate por Bandeira
  // =========================================================================
  const bankCandidates = [params.issuerBank, params.bankName, params.cardId].filter(
    (b): b is string => Boolean(b && b.trim() && !/^\d{4}$/.test(b.trim())),
  );

  for (const candidate of bankCandidates) {
    const matchedCards = activeCards.filter((c) => cardMatchesBankTerm(c.name, candidate));

    if (matchedCards.length === 1) {
      return matchedCards[0];
    }

    if (matchedCards.length > 1) {
      const broken = tieBreakCards(matchedCards, params);
      if (broken) return broken;
    }
  }

  // Desempate ou busca por bandeira isolada
  if (params.cardBrand) {
    const normBrand = normalizeText(params.cardBrand);
    const brandMatches = activeCards.filter((c) => {
      const cBrand = c.brand ? normalizeText(c.brand) : "";
      const cName = normalizeText(c.name);
      return cBrand.includes(normBrand) || cName.includes(normBrand);
    });

    if (brandMatches.length === 1) {
      return brandMatches[0];
    }

    if (brandMatches.length > 1) {
      return brandMatches[0];
    }
  }

  // =========================================================================
  // 4ª Prioridade: Cartão Preferencial do Estabelecimento (preferredCardId)
  // =========================================================================
  if (params.preferredCardId) {
    const preferredMatch = activeCards.find((c) => c.id === params.preferredCardId);
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  // =========================================================================
  // 5ª Prioridade: Fallback Seguro (Exatamente 1 Cartão Ativo)
  // =========================================================================
  if (activeCards.length === 1) {
    return activeCards[0];
  }

  return undefined;
}
