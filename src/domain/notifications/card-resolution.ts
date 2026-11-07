/**
 * Motor puro de resolução e auto-vínculo de cartão de crédito e contas bancárias (§11.4).
 * Responsável por casar tokens bancários (emissor, nome do banco, últimos 4 dígitos)
 * com a carteira de cartões cadastrados e contas do usuário.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependência de UI, React ou banco de dados.
 */

import type { CreditCard } from "@/types/schema";
import { lookupCardByDigits, type CardDigitsMapping } from "./merchant-memory";

export interface CardResolutionParams {
  /** UUID explícito do cartão ou token textual de banco/dígitos */
  cardId?: string | null;
  /** Últimos 4 dígitos do cartão (ex.: "1234", "final 1234", "**** 5678") */
  cardLastDigits?: string | null;
  /** Nome da instituição bancária de origem (ex.: "Rico", "Nubank", "BTG") */
  bankName?: string | null;
  /** Pacote do aplicativo Android (ex.: "com.nomadfinancial.app", "com.nu.production") */
  packageName?: string | null;
  /** Banco emissor específico (ex.: "Rico", "XP Investimentos", "Itaú") */
  issuerBank?: string | null;
  /** Bandeira do cartão (ex.: "Visa", "Mastercard", "Elo", "Amex") para desempate */
  cardBrand?: string | null;
  /** Indica se a transação especificou explicitamente cartão virtual */
  isVirtual?: boolean | null;
  /** Mapa dinâmico de 4 dígitos aprendidos para IDs de cartões (§11.4 / Fase 3) */
  cardDigitsMapping?: CardDigitsMapping | null;
  /** Mapa dinâmico de pacote bancário para ID de cartão memorizado (§Plano 09 — Fase 5) */
  bankCardMapping?: Record<string, string> | null;
  /** ID do cartão preferencial memorizado para o estabelecimento */
  preferredCardId?: string | null;
}

export interface BankAccount {
  id: string;
  name: string;
  institution?: string | null;
  is_active?: boolean;
  type?: string | null;
  color?: string | null;
}

