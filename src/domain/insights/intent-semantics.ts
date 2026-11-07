/**
 * Motor Semântico de Intenção e Agrupamento de Hábitos — ESPECIFICAÇÃO & F30.
 *
 * Função pura e determinística responsável por:
 *   1. Mapear variações descritivas livres ("ida para Caju", "ida para Glória", "volta Unic", "almoço PF", "lanche")
 *      em intenções financeiras comportamentais canônicas;
 *   2. Gerar chaves de cluster estáveis (HabitClusterKey) associadas à categoria;
 *   3. Preservar contratos de serviços conhecidos (Netflix, Spotify, Condomínio) como assinaturas reais.
 */

import { normalizeText, stripTemporalSuffixes } from "./shared";
import { findMatchingServiceKey } from "./subscriptions";
import type { ExpenseLike } from "./recurrences";

export type IntentKind =
  | "mobility:commute"
  | "food:daily_meals"
  | "food:delivery"
  | "food:coffee_snacks"
  | "pantry:groceries"
  | "health:pharmacy"
  | "personal_care:routine"
  | "leisure:casual"
  | "general:other";

export interface IntentDescriptor {
  kind: IntentKind;
  canonicalLabel: string;
  defaultActionLabel: string;
}

export const INTENT_DESCRIPTORS: Record<IntentKind, IntentDescriptor> = {
  "mobility:commute": {
    kind: "mobility:commute",
    canonicalLabel: "Deslocamentos e transporte",
    defaultActionLabel: "Definir teto para transporte",
  },
  "food:daily_meals": {
    kind: "food:daily_meals",
    canonicalLabel: "Refeições e almoços fora",
    defaultActionLabel: "Definir teto para refeições",
  },
  "food:delivery": {
    kind: "food:delivery",
    canonicalLabel: "Entregas e delivery",
    defaultActionLabel: "Definir teto para delivery",
  },
  "food:coffee_snacks": {
    kind: "food:coffee_snacks",
    canonicalLabel: "Cafés e pequenos lanches",
    defaultActionLabel: "Ajustar gastos com lanches",
  },
  "pantry:groceries": {
    kind: "pantry:groceries",
    canonicalLabel: "Mercado e abastecimento",
    defaultActionLabel: "Definir teto para mercado",
  },
  "health:pharmacy": {
    kind: "health:pharmacy",
    canonicalLabel: "Farmácia e cuidados com a saúde",
    defaultActionLabel: "Ajustar gastos de farmácia",
  },
  "personal_care:routine": {
    kind: "personal_care:routine",
    canonicalLabel: "Serviços e cuidados pessoais",
    defaultActionLabel: "Ajustar serviços de rotina",
  },
  "leisure:casual": {
    kind: "leisure:casual",
    canonicalLabel: "Lazer e passeios casuais",
    defaultActionLabel: "Definir teto para lazer",
  },
  "general:other": {
    kind: "general:other",
    canonicalLabel: "Gastos habituais recorrentes",
    defaultActionLabel: "Definir meta para esta categoria",
  },
};

/** Radicais e prefixos de mobilidade e trajetos */
const MOBILITY_PATTERNS = [
  /\b(?:ida|volta|trajeto|deslocamento|viagem|corrida|corrida\s*uber|uber|99\s*app|99pop|taxi|t[aá]xi|onibus|[oô]nibus|metro|metr[oô]|tarifa|bilhete|recarga\s*transporte|pedagio|ped[aá]gio)\b/i,
  /\b(?:ida\s+para|volta\s+de|volta\s+para|indo\s+para|voltando\s+de|carona)\b/i,
];

/** Radicais de refeições de rotina */
const DAILY_MEALS_PATTERNS = [
  /\b(?:almoco|almo[cç]o|jantar|refeicao|refei[cç][aã]o|marmita|marmitex|prato\s*feito|pf|restaurante|buffet|self\s*service|bandejao|bandej[aã]o|giraffas|subway|spoleto|mcdonalds|burger\s*king)\b/i,
];

/** Radicais de delivery de comida */
const DELIVERY_PATTERNS = [
  /\b(?:ifood|rappi|aiqfome|ubereats|uber\s*eats|delivery|entrega\s*comida|tele\s*entrega)\b/i,
];

/** Radicais de cafés e lanches */
const COFFEE_SNACKS_PATTERNS = [
  /\b(?:cafe|caf[eé]|cafeteria|expresso|lanche|lancheira|salgado|salgados|pao\s*de\s*queijo|p[aã]o\s*de\s*queijo|pastel|pastelaria|suco|acai|a[cç]a[ií]|sorvete|sorveteria|chocolate|doceria|confeitaria|padoca)\b/i,
];

/** Radicais de abastecimento doméstico */
const PANTRY_PATTERNS = [
  /\b(?:mercado|supermercado|hipermercado|mercadinho|hortifruti|sacolao|sacol[aã]o|feira|feira\s*livre|acougue|a[cç]ougue|padaria|mercearia|quitanda|atacado|atacadista)\b/i,
];

/** Radicais de farmácia e medicamentos */
const PHARMACY_PATTERNS = [
  /\b(?:farmacia|farm[aá]cia|drogaria|droga\s*raia|drogasil|pague\s*menos|sao\s*paulo|panvel|remedio|rem[eé]dio|medicamento|curativo)\b/i,
];

