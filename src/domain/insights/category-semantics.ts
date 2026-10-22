/**
 * Motor puro de semântica de categorias para insights financeiros.
 *
 * Analisa o par (nome, ícone) de qualquer categoria (padrão ou personalizada)
 * para identificar sua intenção financeira de forma determinística e resiliente:
 *   • Essencialidade (§3.7.2): despesas indispensáveis (não cortáveis);
 *   • Agregação (§3.7.3): despesas variáveis frequentes excluídas de recorrência similar;
 *   • Assinatura (§3.7.2): categorização explícita de serviços e mensalidades;
 *   • Resolução semântica para conciliação com sugestões bancárias automáticas.
 *
 * Função pura do domínio: sem dependências de UI, React ou banco de dados.
 */

import { normalizeText, tokenizeText } from "./shared";
import type { CutTier, ServiceSegment } from "./subscriptions";

export type CategoryNature = "essential" | "discretionary" | "investment";

export interface CategorySemantics {
  /** Se é despesa essencial (não sugerida para corte). */
  isEssential: boolean;
  /** Se é categoria agregadora de compras variáveis (excluída de recorrências similares). */
  isAggregator: boolean;
  /** Se é categorização forte de assinaturas / serviços digitais / mensalidades. */
  isSubscriptionCategory: boolean;
  /** Segmento estimado do serviço. */
  segment: ServiceSegment;
  /** Tier financeiro derivado para insights de cortes. */
  tier: CutTier;
  /** Natureza financeira da categoria (Necessidades 50% vs Desejos 30% vs Investimentos 20%). */
  nature: CategoryNature;
  /** Slug canônico inferido mais próximo (ex.: 'mercado', 'saude', 'transporte'). */
  canonicalSlug?: string;
}

/** Ícones que canonicamente representam despesas essenciais no Design System. */
const ESSENTIAL_ICONS = new Set([
  "moradia",
  "saude",
  "educacao",
  "energia",
  "agua",
  "internet",
  "telefone",
  "impostos",
  "tributos",
]);

/** Ícones que representam categorias agregadoras de transações com dispersão natural. */
const AGGREGATOR_ICONS = new Set([
  "mercado",
  "supermercado",
  "combustivel",
  "transporte",
  "farmacia",
  "alimentacao",
]);

/** Ícones que representam assinaturas e serviços recorrentes. */
const SUBSCRIPTION_ICONS = new Set([
  "assinaturas",
  "streaming",
  "musica",
  "software",
  "internet",
  "telefone",
]);

/** Ícones de investimentos. */
const INVESTMENT_ICONS = new Set([
  "investimentos",
  "rendimentos",
  "poupanca",
  "patrimonio",
]);

/**
 * Raízes lexicais de categorias essenciais no contexto financeiro brasileiro.
 */
const ESSENTIAL_STEMS = [
  "moradia",
  "aluguel",
  "condominio",
  "cond",
  "imovel",
  "iptu",
  "financiamento",
  "prestacao",
  "luz",
  "energia",
  "eletricidade",
  "agua",
  "saneamento",
  "esgoto",
  "gas",
  "internet",
  "fibra",
  "banda larga",
  "telefone",
  "telefonia",
  "celular",
  "plano celular",
  "saude",
  "medico",
  "medica",
  "hospital",
  "clinica",
  "consulta",
  "exame",
  "laboratorio",
  "unimed",
  "amil",
  "bradesco saude",
  "sulamerica",
  "hapvida",
  "notredame",
  "convenio",
  "plano de saude",
  "dentista",
  "odontologia",
  "odonto",
  "farmacia",
  "drogaria",
  "medicamento",
  "remedio",
  "educacao",
  "escola",
  "colegio",
  "faculdade",
  "universidade",
  "mensalidade escolar",
  "creche",
  "pos graduacao",
  "curso",
  "imposto",
  "tributo",
  "darf",
  "ipva",
  "taxa",
];

