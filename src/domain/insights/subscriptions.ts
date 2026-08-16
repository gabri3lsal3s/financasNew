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

import { ESSENTIAL_CATEGORY_ICONS, matchesServiceKey, valuesWithinTolerance } from "./shared";

/** Serviços de assinatura conhecidos (nome normalizado → tier de corte). */
export const KNOWN_SERVICES: Record<string, CutTier> = {
  // Streaming e Entretenimento (can_cut)
  netflix: "can_cut",
  spotify: "can_cut",
  deezer: "can_cut",
  tidal: "can_cut",
  disney: "can_cut",
  disneyplus: "can_cut",
  starplus: "can_cut",
  globoplay: "can_cut",
  crunchyroll: "can_cut",
  amazonprime: "can_cut",
  primevideo: "can_cut",
  hbo: "can_cut",
  max: "can_cut",
  paramount: "can_cut",
  discovery: "can_cut",
  twitch: "can_cut",
  kindle: "can_cut",
  audible: "can_cut",
  duolingo: "can_cut",
  canva: "can_cut",
  directvgo: "can_cut",
  mubi: "can_cut",
  premiere: "can_cut",
  telecine: "can_cut",

  // Produtividade, IA, Cloud e Gamificação (discretionary)
  amazon: "discretionary",
  apple: "discretionary",
  appletv: "discretionary",
  icloud: "discretionary",
  icloudplus: "discretionary",
  googleone: "discretionary",
  youtube: "discretionary",
  youtubeplus: "discretionary",
  youtubepremium: "discretionary",
  academia: "discretionary",
  smartfit: "discretionary",
  bluefit: "discretionary",
  totalpass: "discretionary",
  gympass: "discretionary",
  wellhub: "discretionary",
  skyfit: "discretionary",
  semparar: "discretionary",
  veloe: "discretionary",
  conectcar: "discretionary",
  tagitau: "discretionary",
  movemais: "discretionary",
  zulplus: "discretionary",
  uol: "discretionary",
  folha: "discretionary",
  estadao: "discretionary",
  globo: "discretionary",
  udemy: "discretionary",
  coursera: "discretionary",
  alura: "discretionary",
  rocketseat: "discretionary",
  rockseat: "discretionary",
  linkedin: "discretionary",
  notion: "discretionary",
  figma: "discretionary",
  adobe: "discretionary",
  github: "discretionary",
  chatgpt: "discretionary",
  openai: "discretionary",
  claude: "discretionary",
  midjourney: "discretionary",
  copilot: "discretionary",
  xbox: "discretionary",
  playstation: "discretionary",
  psplus: "discretionary",
  nintendo: "discretionary",
  steam: "discretionary",
  dropbox: "discretionary",
  nordvpn: "discretionary",
  surfshark: "discretionary",
  proton: "discretionary",
  uberone: "discretionary",
  ifoodpass: "discretionary",
  clubeifood: "discretionary",

  // Serviços Essenciais (essential)
  microsoft365: "essential",
  office365: "essential",
  internet: "essential",
  telefone: "essential",
  celular: "essential",
  vivo: "essential",
  claro: "essential",
  tim: "essential",
  oi: "essential",
  brisanet: "essential",
  alares: "essential",
  desktopinternet: "essential",
  unifique: "essential",
  algar: "essential",
  copeltelecom: "essential",
  unimed: "essential",
  amil: "essential",
  sulamerica: "essential",
  hapvida: "essential",
  notredame: "essential",
  bradescosaude: "essential",
};

/** Categorias que indicam assinatura. */
const SUBSCRIPTION_CATEGORIES = new Set(["assinaturas", "streaming", "musica", "software"]);

/** Sinal 1 — nome conhecido no catálogo de serviços (com correspondência segura por token). */
export function isKnownService(name: string): boolean {
  for (const key of Object.keys(KNOWN_SERVICES)) {
    if (matchesServiceKey(name, key)) return true;
  }
  return false;
}

/** Sinal 2 — categoria de assinatura. */
export function isSubscriptionCategory(categoryIcon: string | null | undefined): boolean {
  return categoryIcon != null && SUBSCRIPTION_CATEGORIES.has(categoryIcon);
}

/** Sinal 3 — valores estáveis entre meses (tolerância ±5%). */
export function hasStableValue(monthlyValuesCents: readonly number[], tolerance = VALUE_TOLERANCE): boolean {
  return valuesWithinTolerance(monthlyValuesCents, tolerance);
}

/** Tier a partir do catálogo (com fallback por categoria). */
export function tierOf(name: string, categoryIcon: string | null | undefined): CutTier {
  for (const key of Object.keys(KNOWN_SERVICES)) {
    if (matchesServiceKey(name, key)) return KNOWN_SERVICES[key] ?? "discretionary";
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

  // Para ser classificada como assinatura, é obrigatório ter nome conhecido ou categoria de assinatura.
  // Valor estável sozinho indica recorrência geral (recurring), mas não qualifica como assinatura.
  if (!knownName && !subscriptionCategory) return null;

  const count = Number(knownName) + Number(subscriptionCategory) + Number(stableValue);

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

