/**
 * Pipeline de Resolução Hierárquica em 3 Camadas de Estabelecimentos (§2.3).
 *
 * Arquitetura de 3 Camadas:
 * 1ª Camada (Chave de Ouro): Correspondência exata por CNPJ/CPF limpo (precisão 100%).
 * 2ª Camada (Memória Adaptativa): Correspondência por nome amigável ou aliases aprendidos do usuário.
 * 3ª Camada (Catálogo Canônico + Inferência): Catálogo de 130+ marcas brasileiras e motor semântico de palavras-chave.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, React ou banco de dados.
 */

import type { PaymentMethod } from "@/types/schema";
import type { CanonicalCategorySlug } from "./category-inference";
import { inferCategoryKeyword } from "./category-inference";
import {
  cleanAcquirerPrefixes,
  findCanonicalMerchant,
} from "./merchant-catalog";
import {
  cleanTaxId,
  extractTaxIdFromText,
  findLearnedMerchant,
  type MerchantLearningMemory,
} from "./merchant-memory";

export type MerchantResolutionConfidence =
  | "exact_tax_id"
  | "learned_alias"
  | "canonical_catalog"
  | "inferred_keyword"
  | "fallback";

export interface ResolveMerchantIdentityParams {
  /** Nome ou descrição bruta recebida (ex.: "PAG*Padaria Estrela", "Uber *Trip"). */
  merchantOrDescription?: string;
  /** Texto bruto completo da notificação ou comprovante (para extração contextual de CNPJ/CPF). */
  rawText?: string;
  /** CNPJ ou CPF informado ou extraído previamente (opcional). */
  taxId?: string;
  /** Memória semântica personalizada aprendida pelo usuário (§2.1). */
  userMemory?: MerchantLearningMemory;
  /** Categoria canônica padrão caso nenhuma regra seja satisfeita (default: "compras"). */
  fallbackCategorySlug?: CanonicalCategorySlug;
}

export interface ResolvedMerchantIdentity {
  /** Nome amigável / fantasia formatado para exibição e salvamento. */
  friendlyName: string;
  /** Slug canônico da categoria identificada. */
  categorySlug: CanonicalCategorySlug;
  /** Grau de precisão da resolução. */
  confidence: MerchantResolutionConfidence;
  /** Indica se a correspondência veio da memória adaptativa do usuário (1ª ou 2ª camada). */
  isLearned: boolean;
  /** CNPJ ou CPF associado, se identificado. */
  taxId?: string;
  /** Identificador da camada vitoriosa na hierarquia. */
  layer: 1 | 2 | 3 | "fallback";
  /** Método de pagamento preferencial memorizado para o estabelecimento (se aprendido). */
  preferredPaymentMethod?: PaymentMethod;
  /** ID do cartão de crédito preferencial memorizado para o estabelecimento (se aprendido). */
  preferredCardId?: string;
}

const LOWERCASE_CONNECTORS = new Set([
  "a",
  "as",
  "o",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "com",
  "por",
  "para",
]);

/**
 * Normaliza caixas altas excessivas preservando conectivos da língua portuguesa.
 */