/**
 * Raízes lexicais de categorias agregadoras (compras variáveis que não devem gerar falsos positivos de recorrência).
 */
const AGGREGATOR_STEMS = [
  "mercado",
  "supermercado",
  "hipermercado",
  "mercadinho",
  "hortifruti",
  "sacolao",
  "feira",
  "mercearia",
  "acougue",
  "padaria",
  "atacado",
  "atacadista",
  "combustivel",
  "gasolina",
  "etanol",
  "diesel",
  "posto",
  "abastecimento",
  "transporte",
  "uber",
  "99",
  "onibus",
  "metro",
  "tarifa",
  "pedagio",
  "farmacia",
  "drogaria",
  "droga",
  "medicamento",
  "remedio",
  "alimentacao",
  "refeicao",
  "restaurante",
  "almoco",
  "jantar",
  "lanche",
  "comida",
];

/**
 * Raízes lexicais de categorias de assinaturas.
 */
const SUBSCRIPTION_STEMS = [
  "assinatura",
  "assinaturas",
  "streaming",
  "streamings",
  "musica",
  "software",
  "softwares",
  "saas",
  "mensalidade",
  "recorrencia",
  "recorrente",
  "clube",
  "servico digital",
  "servicos digitais",
];

/**
 * Raízes lexicais de investimentos.
 */
const INVESTMENT_STEMS = [
  "investimento",
  "investimentos",
  "aporte",
  "aportes",
  "poupanca",
  "tesouro",
  "acoes",
  "renda fixa",
  "cripto",
  "carteira",
];

/**
 * Verifica se um texto normalizado contém algum dos termos informados
 * através de correspondência por token ou substring segura.
 */
function containsAnyStem(normalized: string, stems: readonly string[]): boolean {
  if (!normalized) return false;
  const tokens = tokenizeText(normalized);
  for (const stem of stems) {
    const cleanStem = normalizeText(stem);
    if (tokens.includes(cleanStem)) return true;
    if (cleanStem.length > 3 && normalized.includes(cleanStem)) return true;
  }
  return false;
}

/**
 * Resolve a semântica financeira completa de uma categoria com base em seu nome e/ou ícone.
 *
 * @param category Objeto contendo nome e/ou ícone da categoria (padrão ou personalizada).
 * @returns Metadados semânticos determinísticos para alimentar os motores de insights.
 */