export interface BankAccountResolutionParams {
  /** UUID explícito da conta bancária ou token textual de banco */
  accountId?: string | null;
  /** Nome do banco ou instituição de origem (ex.: "Nubank", "Itaú", "Inter") */
  bankName?: string | null;
  /** Instituição bancária explícita */
  institution?: string | null;
  /** Método de pagamento / liquidação (ex.: "debit", "pix", "transfer") */
  paymentMethod?: string | null;
  /** ID da conta preferencial memorizada para o estabelecimento */
  preferredAccountId?: string | null;
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
  avenue: ["avenue", "avenue securities"],
  "mercado pago": ["mercado pago", "mercadopago"],
  picpay: ["picpay", "picpay card"],
  pagbank: ["pagbank", "pagseguro"],
  neon: ["neon"],
  next: ["next"],
  sofisa: ["sofisa", "sofisa direto"],
  pan: ["pan", "banco pan"],
  bv: ["bv", "banco bv", "financeira bv"],
  cora: ["cora", "banco cora"],
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
 * Extrai 4 dígitos finais de strings textuais variadas:
 * "1234", "final 1234", "terminado em 5678", "**** 9012", "****-1234", "cartão final 4321".
 */
export function extractLastFourDigits(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  // Padrões explícitos com prefixos comuns em notificações bancárias
  const explicitMatch = trimmed.match(
    /(?:final|terminad[oa]\s+em|\*{2,4}|[•*]{2,4}|cart[ãa]o\s*final)?\s*[:#-]?\s*(\d{4})\b/i,
  );
  if (explicitMatch && explicitMatch[1]) {
    return explicitMatch[1];
  }
  const fallback = trimmed.match(/\b(\d{4})\b/);
  return fallback ? fallback[1] : undefined;
}

/**
 * Verifica se o nome ou a bandeira corresponde ao termo do banco.
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
        // Para termos curtos (ex: "xp", "nu", "bb", "c6", "bv"), exige fronteira de palavra
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
 * Desempate entre múltiplos cartões usando 4 dígitos, virtual/físico ou bandeira.
 */
function tieBreakCards(
  candidates: CreditCard[],
  params: CardResolutionParams,
): CreditCard | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  // 1. Desempate por 4 dígitos
  const digits =
    extractLastFourDigits(params.cardLastDigits) ||
    extractLastFourDigits(params.cardId);
  if (digits) {
    const digitMatch = candidates.find((c) => {
      const normName = c.name.toLowerCase();
      return (
        normName.includes(digits) ||
        new RegExp(`(?:\\b|\\D)${digits}(?:\\b|\\D|$)`).test(normName)
      );
    });
    if (digitMatch) return digitMatch;
  }

  // 2. Desempate por virtual vs físico
  if (params.isVirtual !== undefined && params.isVirtual !== null) {
    if (params.isVirtual) {
      const virtualMatch = candidates.find((c) =>
        normalizeText(c.name).includes("virtual"),
      );
      if (virtualMatch) return virtualMatch;
    } else {
      const physicalMatch = candidates.find(
        (c) => !normalizeText(c.name).includes("virtual"),
      );
      if (physicalMatch) return physicalMatch;
    }
  }

  // 3. Desempate por bandeira
  if (params.cardBrand) {
    const normBrand = normalizeText(params.cardBrand);
    const brandMatch = candidates.find((c) => {
      const cBrand = c.brand ? normalizeText(c.brand) : "";
      const cName = normalizeText(c.name);
      return (
        cBrand.includes(normBrand) ||
        cName.includes(normBrand) ||
        (normBrand === "amex" && (cBrand.includes("american") || cName.includes("american")))
      );
    });
    if (brandMatch) return brandMatch;
  }

  // Fallback: primeiro da lista de candidatos
  return candidates[0];
}

/**
 * Resolve o cartão de crédito mais aderente a partir da carteira de cartões do usuário
 * e parâmetros contextuais capturados (ID, dígitos finais, nome do banco, emissor, bandeira ou tipo virtual).
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
    extractLastFourDigits(params.cardLastDigits) ||
    extractLastFourDigits(params.cardId);

  // =========================================================================
  // NÍVEL 1: Match por 4 dígitos (last_four_digits cadastrado, aprendidos ou nome)
  // =========================================================================
  if (digits) {
    // 1a. last_four_digits cadastrado explicitamente no cartão
    const exactDigitsMatch = activeCards.find(
      (c) => c.last_four_digits && c.last_four_digits === digits,
    );
    if (exactDigitsMatch) {
      return exactDigitsMatch;
    }

    // 1b. Dígitos aprendidos na memória contínua (cardDigitsMapping)
    if (params.cardDigitsMapping) {
      const learnedCardId = lookupCardByDigits(digits, params.cardDigitsMapping);
      if (learnedCardId) {
        const learnedCard = activeCards.find((c) => c.id === learnedCardId);
        if (learnedCard) {
          return learnedCard;
        }
      }
    }

    // 1c. Dígitos contidos no nome do cartão cadastrado
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
  // NÍVEL 2: Cartão Preferencial Memorizado do Estabelecimento (Merchant Learning)
  // =========================================================================
  if (params.preferredCardId) {
    const preferredMatch = activeCards.find((c) => c.id === params.preferredCardId);
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  // =========================================================================
  // NÍVEL 3: Vínculo por Instituição / App Emissor (bankCardMapping ou banco único)
  // =========================================================================
  const bankPackageOrName = params.packageName || params.bankName || params.issuerBank;
  if (bankPackageOrName) {
    // 3a. Consulta na memória adaptativa de pacote/banco
    if (params.bankCardMapping) {
      const mappedId = params.bankCardMapping[bankPackageOrName];
      if (mappedId) {
        const mappedCard = activeCards.find((c) => c.id === mappedId);
        if (mappedCard) return mappedCard;
      }
    }

    // 3b. Se o usuário possui exatamente 1 cartão daquela instituição
    const bankMatchingCards = activeCards.filter((c) =>
      cardMatchesBankTerm(c.name, bankPackageOrName),
    );
    if (bankMatchingCards.length === 1) {
      return bankMatchingCards[0];
    }
    if (bankMatchingCards.length > 1) {
      const broken = tieBreakCards(bankMatchingCards, params);
      if (broken) return broken;
    }
  }

  // =========================================================================
  // NÍVEL 4: Match Semântico por Emissor / Nome / Bandeira
  // =========================================================================
  const bankCandidates = [params.issuerBank, params.bankName, params.cardId].filter(
    (b): b is string => Boolean(b && b.trim() && !extractLastFourDigits(b)),
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
      return (
        cBrand.includes(normBrand) ||
        cName.includes(normBrand) ||
        (normBrand === "amex" && (cBrand.includes("american") || cName.includes("american")))
      );
    });

    if (brandMatches.length === 1) {
      return brandMatches[0];
    }

    if (brandMatches.length > 1) {
      const broken = tieBreakCards(brandMatches, params);
      if (broken) return broken;
    }
  }

  // =========================================================================
  // NÍVEL 5: Fallback Seguro para Cartão Ativo Único
  // =========================================================================
  if (activeCards.length === 1) {
    return activeCards[0];
  }

  // =========================================================================
  // NÍVEL 6: Retorna undefined se nenhum critério casar em carteira multi-cartão
  // =========================================================================
  return undefined;
}

/**
 * Resolve a conta bancária mais aderente para liquidação de transações em débito, Pix ou transferências.
 * Função 100% pura: sem efeitos colaterais.
 */
export function resolveBestMatchingBankAccount(
  accounts: BankAccount[] | undefined | null,
  params: BankAccountResolutionParams = {},
): BankAccount | undefined {
  if (!accounts || accounts.length === 0) return undefined;

  const activeAccounts = accounts.filter((a) => a.is_active !== false);
  if (activeAccounts.length === 0) return undefined;

  // 1. Correspondência exata por accountId
  if (params.accountId) {
    const exactMatch = activeAccounts.find((a) => a.id === params.accountId);
    if (exactMatch) return exactMatch;
  }

  // 2. Conta preferencial do estabelecimento
  if (params.preferredAccountId) {
    const preferredMatch = activeAccounts.find((a) => a.id === params.preferredAccountId);
    if (preferredMatch) return preferredMatch;
  }

  // 3. Correspondência por nome da conta ou instituição via aliases bancários
  const bankCandidates = [params.institution, params.bankName, params.accountId].filter(
    (b): b is string => Boolean(b && b.trim() && !extractLastFourDigits(b)),
  );

  for (const candidate of bankCandidates) {
    const matched = activeAccounts.filter((a) => {
      const nameMatch = cardMatchesBankTerm(a.name, candidate);
      const instMatch = a.institution ? cardMatchesBankTerm(a.institution, candidate) : false;
      return nameMatch || instMatch;
    });

    if (matched.length === 1) {
      return matched[0];
    }
    if (matched.length > 1) {
      return matched[0];
    }
  }

  // 4. Se houver apenas 1 conta ativa, adota-a como fallback seguro
  if (activeAccounts.length === 1) {
    return activeAccounts[0];
  }

  return undefined;
}
