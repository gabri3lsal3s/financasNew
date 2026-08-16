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
export type ServiceSegment = "streaming" | "fitness" | "cloud_ai" | "telecom" | "mobility" | "health" | "other";

export const SERVICE_SEGMENT_LABELS: Record<ServiceSegment, string> = {
  streaming: "Streaming",
  fitness: "Fitness",
  cloud_ai: "Nuvem & IA",
  telecom: "Telecom",
  mobility: "Mobilidade",
  health: "Saúde",
  other: "Outros",
};

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
  segment: ServiceSegment;
  /** Economia mensal média se cortada (centavos). */
  savingsIfCutCents: number;
  /** Sinais presentes. */
  signs: { knownName: boolean; subscriptionCategory: boolean; stableValue: boolean };
}

/** Tolerância do sinal de valor exato (default ±5%). */
const VALUE_TOLERANCE = 0.05;

import { ESSENTIAL_CATEGORY_ICONS, matchesServiceKey, valuesWithinTolerance } from "./shared";

export interface KnownServiceDef {
  tier: CutTier;
  segment: ServiceSegment;
}

/** Serviços de assinatura conhecidos (nome normalizado → tier e segmento). */
export const KNOWN_SERVICES: Record<string, KnownServiceDef> = {
  // Streaming e Entretenimento (can_cut)
  netflix: { tier: "can_cut", segment: "streaming" },
  spotify: { tier: "can_cut", segment: "streaming" },
  deezer: { tier: "can_cut", segment: "streaming" },
  tidal: { tier: "can_cut", segment: "streaming" },
  disney: { tier: "can_cut", segment: "streaming" },
  disneyplus: { tier: "can_cut", segment: "streaming" },
  starplus: { tier: "can_cut", segment: "streaming" },
  globoplay: { tier: "can_cut", segment: "streaming" },
  crunchyroll: { tier: "can_cut", segment: "streaming" },
  amazonprime: { tier: "can_cut", segment: "streaming" },
  primevideo: { tier: "can_cut", segment: "streaming" },
  hbo: { tier: "can_cut", segment: "streaming" },
  max: { tier: "can_cut", segment: "streaming" },
  paramount: { tier: "can_cut", segment: "streaming" },
  discovery: { tier: "can_cut", segment: "streaming" },
  twitch: { tier: "can_cut", segment: "streaming" },
  kindle: { tier: "can_cut", segment: "streaming" },
  audible: { tier: "can_cut", segment: "streaming" },
  duolingo: { tier: "can_cut", segment: "streaming" },
  canva: { tier: "can_cut", segment: "cloud_ai" },
  directvgo: { tier: "can_cut", segment: "streaming" },
  mubi: { tier: "can_cut", segment: "streaming" },
  premiere: { tier: "can_cut", segment: "streaming" },
  telecine: { tier: "can_cut", segment: "streaming" },

  // Produtividade, IA, Cloud e Gamificação (discretionary)
  amazon: { tier: "discretionary", segment: "other" },
  apple: { tier: "discretionary", segment: "cloud_ai" },
  appletv: { tier: "discretionary", segment: "streaming" },
  icloud: { tier: "discretionary", segment: "cloud_ai" },
  icloudplus: { tier: "discretionary", segment: "cloud_ai" },
  googleone: { tier: "discretionary", segment: "cloud_ai" },
  youtube: { tier: "discretionary", segment: "streaming" },
  youtubeplus: { tier: "discretionary", segment: "streaming" },
  youtubepremium: { tier: "discretionary", segment: "streaming" },
  academia: { tier: "discretionary", segment: "fitness" },
  smartfit: { tier: "discretionary", segment: "fitness" },
  bluefit: { tier: "discretionary", segment: "fitness" },
  totalpass: { tier: "discretionary", segment: "fitness" },
  gympass: { tier: "discretionary", segment: "fitness" },
  wellhub: { tier: "discretionary", segment: "fitness" },
  skyfit: { tier: "discretionary", segment: "fitness" },
  semparar: { tier: "discretionary", segment: "mobility" },
  veloe: { tier: "discretionary", segment: "mobility" },
  conectcar: { tier: "discretionary", segment: "mobility" },
  tagitau: { tier: "discretionary", segment: "mobility" },
  movemais: { tier: "discretionary", segment: "mobility" },
  zulplus: { tier: "discretionary", segment: "mobility" },
  uol: { tier: "discretionary", segment: "other" },
  folha: { tier: "discretionary", segment: "other" },
  estadao: { tier: "discretionary", segment: "other" },
  globo: { tier: "discretionary", segment: "other" },
  udemy: { tier: "discretionary", segment: "other" },
  coursera: { tier: "discretionary", segment: "other" },
  alura: { tier: "discretionary", segment: "other" },
  rocketseat: { tier: "discretionary", segment: "other" },
  rockseat: { tier: "discretionary", segment: "other" },
  linkedin: { tier: "discretionary", segment: "other" },
  notion: { tier: "discretionary", segment: "cloud_ai" },
  figma: { tier: "discretionary", segment: "cloud_ai" },
  adobe: { tier: "discretionary", segment: "cloud_ai" },
  github: { tier: "discretionary", segment: "cloud_ai" },
  chatgpt: { tier: "discretionary", segment: "cloud_ai" },
  openai: { tier: "discretionary", segment: "cloud_ai" },
  claude: { tier: "discretionary", segment: "cloud_ai" },
  midjourney: { tier: "discretionary", segment: "cloud_ai" },
  copilot: { tier: "discretionary", segment: "cloud_ai" },
  xbox: { tier: "discretionary", segment: "streaming" },
  playstation: { tier: "discretionary", segment: "streaming" },
  psplus: { tier: "discretionary", segment: "streaming" },
  nintendo: { tier: "discretionary", segment: "streaming" },
  steam: { tier: "discretionary", segment: "streaming" },
  dropbox: { tier: "discretionary", segment: "cloud_ai" },
  nordvpn: { tier: "discretionary", segment: "cloud_ai" },
  surfshark: { tier: "discretionary", segment: "cloud_ai" },
  proton: { tier: "discretionary", segment: "cloud_ai" },
  uberone: { tier: "discretionary", segment: "mobility" },
  ifoodpass: { tier: "discretionary", segment: "other" },
  clubeifood: { tier: "discretionary", segment: "other" },

  // Serviços Essenciais (essential)
  microsoft365: { tier: "essential", segment: "cloud_ai" },
  office365: { tier: "essential", segment: "cloud_ai" },
  internet: { tier: "essential", segment: "telecom" },
  telefone: { tier: "essential", segment: "telecom" },
  celular: { tier: "essential", segment: "telecom" },
  vivo: { tier: "essential", segment: "telecom" },
  claro: { tier: "essential", segment: "telecom" },
  tim: { tier: "essential", segment: "telecom" },
  oi: { tier: "essential", segment: "telecom" },
  brisanet: { tier: "essential", segment: "telecom" },
  alares: { tier: "essential", segment: "telecom" },
  desktopinternet: { tier: "essential", segment: "telecom" },
  unifique: { tier: "essential", segment: "telecom" },
  algar: { tier: "essential", segment: "telecom" },
  copeltelecom: { tier: "essential", segment: "telecom" },
  unimed: { tier: "essential", segment: "health" },
  amil: { tier: "essential", segment: "health" },
  sulamerica: { tier: "essential", segment: "health" },
  hapvida: { tier: "essential", segment: "health" },
  notredame: { tier: "essential", segment: "health" },
  bradescosaude: { tier: "essential", segment: "health" },
};

