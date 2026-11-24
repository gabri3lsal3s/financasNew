/**
 * Grafo Unificado de Aprendizado (UnifiedLearningGraph) — PLANO MESTRE FASE 1.
 *
 * Consolida em uma única estrutura pura e imutável todos os sinais explícitos e implícitos
 * que o usuário ensinou ao aplicativo:
 *   • Decisões de feedback (`insight_feedback`) com escopo temporal preciso para `one_off`:
 *       - `tx_one_off:<expenseId>` (despesa específica);
 *       - `one_off:YYYY-MM:<slug>` (hábito/recorrência em mês explícito);
 *       - legado `one_off` sem mês na chave → aplica-se estritamente a `createdAt.slice(0, 7)`.
 *   • Orçamentos ativos por categoria (`budgetedCategoryLimits`);
 *   • Aliases aprendidos de estabelecimentos (`merchantAliasMap`);
 *   • Perfil de entrada de renda (`PaydayProfile`) inferido do histórico;
 *   • Estado de fadiga/decaimento por família de insight (`SmartDecayRecord`).
 *
 * Motor 100% puro — sem dependências de UI, React ou Supabase.
 */

import { budgetLimitsByCategory, resolveEffectiveLimit } from "@/domain/budgets";
import { numberToCents } from "@/domain/money";
import type { FeedbackDecision, FeedbackMap } from "./feedback";
import { medianOf } from "./recurrences";
import { normalizeText, stripTemporalSuffixes } from "./shared";
import type { CutTier, ServiceSegment } from "./subscriptions";

export interface FeedbackEntry {
  occurrenceKey: string;
  decision: FeedbackDecision;
  /** ISO timestamp da tabela `insight_feedback.created_at` (fallback de escopo mensal para `one_off` legado). */
  createdAt?: string | null;
}

export type PaydayPattern =
  | "unknown"
  | "start_of_month" // 1..10 (típico CLT 5º dia útil)
  | "biweekly" // 2 entradas principais (ex.: dia 15 + dia 30)
  | "late_month" // 20..31 (comissionado / recebimento fim de mês)
  | "variable_flow"; // autônomo / múltiplas datas sem padrão fixo

export interface PaydayProfile {
  pattern: PaydayPattern;
  typicalIncomeDays: readonly number[];
  expectedMonthlyIncomeCents: number;
  confidence: number; // 0..1
  monthsAnalyzed: number;
}

export type InsightThemeFamily =
  | "pace"
  | "cash_gap"
  | "surplus"
  | "habit"
  | "savings_cut"
  | "price_adjustment"
  | "calibration"
  | "income_confirm"
  | "missing_expense"
  | "annual_commitment"
  | "celebration"
  | "monthly_closing";

export interface SmartDecayRecord {
  dismissCount: number;
  lastDismissedAt: string;
  dismissedUntil: number;
  muted?: boolean;
}

export interface LearningMerchantRecordLike {
  friendlyName?: string;
  rawAliases?: readonly string[];
  serviceSegment?: string;
  cutTier?: CutTier;
  isLearnedSubscription?: boolean;
  semanticTags?: readonly string[];
  incomeProfile?: "fixed" | "frequent_client";
}

export interface LearnedServiceInfo {
  canonicalKey: string;
  friendlyName: string;
  segment: ServiceSegment;
  tier: CutTier;
  isSubscription: boolean;
}

export interface LearningIncomeInput {
  id?: string;
  date: string;
  value: number;
  report_weight?: number | null;
  source_ref?: string | null;
  description?: string | null;
  category_id?: string | null;
}

export interface LearningBudgetInput {
  category_id: string;
  month: string;
  limit: number;
}