export function formatFriendlyTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // Se já possui caixa mista (ex: "McDonald's", "iFood"), preserva a grafia original
  const hasLower = /[a-zà-ÿ]/.test(trimmed);
  const hasUpper = /[A-ZÀ-ß]/.test(trimmed);
  if (hasLower && hasUpper) {
    return trimmed;
  }

  // Se estiver tudo em maiúsculas (ou tudo em minúsculas), formata em Title Case suave
  const words = trimmed.toLowerCase().split(/\s+/);
  const capitalized = words.map((word, index) => {
    if (index > 0 && LOWERCASE_CONNECTORS.has(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return capitalized.join(" ");
}

/**
 * Pipeline hierárquico puro que resolve a identidade e categoria de um estabelecimento em 3 camadas.
 */
export function resolveMerchantIdentity(
  params: ResolveMerchantIdentityParams,
): ResolvedMerchantIdentity {
  const defaultCategory = params.fallbackCategorySlug || "compras";
  const rawInput = params.merchantOrDescription || "";
  const cleanedMerchant = cleanAcquirerPrefixes(rawInput);

  // =========================================================================
  // 1ª CAMADA — Chave de Ouro (CNPJ / CPF com precisão 100%)
  // =========================================================================
  const explicitTax = cleanTaxId(params.taxId);
  const extractedTax =
    explicitTax ||
    extractTaxIdFromText(params.merchantOrDescription) ||
    extractTaxIdFromText(params.rawText);

  if (extractedTax) {
    // 1A. Memória Adaptativa do Usuário por Documento
    if (params.userMemory) {
      const learnedByTax = findLearnedMerchant(
        { taxId: extractedTax },
        params.userMemory,
      );
      if (learnedByTax) {
        return {
          friendlyName: learnedByTax.friendlyName,
          categorySlug: learnedByTax.categorySlug as CanonicalCategorySlug,
          confidence: "exact_tax_id",
          isLearned: true,
          taxId: extractedTax,
          layer: 1,
          preferredPaymentMethod: learnedByTax.preferredPaymentMethod,
          preferredCardId: learnedByTax.preferredCardId,
        };
      }
    }

    // 1B. Catálogo Canônico Nativo por Documento
    const canonicalByTax = findCanonicalMerchant(extractedTax);
    if (canonicalByTax) {
      return {
        friendlyName: canonicalByTax.friendlyName,
        categorySlug: canonicalByTax.categorySlug,
        confidence: "exact_tax_id",
        isLearned: false,
        taxId: extractedTax,
        layer: 1,
      };
    }
  }

  // =========================================================================
  // 2ª CAMADA — Memória Adaptativa do Usuário (Nome amigável e aliases)
  // =========================================================================
  if (params.userMemory && (cleanedMerchant || rawInput || params.rawText)) {
    const rawContext = [rawInput, params.rawText].filter(Boolean).join(" ");
    const learnedByAlias =
      findLearnedMerchant(
        {
          taxId: extractedTax,
          merchant: cleanedMerchant,
          rawText: rawContext,
        },
        params.userMemory,
      ) ||
      findLearnedMerchant(
        {
          taxId: extractedTax,
          merchant: rawInput,
          rawText: rawContext,
        },
        params.userMemory,
      );

    if (learnedByAlias) {
      return {
        friendlyName: learnedByAlias.friendlyName,
        categorySlug: learnedByAlias.categorySlug as CanonicalCategorySlug,
        confidence: "learned_alias",
        isLearned: true,
        taxId: learnedByAlias.cnpjOrCpf || extractedTax,
        layer: 2,
        preferredPaymentMethod: learnedByAlias.preferredPaymentMethod,
        preferredCardId: learnedByAlias.preferredCardId,
      };
    }
  }

  // =========================================================================
  // 3ª CAMADA — Catálogo Base Canônico + Inferência por Palavras-Chave
  // =========================================================================
  // 3A. Catálogo Base Canônico de Marcas Brasileiras
  const searchCandidates = [cleanedMerchant, params.merchantOrDescription, params.rawText].filter(
    (c): c is string => Boolean(c && c.trim().length >= 2),
  );

  for (const candidate of searchCandidates) {
    const canonical = findCanonicalMerchant(candidate);
    if (canonical) {
      return {
        friendlyName: canonical.friendlyName,
        categorySlug: canonical.categorySlug,
        confidence: "canonical_catalog",
        isLearned: false,
        taxId: canonical.cnpjs?.[0] || extractedTax,
        layer: 3,
      };
    }
  }

  // 3B. Inferência Semântica por Palavras-Chave no Nome / Descrição
  const candidateForInference = cleanedMerchant || rawInput || params.rawText || "";
  const inferredSlug = inferCategoryKeyword(candidateForInference);

  if (inferredSlug) {
    const friendly = formatFriendlyTitle(cleanedMerchant || rawInput || "Despesa");
    return {
      friendlyName: friendly,
      categorySlug: inferredSlug,
      confidence: "inferred_keyword",
      isLearned: false,
      taxId: extractedTax,
      layer: 3,
    };
  }

  // =========================================================================
  // FALLBACK — Preserva o termo higienizado com categoria padrão
  // =========================================================================
  const fallbackFriendly = formatFriendlyTitle(cleanedMerchant || rawInput || "Despesa");
  return {
    friendlyName: fallbackFriendly,
    categorySlug: defaultCategory,
    confidence: "fallback",
    isLearned: false,
    taxId: extractedTax,
    layer: "fallback",
  };
}
