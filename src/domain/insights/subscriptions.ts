/**
 * Detecção de assinaturas — ESPECIFICAÇÃO §3.7.2.
 *
 * 3 sinais: nome conhecido (catálogo), categoria de assinatura e valor
 * exato (tolerância ±5% entre ocorrências). Árvore de decisão com
 * confiança 0.40–0.98 e tiers de corte (essential / discretionary /
 * can_cut), reportando `savingsIfCut` (economia mensal se cortada).
 * Motor puro — sem consultas.
 */

export type CutTier = "essential" | "discretionary" | "can_cut";

export interface SubscriptionCandidate {
  /** Nome da despesa (para casar com o catálogo). */
  name: string;
  /** Nome do ícone/normalizado da categoria (ex.: "assinaturas", "lazer"). */
  categoryIcon?: string | null;
  /** Valores mensais (centavos) — para o sinal de estabilidade. */
  monthlyValuesCents: number[];
}

export interface SubscriptionClassification {
  /** 0.40–0.98 (árvore de decisão). */
  confidence: number;
  tier: CutTier;
  /** Economia mensal média se cortada (centavos). */
  savingsIfCutCents: number;
  /** Sinais presentes. */
  signs: { knownName: boolean; subscriptionCategory: boolean; stableValue: boolean };
}

/** Tolerância do sinal de valor exato (default ±5%). */
const VALUE_TOLERANCE = 0.05;

/** Serviços de assinatura conhecidos (nome normalizado → tier de corte). */
export const KNOWN_SERVICES: Record<string, CutTier> = {
  netflix: "can_cut",
  spotify: "can_cut",
  disney: "can_cut",
  disneyplus: "can_cut",
  amazonprime: "can_cut",
  primevideo: "can_cut",
  hbo: "can_cut",
  max: "can_cut",
  paramount: "can_cut",
  apple: "discretionary",
  icloud: "discretionary",
  icloudplus: "discretionary",
  googleone: "discretionary",
  youtube: "discretionary",
  youtubeplus: "discretionary",
  twitch: "can_cut",
  kindle: "can_cut",
  audible: "can_cut",
  duolingo: "can_cut",
  academia: "discretionary",
  udemy: "discretionary",
  coursera: "discretionary",
  linkedin: "discretionary",
  notion: "discretionary",
  figma: "discretionary",
  adobe: "discretionary",
  canva: "can_cut",
  github: "discretionary",
  chatgpt: "discretionary",
  microsoft365: "essential",
  office365: "essential",
  internet: "essential",
  telefone: "essential",
  celular: "essential",
  vivo: "essential",
  claro: "essential",
  tim: "essential",
  oi: "essential",
};

/** Categorias que indicam assinatura. */
const SUBSCRIPTION_CATEGORIES = new Set(["assinaturas", "streaming", "musica", "software"]);

import { ESSENTIAL_CATEGORY_ICONS, normalizeServiceKey, valuesWithinTolerance } from "./shared";

/** Sinal 1 — nome conhecido no catálogo de serviços. */
export function isKnownService(name: string): boolean {
  const normalized = normalizeServiceKey(name);
  for (const key of Object.keys(KNOWN_SERVICES)) {
    if (normalized.includes(key)) return true;
  }
  return false;
}

/** Sinal 2 — categoria de assinatura. */
export function isSubscriptionCategory(categoryIcon: string | null | undefined): boolean {
  return categoryIcon != null && SUBSCRIPTION_CATEGORIES.has(categoryIcon);
}

/** Sinal 3 — valores estáveis entre meses (tolerância ±5%). */
/** Sinal 3 — valores estáveis entre meses (delega para a fonte única). */
export function hasStableValue(monthlyValuesCents: readonly number[], tolerance = VALUE_TOLERANCE): boolean {
  return valuesWithinTolerance(monthlyValuesCents, tolerance);
}

/** Tier a partir do catálogo (com fallback por categoria). */
export function tierOf(name: string, categoryIcon: string | null | undefined): CutTier {
  const normalized = normalizeServiceKey(name);
  for (const key of Object.keys(KNOWN_SERVICES)) {
    if (normalized.includes(key)) return KNOWN_SERVICES[key] ?? "discretionary";
  }
  if (categoryIcon && ESSENTIAL_CATEGORY_ICONS.has(categoryIcon)) return "essential";
  return "discretionary";
}

/**
 * Árvore de decisão: confiança pela combinação de sinais (0.40–0.98).
 * Candidato SEM nenhum sinal não é assinatura (retorna null).
 */
export function classifySubscription(candidate: SubscriptionCandidate): SubscriptionClassification | null {
  const knownName = isKnownService(candidate.name);
  const subscriptionCategory = isSubscriptionCategory(candidate.categoryIcon);
  const stableValue = hasStableValue(candidate.monthlyValuesCents);
  const signs = { knownName, subscriptionCategory, stableValue };
  const count = Number(knownName) + Number(subscriptionCategory) + Number(stableValue);

  if (count === 0) return null;

  // Árvore: 3 sinais → 0.98 · 2 sinais → 0.80 · 1 sinal → 0.60 (mín. 0.40).
  const confidence = count === 3 ? 0.98 : count === 2 ? 0.8 : 0.6;

  const averageCents = candidate.monthlyValuesCents.length > 0
    ? Math.round(candidate.monthlyValuesCents.reduce((acc, v) => acc + v, 0) / candidate.monthlyValuesCents.length)
    : 0;

  return {
    confidence: Math.min(0.98, Math.max(0.4, confidence)),
    tier: tierOf(candidate.name, candidate.categoryIcon),
    savingsIfCutCents: averageCents,
    signs,
  };
}