export interface BuildUnifiedLearningGraphInput {
  /** Mês de referência (YYYY-MM). */
  referenceMonth: string;
  /** Entradas completas de feedback com `createdAt` (preferencial). */
  feedbackEntries?: readonly FeedbackEntry[];
  /** Mapa legado occurrenceKey -> decision (usado se `feedbackEntries` não for informado). */
  feedbackMap?: FeedbackMap;
  /** Orçamentos cadastrados pelo usuário. */
  budgets?: readonly LearningBudgetInput[];
  /** Memória de estabelecimentos (`custom_settings.merchantLearning`). */
  merchantLearning?: Readonly<Record<string, LearningMerchantRecordLike>> | null;
  /** Receitas históricas (preferencialmente últimos 3 a 6 meses, incluindo ou não o mês atual). */
  historicalIncomes?: readonly LearningIncomeInput[];
  /** Metas de receita cadastradas para o mês de referência (reforçam expectedMonthlyIncomeCents). */
  incomeGoalsForMonthCents?: number;
  /** Estado de fadiga/decaimento por família de tema. */
  decayByFamily?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
}

export interface UnifiedLearningGraph {
  /** Mapa legado compatível contendo apenas decisões ativas no `referenceMonth`. */
  activeFeedbackMap: Readonly<Record<string, FeedbackDecision>>;
  /** Chaves marcadas como essenciais pelo usuário (inclui forma normalizada sem prefixo). */
  essentialKeys: ReadonlySet<string>;
  /** Chaves de hábito/recorrência marcadas como pontuais (`one_off`) especificamente no `referenceMonth`. */
  currentMonthOneOffKeys: ReadonlySet<string>;
  /** IDs exatos de despesas marcadas como pontuais (`tx_one_off:<expenseId>`). */
  oneOffExpenseIds: ReadonlySet<string>;
  /** Chaves ignoradas, canceladas ou rebaixadas (`ignore`, `already_cancelled`, `not_subscription`). */
  ignoredKeys: ReadonlySet<string>;
  /** Categorias com orçamento explícito/herdado ativo no mês (`categoryId -> limitCents`). */
  budgetedCategoryLimits: ReadonlyMap<string, number>;
  /** Aliases normalizados aprendidos via `merchantLearning` (`rawAliasNorm -> friendlyNameNorm`). */
  merchantAliasMap: ReadonlyMap<string, string>;
  /** Serviços e assinaturas aprendidos fora do catálogo estático (`alias/nome -> segment/tier`). */
  learnedServices: ReadonlyMap<string, LearnedServiceInfo>;
  /** Índice reverso de tags semânticas (`tagNorm -> friendlyNameNorm[]`) para busca e análise. */
  semanticTagIndex: ReadonlyMap<string, readonly string[]>;
  /** Perfil de entrada de renda inferido automaticamente do histórico. */
  paydayProfile: PaydayProfile;
  /** Estado de fadiga/decaimento por família de tema. */
  decayByFamily: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
}

const TX_ONE_OFF_PREFIX = "tx_one_off:";
const SCOPED_ONE_OFF_REGEX = /^one_off:(\d{4}-\d{2}):(.+)$/;
const KNOWN_KEY_PREFIX_REGEX = /^(?:sub|recurring|weekly|habit|annual|dup|savings|calib|price_adj|missing_expense|category):/;

/**
 * Cria a chave canônica de `one_off` para uma despesa individual (`tx_one_off:<expenseId>`).
 */
export function buildTxOneOffKey(expenseId: string): string {
  return `${TX_ONE_OFF_PREFIX}${expenseId.trim()}`;
}

/**
 * Cria a chave canônica de `one_off` escopada ao mês para hábitos/recorrências (`one_off:YYYY-MM:<slug>`).
 */
export function buildScopedOneOffKey(month: string, slug: string): string {
  return `one_off:${month.slice(0, 7)}:${slug.trim()}`;
}

/**
 * Extrai a forma normalizada de uma chave de ocorrência removendo prefixos técnicos.
 */
export function stripOccurrencePrefix(key: string): string {
  return normalizeText(stripTemporalSuffixes(key.replace(KNOWN_KEY_PREFIX_REGEX, "")));
}

function parseEntryMonth(createdAt?: string | null): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const trimmed = createdAt.trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  return null;
}

function weightedIncomeCents(income: LearningIncomeInput): number {
  const base = numberToCents(income.value);
  const w = income.report_weight;
  if (w === undefined || w === null || w === 1) return base;
  return Math.round(base * (Number.isFinite(w) ? Math.max(0, w) : 1));
}