/** Radicais de serviços de cuidados pessoais */
const PERSONAL_CARE_PATTERNS = [
  /\b(?:diarista|faxina|terapia|psicolog|personal|pilates|barbearia|barbeiro|salao|sal[aã]o|cabelo|corte\s*cabelo|manicure|pedicure|depilacao|estetica)\b/i,
];

/** Radicais de lazer casual */
const LEISURE_PATTERNS = [
  /\b(?:cinema|filme|pipoca|teatro|show|bar|barzinho|chopp|cerveja|petisco|pub|botequim|parque|ingresso)\b/i,
];

/**
 * Infere a intenção semântica com base na descrição e/ou contexto de categoria.
 */
export function inferIntentFromDescription(
  rawDescription: string,
  categoryIconOrSlug?: string | null,
): IntentKind {
  const clean = stripTemporalSuffixes(rawDescription || "");
  const normalized = normalizeText(clean);
  const icon = (categoryIconOrSlug || "").toLowerCase().trim();

  // 1. Delivery prioritário se citar apps de entrega
  if (DELIVERY_PATTERNS.some((p) => p.test(normalized))) {
    return "food:delivery";
  }

  // 2. Mobilidade e trajetos
  if (
    MOBILITY_PATTERNS.some((p) => p.test(normalized)) ||
    (icon === "transporte" && MOBILITY_PATTERNS.some((p) => p.test(normalized))) ||
    (icon === "transporte" && (normalized.startsWith("ida ") || normalized.startsWith("volta ") || normalized.includes(" para ")))
  ) {
    return "mobility:commute";
  }

  // 3. Cafés e lanches rápidos
  if (COFFEE_SNACKS_PATTERNS.some((p) => p.test(normalized))) {
    return "food:coffee_snacks";
  }

  // 4. Refeições de rotina
  if (
    DAILY_MEALS_PATTERNS.some((p) => p.test(normalized)) ||
    (icon === "alimentacao" && DAILY_MEALS_PATTERNS.some((p) => p.test(normalized)))
  ) {
    return "food:daily_meals";
  }

  // 5. Abastecimento doméstico / feira / mercado
  if (
    PANTRY_PATTERNS.some((p) => p.test(normalized)) ||
    (icon === "mercado" || icon === "supermercado")
  ) {
    return "pantry:groceries";
  }

  // 6. Farmácia
  if (
    PHARMACY_PATTERNS.some((p) => p.test(normalized)) ||
    icon === "farmacia"
  ) {
    return "health:pharmacy";
  }

  // 7. Cuidados pessoais
  if (PERSONAL_CARE_PATTERNS.some((p) => p.test(normalized))) {
    return "personal_care:routine";
  }

  // 8. Lazer casual
  if (
    LEISURE_PATTERNS.some((p) => p.test(normalized)) ||
    icon === "lazer"
  ) {
    return "leisure:casual";
  }

  // 9. Fallback baseado no ícone da categoria agregadora
  if (icon === "transporte") return "mobility:commute";
  if (icon === "alimentacao") return "food:daily_meals";

  return "general:other";
}

export interface HabitClusterResult {
  clusterKey: string;
  intentKind: IntentKind;
  isSubscription: boolean;
  canonicalLabel: string;
  defaultActionLabel: string;
  matchedServiceName?: string | null;
}

/**
 * Extrai a chave de cluster e metadados de uma despesa.
 * Se corresponder a uma assinatura cadastrada/conhecida (ex.: Netflix, Spotify),
 * preserva a chave de serviço estrita. Caso contrário, gera uma chave estável de hábito.
 */
export function extractHabitClusterKey(
  expense: ExpenseLike,
  options: {
    categoryIconOrSlug?: string | null;
    customAliases?: Record<string, string>;
  } = {},
): HabitClusterResult {
  const rawDesc = (expense.description ?? "").trim();
  const matchedService = findMatchingServiceKey(rawDesc);

  // Se for assinatura conhecida (Netflix, Spotify, Gympass, etc.), preserva o trilho de assinatura
  if (matchedService) {
    return {
      clusterKey: `subscription:${matchedService}`,
      intentKind: "general:other",
      isSubscription: true,
      canonicalLabel: rawDesc || matchedService,
      defaultActionLabel: "Avaliar assinatura",
      matchedServiceName: matchedService,
    };
  }

  const categoryContext = options.categoryIconOrSlug ?? expense.categoryIcon ?? null;
  const intentKind = inferIntentFromDescription(rawDesc, categoryContext);
  const descriptor = INTENT_DESCRIPTORS[intentKind];

  const categoryId = expense.categoryId || "uncategorized";

  // Se houver intenção reconhecida (ex: mobility:commute), a chave agrupa pela Categoria + Intenção
  if (intentKind !== "general:other") {
    return {
      clusterKey: `habit:${categoryId}:${intentKind}`,
      intentKind,
      isSubscription: false,
      canonicalLabel: descriptor.canonicalLabel,
      defaultActionLabel: descriptor.defaultActionLabel,
      matchedServiceName: null,
    };
  }

  // Fallback: se a despesa tiver descrição limpa utilizável
  const cleanDesc = stripTemporalSuffixes(rawDesc) || rawDesc;
  const normalizedDesc = normalizeText(cleanDesc);

  return {
    clusterKey: `habit:${categoryId}:${normalizedDesc || "item"}`,
    intentKind: "general:other",
    isSubscription: false,
    canonicalLabel: cleanDesc || expense.categoryName || "Gasto habitual",
    defaultActionLabel: descriptor.defaultActionLabel,
    matchedServiceName: null,
  };
}