export function resolveCategorySemantics(category: {
  name?: string | null;
  icon?: string | null;
}): CategorySemantics {
  const normName = category.name ? normalizeText(category.name) : "";
  const icon = category.icon?.toLowerCase().trim() || null;

  // 1. Assinaturas
  const nameIsSub = containsAnyStem(normName, SUBSCRIPTION_STEMS);
  const iconIsSub = icon != null && SUBSCRIPTION_ICONS.has(icon);
  const isSubscriptionCategory = nameIsSub || iconIsSub;

  // 2. Agregadoras
  const nameIsAggregator = containsAnyStem(normName, AGGREGATOR_STEMS);
  const iconIsAggregator = icon != null && AGGREGATOR_ICONS.has(icon);
  const isAggregator = nameIsAggregator || iconIsAggregator;

  // 3. Essenciais
  const nameIsEssential = containsAnyStem(normName, ESSENTIAL_STEMS);
  const iconIsEssential = icon != null && (ESSENTIAL_ICONS.has(icon) || iconIsAggregator);
  const isEssential = nameIsEssential || iconIsEssential;

  // 4. Investimentos
  const nameIsInvestment = containsAnyStem(normName, INVESTMENT_STEMS);
  const iconIsInvestment = icon != null && INVESTMENT_ICONS.has(icon);
  const isInvestment = nameIsInvestment || iconIsInvestment;

  // 5. Determinação da Natureza Financeira (50/30/20)
  let nature: CategoryNature = "discretionary";
  if (isInvestment) {
    nature = "investment";
  } else if (isEssential) {
    nature = "essential";
  }

  // 6. CutTier para cortes de gastos
  const tier: CutTier = isEssential ? "essential" : "discretionary";

  // 7. Segmento de serviço estimado
  let segment: ServiceSegment = "other";
  if (
    icon === "streaming" ||
    icon === "musica" ||
    normName.includes("streaming") ||
    normName.includes("musica")
  ) {
    segment = "streaming";
  } else if (
    icon === "saude" ||
    normName.includes("saude") ||
    normName.includes("medico") ||
    normName.includes("convenio") ||
    normName.includes("unimed") ||
    normName.includes("hospital") ||
    normName.includes("clinica")
  ) {
    segment = "health";
  } else if (
    icon === "transporte" ||
    icon === "combustivel" ||
    normName.includes("transporte") ||
    normName.includes("combustivel") ||
    normName.includes("uber")
  ) {
    segment = "mobility";
  } else if (
    icon === "software" ||
    normName.includes("software") ||
    normName.includes("saas") ||
    normName.includes("cloud")
  ) {
    segment = "cloud_ai";
  } else if (
    icon === "internet" ||
    icon === "telefone" ||
    normName.includes("internet") ||
    normName.includes("telefone") ||
    normName.includes("celular")
  ) {
    segment = "telecom";
  } else if (
    icon === "luz" ||
    icon === "agua" ||
    icon === "gas" ||
    normName.includes("energia") ||
    normName.includes("luz") ||
    normName.includes("agua") ||
    normName.includes("saneamento") ||
    normName.includes("gas")
  ) {
    segment = "utilities";
  }

  // 8. Canonical Slug de inferência
  let canonicalSlug: string | undefined;
  if (normName.includes("mercado") || icon === "mercado" || icon === "supermercado") {
    canonicalSlug = "mercado";
  } else if (normName.includes("aliment") || normName.includes("restaurante") || icon === "alimentacao") {
    canonicalSlug = "alimentacao";
  } else if (normName.includes("transporte") || normName.includes("combustivel") || icon === "transporte") {
    canonicalSlug = "transporte";
  } else if (normName.includes("saude") || normName.includes("farmacia") || icon === "saude") {
    canonicalSlug = "saude";
  } else if (normName.includes("moradia") || normName.includes("aluguel") || icon === "moradia") {
    canonicalSlug = "moradia";
  } else if (normName.includes("educacao") || normName.includes("escola") || icon === "educacao") {
    canonicalSlug = "educacao";
  } else if (normName.includes("lazer") || icon === "lazer") {
    canonicalSlug = "lazer";
  } else if (isSubscriptionCategory) {
    canonicalSlug = "assinaturas";
  } else if (isInvestment) {
    canonicalSlug = "investimentos";
  }

  return {
    isEssential,
    isAggregator,
    isSubscriptionCategory,
    segment,
    tier,
    nature,
    canonicalSlug,
  };
}

/**
 * Encontra a melhor categoria existente do usuário correspondente a um slug canônico
 * (usado na conciliação e sugestões de transações bancárias/notificações).
 */
export function findBestMatchingCategory<T extends { id: string; name: string; icon?: string | null }>(
  categories: readonly T[],
  targetSlug: string,
): T | undefined {
  if (!categories || categories.length === 0 || !targetSlug) return undefined;
  const cleanTarget = normalizeText(targetSlug);

  // 1. Casamento direto por slug canônico derivado da categoria do usuário
  for (const cat of categories) {
    const sem = resolveCategorySemantics(cat);
    if (sem.canonicalSlug === cleanTarget) {
      return cat;
    }
  }

  // 2. Casamento exato por ícone
  for (const cat of categories) {
    if (cat.icon && normalizeText(cat.icon) === cleanTarget) {
      return cat;
    }
  }

  // 3. Casamento por nome contendo o target
  for (const cat of categories) {
    const catName = normalizeText(cat.name);
    if (catName === cleanTarget || catName.includes(cleanTarget)) {
      return cat;
    }
  }

  return undefined;
}