/**
 * Infere o perfil de recebimento de renda (`PaydayProfile`) a partir do histórico de receitas
 * operacionais (excluindo estornos `[REFUND]`).
 *
 * Identifica:
 *   • `start_of_month`: recebimento concentrado nos dias 1..10 (típico CLT / 5º dia útil);
 *   • `biweekly`: 2 eventos distintos no mês separados por >= 10 dias (ex.: adiantamento dia 15 + pagamento dia 30);
 *   • `late_month`: recebimento concentrado nos dias 20..31;
 *   • `variable_flow`: entradas dispersas sem padrão fixo de dia.
 */
export function inferPaydayProfile(
  incomes: readonly LearningIncomeInput[],
  referenceMonth: string,
  incomeGoalsForMonthCents = 0,
): PaydayProfile {
  // Exclui estornos [REFUND] e valores <= 0; usa meses anteriores ao referenceMonth para evitar viés parcial
  const operational = incomes.filter((inc) => {
    if (!inc.date || inc.date.length < 10) return false;
    if (inc.source_ref?.startsWith("[REFUND]")) return false;
    return weightedIncomeCents(inc) > 0;
  });

  const pastMonthsMap = new Map<string, LearningIncomeInput[]>();
  for (const inc of operational) {
    const m = inc.date.slice(0, 7);
    if (m >= referenceMonth) continue;
    const list = pastMonthsMap.get(m) ?? [];
    list.push(inc);
    pastMonthsMap.set(m, list);
  }

  const pastMonths = [...pastMonthsMap.keys()].sort().slice(-6);
  if (pastMonths.length === 0) {
    if (incomeGoalsForMonthCents > 0) {
      return {
        pattern: "unknown",
        typicalIncomeDays: [],
        expectedMonthlyIncomeCents: Math.round(incomeGoalsForMonthCents),
        confidence: 0.5,
        monthsAnalyzed: 0,
      };
    }
    return {
      pattern: "unknown",
      typicalIncomeDays: [],
      expectedMonthlyIncomeCents: 0,
      confidence: 0,
      monthsAnalyzed: 0,
    };
  }

  const monthlyTotals: number[] = [];
  const earlyHalfDays: number[] = [];
  const lateHalfDays: number[] = [];
  const allMajorDays: number[] = [];
  let biweeklyMonthsCount = 0;

  for (const m of pastMonths) {
    const monthIncs = pastMonthsMap.get(m) ?? [];
    const monthTotal = monthIncs.reduce((acc, inc) => acc + weightedIncomeCents(inc), 0);
    if (monthTotal <= 0) continue;
    monthlyTotals.push(monthTotal);

    // Agrupa por dia do mês para identificar dias relevantes (>= 15% da renda daquele mês)
    const byDay = new Map<number, number>();
    for (const inc of monthIncs) {
      const day = parseInt(inc.date.slice(8, 10), 10);
      if (Number.isNaN(day) || day < 1 || day > 31) continue;
      byDay.set(day, (byDay.get(day) ?? 0) + weightedIncomeCents(inc));
    }

    const majorDays = [...byDay.entries()]
      .filter(([, amount]) => amount >= monthTotal * 0.15)
      .map(([day]) => day)
      .sort((a, b) => a - b);

    for (const d of majorDays) {
      allMajorDays.push(d);
    }

    // Verifica padrão quinzenal/fracionado: ao menos 2 dias relevantes espaçados em >= 10 dias
    if (majorDays.length >= 2) {
      const firstDay = majorDays[0]!;
      const lastDay = majorDays[majorDays.length - 1]!;
      if (lastDay - firstDay >= 10) {
        biweeklyMonthsCount += 1;
        earlyHalfDays.push(firstDay);
        lateHalfDays.push(lastDay);
      }
    }
  }

  const monthsAnalyzed = monthlyTotals.length;
  if (monthsAnalyzed === 0) {
    return {
      pattern: "unknown",
      typicalIncomeDays: [],
      expectedMonthlyIncomeCents: Math.max(0, Math.round(incomeGoalsForMonthCents)),
      confidence: incomeGoalsForMonthCents > 0 ? 0.5 : 0,
      monthsAnalyzed: 0,
    };
  }

  const expectedMonthlyIncomeCents = medianOf(monthlyTotals);

  // Confiança baseada na quantidade de meses e estabilidade dos totais
  const maxDevRatio =
    expectedMonthlyIncomeCents > 0
      ? Math.max(...monthlyTotals.map((t) => Math.abs(t - expectedMonthlyIncomeCents) / expectedMonthlyIncomeCents))
      : 1;
  const stabilityScore = Math.max(0, 1 - Math.min(1, maxDevRatio));
  const historyScore = Math.min(1, monthsAnalyzed / 3);
  const rawConfidence = 0.35 + 0.45 * historyScore + 0.2 * stabilityScore;
  const confidence = Number(Math.min(0.98, Math.max(0.2, rawConfidence)).toFixed(2));

  // 1. Quinzenal / fracionado (pelo menos 60% dos meses analisados e >= 2 meses)
  if (monthsAnalyzed >= 2 && biweeklyMonthsCount / monthsAnalyzed >= 0.6) {
    const firstTypical = medianOf(earlyHalfDays);
    const secondTypical = medianOf(lateHalfDays);
    const days = [...new Set([firstTypical, secondTypical])].sort((a, b) => a - b);
    return {
      pattern: "biweekly",
      typicalIncomeDays: days,
      expectedMonthlyIncomeCents,
      confidence,
      monthsAnalyzed,
    };
  }

  if (allMajorDays.length === 0) {
    return {
      pattern: "variable_flow",
      typicalIncomeDays: [],
      expectedMonthlyIncomeCents,
      confidence: Number((confidence * 0.7).toFixed(2)),
      monthsAnalyzed,
    };
  }

  const medianDay = medianOf(allMajorDays);
  const avgDeviation =
    allMajorDays.reduce((acc, d) => acc + Math.abs(d - medianDay), 0) / allMajorDays.length;

  if (avgDeviation <= 4) {
    if (medianDay <= 10) {
      return {
        pattern: "start_of_month",
        typicalIncomeDays: [medianDay],
        expectedMonthlyIncomeCents,
        confidence,
        monthsAnalyzed,
      };
    }
    if (medianDay >= 20) {
      return {
        pattern: "late_month",
        typicalIncomeDays: [medianDay],
        expectedMonthlyIncomeCents,
        confidence,
        monthsAnalyzed,
      };
    }
  }

  return {
    pattern: "variable_flow",
    typicalIncomeDays: [medianDay],
    expectedMonthlyIncomeCents,
    confidence: Number((confidence * 0.8).toFixed(2)),
    monthsAnalyzed,
  };
}