/** Categorias que indicam assinatura. */
const SUBSCRIPTION_CATEGORIES = new Set(["assinaturas", "streaming", "musica", "software"]);

/** Sinal 1 — nome conhecido no catálogo de serviços (com correspondência segura por token). */
function isKnownService(name: string): boolean {
  for (const key of Object.keys(KNOWN_SERVICES)) {
    if (matchesServiceKey(name, key)) return true;
  }
  return false;
}

/** Sinal 2 — categoria de assinatura. */
function isSubscriptionCategory(categoryIcon: string | null | undefined): boolean {
  return categoryIcon != null && SUBSCRIPTION_CATEGORIES.has(categoryIcon);
}

/** Sinal 3 — valores estáveis entre meses (tolerância ±5%). */
function hasStableValue(monthlyValuesCents: readonly number[], tolerance = VALUE_TOLERANCE): boolean {
  return valuesWithinTolerance(monthlyValuesCents, tolerance);
}

/** Segmento do serviço a partir do catálogo ou categoria. */
export function segmentOf(name: string, categoryIcon?: string | null): ServiceSegment {
  for (const [key, def] of Object.entries(KNOWN_SERVICES)) {
    if (matchesServiceKey(name, key)) return def.segment;
  }
  if (categoryIcon === "streaming" || categoryIcon === "musica") return "streaming";
  if (categoryIcon === "saude") return "health";
  if (categoryIcon === "transporte") return "mobility";
  if (categoryIcon === "software") return "cloud_ai";
  return "other";
}

/** Tier a partir do catálogo (com fallback por categoria). */
function tierOf(name: string, categoryIcon: string | null | undefined): CutTier {
  for (const [key, def] of Object.entries(KNOWN_SERVICES)) {
    if (matchesServiceKey(name, key)) return def.tier;
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
    segment: segmentOf(candidate.name, candidate.categoryIcon),
    savingsIfCutCents: averageCents,
    signs,
  };
}