/**
 * Estima quanto ainda falta entrar de renda habitual no mês atual com base no `PaydayProfile`
 * e no que já foi recebido até o dia de hoje.
 *
 * Só retorna valor > 0 quando:
 *   • `paydayProfile.confidence >= 0.6` e `expectedMonthlyIncomeCents > 0`;
 *   • Ainda há dias típicos de pagamento futuros no mês atual (ou o total já recebido é claramente
 *     uma parcela parcial < 85% do esperado quando o próximo dia típico ainda não passou).
 */
export function estimateUpcomingCycleInflowsCents(params: {
  paydayProfile: PaydayProfile;
  operatingIncomeSoFarCents: number;
  dayOfMonth: number;
  daysInMonth: number;
  minConfidence?: number;
}): number {
  const {
    paydayProfile,
    operatingIncomeSoFarCents,
    dayOfMonth,
    daysInMonth,
    minConfidence = 0.6,
  } = params;

  if (paydayProfile.confidence < minConfidence || paydayProfile.expectedMonthlyIncomeCents <= 0) {
    return 0;
  }

  const remainingGap = paydayProfile.expectedMonthlyIncomeCents - operatingIncomeSoFarCents;
  if (remainingGap <= 0) {
    return 0;
  }

  // Se já recebeu pelo menos 85% da renda esperada, considera a renda do ciclo essencialmente cumprida
  if (operatingIncomeSoFarCents >= paydayProfile.expectedMonthlyIncomeCents * 0.85) {
    return 0;
  }

  // Se ainda existe pelo menos um dia típico de entrada igual ou posterior ao dia atual (com margem de +2 dias de tolerância bancária)
  const hasUpcomingPayday = paydayProfile.typicalIncomeDays.some((typicalDay) => {
    const clampedDay = Math.min(typicalDay, daysInMonth);
    return dayOfMonth <= Math.min(daysInMonth, clampedDay + 2);
  });

  if (hasUpcomingPayday) {
    return remainingGap;
  }

  // Caso ainda não tenha recebido nada no mês (operatingIncomeSoFarCents === 0) e seja renda confiável,
  // mantém o expectedMonthlyIncomeCents como renda pendente até que seja registrada
  if (operatingIncomeSoFarCents === 0) {
    return paydayProfile.expectedMonthlyIncomeCents;
  }

  return 0;
}

const DIRECT_SERVICE_SEGMENTS = new Set<string>([
  "streaming",
  "fitness",
  "cloud_ai",
  "telecom",
  "mobility",
  "health",
  "utilities",
  "other",
]);

function mapLearnedSegment(raw?: string): ServiceSegment {
  if (raw && DIRECT_SERVICE_SEGMENTS.has(raw)) {
    return raw as ServiceSegment;
  }
  return "other";
}

/**
 * Constrói o Grafo Unificado de Aprendizado (`UnifiedLearningGraph`) para o mês de referência.
 */
export function buildUnifiedLearningGraph(
  input: BuildUnifiedLearningGraphInput,
): UnifiedLearningGraph {
  const {
    referenceMonth,
    feedbackEntries,
    feedbackMap,
    budgets = [],
    merchantLearning,
    historicalIncomes = [],
    incomeGoalsForMonthCents = 0,
    decayByFamily = {},
  } = input;

  const entries: FeedbackEntry[] = feedbackEntries
    ? [...feedbackEntries]
    : Object.entries(feedbackMap ?? {}).map(([occurrenceKey, decision]) => ({
        occurrenceKey,
        decision,
        createdAt: null,
      }));

  const activeFeedbackMap: Record<string, FeedbackDecision> = {};
  const essentialKeys = new Set<string>();
  const currentMonthOneOffKeys = new Set<string>();
  const oneOffExpenseIds = new Set<string>();
  const ignoredKeys = new Set<string>();

  for (const entry of entries) {
    const { occurrenceKey, decision, createdAt } = entry;
    if (!occurrenceKey || !decision) continue;

    // 1. Transação específica marcada como pontual: `tx_one_off:<expenseId>`
    if (occurrenceKey.startsWith(TX_ONE_OFF_PREFIX)) {
      const expenseId = occurrenceKey.slice(TX_ONE_OFF_PREFIX.length).trim();
      if (expenseId && decision === "one_off") {
        oneOffExpenseIds.add(expenseId);
        activeFeedbackMap[occurrenceKey] = decision;
      }
      continue;
    }

    // 2. Chave de `one_off` com mês explícito: `one_off:YYYY-MM:<slug>`
    const scopedMatch = occurrenceKey.match(SCOPED_ONE_OFF_REGEX);
    if (scopedMatch) {
      const scopedMonth = scopedMatch[1]!;
      const slug = scopedMatch[2]!.trim();
      if (scopedMonth === referenceMonth && decision === "one_off") {
        currentMonthOneOffKeys.add(occurrenceKey);
        currentMonthOneOffKeys.add(slug);
        const normSlug = stripOccurrencePrefix(slug);
        if (normSlug) currentMonthOneOffKeys.add(normSlug);
        activeFeedbackMap[occurrenceKey] = decision;
        activeFeedbackMap[slug] = decision;
      }
      continue;
    }

    // 3. `one_off` legado (sem mês na chave): respeita estritamente `createdAt.slice(0, 7)`
    if (decision === "one_off") {
      const entryMonth = parseEntryMonth(createdAt);
      // Se não houver createdAt (ex.: mocks legados sem timestamp), assume escopo no referenceMonth;
      // se houver createdAt, só vale para o mês em que foi gravado!
      if (entryMonth === null || entryMonth === referenceMonth) {
        currentMonthOneOffKeys.add(occurrenceKey);
        const stripped = stripOccurrencePrefix(occurrenceKey);
        if (stripped) currentMonthOneOffKeys.add(stripped);
        activeFeedbackMap[occurrenceKey] = decision;
      }
      continue;
    }

    // 4. Demais decisões persistentes (`essential`, `confirm`, `ignore`, `already_cancelled`, `not_subscription`)
    activeFeedbackMap[occurrenceKey] = decision;

    if (decision === "essential") {
      essentialKeys.add(occurrenceKey);
      const stripped = stripOccurrencePrefix(occurrenceKey);
      if (stripped) essentialKeys.add(stripped);
    } else if (
      decision === "ignore" ||
      decision === "already_cancelled" ||
      decision === "not_subscription"
    ) {
      ignoredKeys.add(occurrenceKey);
      const stripped = stripOccurrencePrefix(occurrenceKey);
      if (stripped) ignoredKeys.add(stripped);
    }
  }

  // 5. Orçamentos ativos no mês (com herança canônica)
  const limitsByCategory = budgetLimitsByCategory(budgets);
  const budgetedCategoryLimits = new Map<string, number>();
  for (const [categoryId, list] of limitsByCategory.entries()) {
    const limitCents = resolveEffectiveLimit(list, referenceMonth);
    if (limitCents > 0) {
      budgetedCategoryLimits.set(categoryId, limitCents);
    }
  }

  // 6. Aliases normalizados, serviços/assinaturas aprendidas e tags semânticas via merchantLearning
  const merchantAliasMap = new Map<string, string>();
  const learnedServices = new Map<string, LearnedServiceInfo>();
  const semanticTagSets = new Map<string, Set<string>>();

  if (merchantLearning && typeof merchantLearning === "object") {
    for (const record of Object.values(merchantLearning)) {
      if (!record || !record.friendlyName) continue;
      const canonicalFriendly = normalizeText(stripTemporalSuffixes(record.friendlyName));
      if (!canonicalFriendly) continue;
      merchantAliasMap.set(canonicalFriendly, canonicalFriendly);

      const normAliases: string[] = [canonicalFriendly];
      if (Array.isArray(record.rawAliases)) {
        for (const rawAlias of record.rawAliases) {
          const normAlias = normalizeText(stripTemporalSuffixes(String(rawAlias || "")));
          if (normAlias) {
            merchantAliasMap.set(normAlias, canonicalFriendly);
            normAliases.push(normAlias);
          }
        }
      }

      if (record.isLearnedSubscription === true || record.serviceSegment || record.cutTier) {
        const info: LearnedServiceInfo = {
          canonicalKey: canonicalFriendly,
          friendlyName: record.friendlyName.trim(),
          segment: mapLearnedSegment(record.serviceSegment),
          tier: record.cutTier ?? "discretionary",
          isSubscription: Boolean(record.isLearnedSubscription),
        };
        for (const aliasKey of normAliases) {
          learnedServices.set(aliasKey, info);
        }
      }

      if (Array.isArray(record.semanticTags)) {
        for (const rawTag of record.semanticTags) {
          const normTag = normalizeText(String(rawTag || ""));
          if (!normTag) continue;
          const set = semanticTagSets.get(normTag) ?? new Set<string>();
          set.add(canonicalFriendly);
          semanticTagSets.set(normTag, set);
        }
      }
    }
  }

  const semanticTagIndex = new Map<string, readonly string[]>();
  for (const [tag, set] of semanticTagSets.entries()) {
    semanticTagIndex.set(tag, [...set]);
  }

  // 7. Perfil de entrada de renda (PaydayProfile)
  const paydayProfile = inferPaydayProfile(
    historicalIncomes,
    referenceMonth,
    incomeGoalsForMonthCents,
  );

  return {
    activeFeedbackMap,
    essentialKeys,
    currentMonthOneOffKeys,
    oneOffExpenseIds,
    ignoredKeys,
    budgetedCategoryLimits,
    merchantAliasMap,
    learnedServices,
    semanticTagIndex,
    paydayProfile,
    decayByFamily,
  };
}
