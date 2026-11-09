/**
 * Detecção de recorrências — ESPECIFICAÇÃO §3.7.3.
 *
 * 2 níveis canônicos de custos fixos reais:
 *   • subscription — mesmo nome + valor/categoria estável;
 *   • recurring — mesma descrição, valor com tolerância ±50%.
 * (O agrupamento estático por categoria 'similar' foi expurgado para eliminar
 * ruídos e manter os totais focados exclusivamente em custos fixos reais — Fase 7).
 * Parcelas (`installment_group_id`) são SEMPRE filtradas — parcelamento
 * não é recorrência.
 */

import { confidenceScore, varianceOf, type RecurrenceKind } from "./confidence";
import {
  classifySubscription,
  findMatchingServiceKey,
  segmentOf,
  type CutTier,
  type ServiceSegment,
} from "./subscriptions";
import { normalizeText, stripTemporalSuffixes } from "./shared";
import type { FeedbackMap } from "./feedback";
import { shiftMonth } from "@/domain/cards";
import { detectWeeklyCommitments } from "./extended-periodicity";
import { evaluateBudgetImpact, type BudgetImpactEvaluation } from "./recurrence-budget-impact";
import type { Expense } from "@/types";

export interface ExpenseLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss (opcional — para cálculo do dia típico de cobrança e duplicidade). */
  date?: string;
  /** Horário opcional (HH:mm ou ISO completo). */
  time?: string;
  valueCents: number;
  categoryId: string;
  /** Nome legível da categoria (ex.: "Supermercado Compre Bem", "Mensalidades"). */
  categoryName?: string | null;
  /** Nome do ícone da categoria (para sinais de assinatura). */
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
  /** Recorrência formal (Fase 32) — nunca é "detecção" (já é conhecida). */
  recurrenceId?: string | null;
  /** Método de pagamento / conta de origem (ex.: credit_card, pix, debit, etc.). */
  paymentMethod?: string | null;
  /** ID do cartão de crédito quando aplicável. */
  cardId?: string | null;
  /** Nome legível do cartão de crédito associado quando resolvido. */
  cardName?: string | null;
  /** Objeto bruto original para integração direta com diálogos de detalhe e edição. */
  rawExpense?: Expense;
}

export interface IncomeLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD (opcional — para cálculo do dia típico de recebimento). */
  date?: string;
  valueCents: number;
  categoryId: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
  /** Recorrência formal (Fase 32) — nunca é "detecção" (já é conhecida). */
  recurrenceId?: string | null;
}

export type IncomeProfile = "fixed" | "frequent_client";
export type IncomeSuggestedAction = "one_touch_confirm" | "open_value_input";

export interface RecurringIncomeOccurrence {
  /** Chave estável para identificação/feedback. */
  key: string;
  /** Nome ou descrição do pagador/cliente. */
  name: string;
  /** Perfil da renda: fixa/CLT ou cliente frequente/variável. */
  profile: IncomeProfile;
  /** Ação recomendada para a UX de captura rápida (Fase 5). */
  suggestedAction: IncomeSuggestedAction;
  /** Meses em que houve recebimento. */
  months: string[];
  /** Valor médio mensal (centavos). */
  averageCents: number;
  /** Último valor recebido (centavos) — base para sugerir valor preenchido no Perfil 1. */
  lastValueCents: number;
  /** Confiança matemática do padrão (0–1). */
  confidence: number;
  /** Categoria associada. */
  categoryId?: string;
  /** Dia típico do mês em que costuma ser recebido (1–31). */
  typicalDayOfMonth?: number;
  /** Data prevista para o próximo recebimento (YYYY-MM-DD). */
  expectedDate?: string;
  /** Dias restantes até a data prevista. */
  daysUntilExpected?: number;
  /** Verdadeiro se a receita era regular nos meses anteriores e ainda não foi registrada no mês atual após o dia típico. */
  missingThisMonth?: boolean;
  /** Coeficiente de variação de valor em relação à mediana (0 = perfeitamente fixo). */
  valueVariationRatio: number;
}

export interface DetectIncomeRecurrencesOptions {
  todayISO?: string;
  historyMonthsLimit?: number;
}

export type PriceAdjustmentKind = "inflationary" | "plan_change" | "consumption_variation";

export interface PriceAdjustment {
  oldCents: number;
  newCents: number;
  percentIncrease: number;
  /** Tipo de reajuste: inflacionário (10%–30%), mudança de plano (>50%) ou variação sazonal de consumo. */
  kind: PriceAdjustmentKind;
  /** Sinaliza se o reajuste é inflacionário (10%–30%). */
  isInflationary: boolean;
  /** Sinaliza se o reajuste é mudança de plano (>50%). */
  isPlanChange: boolean;
  /** Sinaliza se o reajuste é variação sazonal de consumo (concessionárias de energia/água/gás). */
  isConsumptionVariation?: boolean;
  /** Rótulo editorial canônico (ex.: "Reajuste inflacionário", "Mudança de plano" ou "Variação de consumo"). */
  label: string;
}

/**
 * Classifica a natureza do reajuste de preço (Fase 4, Tarefa 4.3; Fase 7, Tarefa 7.3).
 *   • Variação de consumo: oscilações de concessionárias de serviços essenciais (energia/água/gás).
 *   • Inflacionário: aumento típico de 10% a 30% em planos fixos (reajuste anual / inflação).
 *   • Mudança de plano: aumento expressivo >= 50% (ex.: upgrade de plano / adição de dependentes).
 */
export function classifyPriceAdjustment(
  oldCents: number,
  newCents: number,
  segment?: ServiceSegment,
): PriceAdjustment | null {
  if (oldCents <= 0 || newCents <= oldCents) return null;

  const increaseRatio = (newCents - oldCents) / oldCents;
  const percentIncrease = Math.round(increaseRatio * 100);

  if (percentIncrease < 10) return null;

  if (segment === "utilities") {
    return {
      oldCents,
      newCents,
      percentIncrease,
      kind: "consumption_variation",
      isInflationary: false,
      isPlanChange: false,
      isConsumptionVariation: true,
      label: "Variação de consumo",
    };
  }

  const isPlanChange = percentIncrease >= 50;
  const isInflationary = percentIncrease >= 10 && percentIncrease <= 30;
  const kind: PriceAdjustmentKind = isPlanChange ? "plan_change" : "inflationary";
  const label = isPlanChange ? "Mudança de plano" : "Reajuste inflacionário";

  return {
    oldCents,
    newCents,
    percentIncrease,
    kind,
    isInflationary,
    isPlanChange,
    isConsumptionVariation: false,
    label,
  };
}

/**
 * Detecta cobranças duplicadas em um mês segundo as regras estritas antirruído (Fase 4, Tarefa 4.3).
 *
 * Regras:
 *   1. Serviço de assinatura de valor fixo: qualquer ocorrência com >= 2 cobranças no mesmo mês
 *      com valores estáveis (típico de assinatura mensal cobrada em duplicidade).
 *   2. Compras em geral: apenas compras com mesmo valor exato no mesmo dia e na mesma hora/minuto.
 *      Compras corriqueiras (como Uber, iFood, mercado) em dias ou horários distintos NUNCA
 *      são sinalizadas como duplicadas.
 */
export function detectDuplicateChargesInMonth(
  expensesInMonth: readonly ExpenseLike[],
  isFixedValueSubscription: boolean,
): number | undefined {
  if (expensesInMonth.length < 2) return undefined;

  // Regra 1: Serviço de assinatura de valor fixo
  if (isFixedValueSubscription) {
    const values = expensesInMonth.map((e) => e.valueCents);
    const median = medianOf(values);
    if (median > 0) {
      const stableCharges = expensesInMonth.filter(
        (e) => Math.abs(e.valueCents - median) / median <= 0.10,
      );
      if (stableCharges.length >= 2) {
        return stableCharges.length;
      }
    }
    return undefined;
  }

  // Regra 2: Compras em geral — mesmo valor exato no mesmo dia e na mesma hora/minuto
  const duplicateGroups = new Map<string, ExpenseLike[]>();

  for (const exp of expensesInMonth) {
    if (!exp.date) continue;
    const dateOnly = exp.date.slice(0, 10);
    let timeKey = "";
    if (exp.time && exp.time.length >= 5) {
      timeKey = exp.time.slice(0, 5);
    } else if (exp.date.includes("T") && exp.date.length >= 16) {
      timeKey = exp.date.slice(11, 16);
    }

    const key = `${dateOnly}|${timeKey}|${exp.valueCents}`;
    const group = duplicateGroups.get(key) ?? [];
    group.push(exp);
    duplicateGroups.set(key, group);
  }

  let maxDuplicateCount = 0;
  for (const group of duplicateGroups.values()) {
    if (group.length >= 2 && group.length > maxDuplicateCount) {
      maxDuplicateCount = group.length;
    }
  }

  return maxDuplicateCount >= 2 ? maxDuplicateCount : undefined;
}

export type RecurrenceLifecycle = "active" | "lapsed";

export type RecurrenceCadence =
  | "weekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "quadrimonthly"
  | "semiannual"
  | "annual";

export const RECURRENCE_CADENCE_LABELS: Record<RecurrenceCadence, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  quadrimonthly: "Quadrimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export interface RecurrenceOccurrence {
  /** Chave estável para aprendizado/feedback (nome normalizado). */
  key: string;
  name: string;
  level: RecurrenceKind;
  /** Cadência temporal da recorrência (padrão mensal; suporta semanal, bimestral, trimestral, semestral e anual). */
  cadence?: RecurrenceCadence;
  /** Intervalo em meses entre cobranças sucessivas (1 para mensal, 2 para bimestral, 3 para trimestral, etc.). */
  intervalMonths?: number;
  /** Valor médio por ciclo de cobrança (centavos). */
  cycleValueCents?: number;
  /** Custo mensal amortizado/proporcional (centavos) para planejamento orçamentário. */
  monthlyAmortizedCents?: number;
  /** Custo mensal consolidado quando a periodicidade for semanal (F21). */
  monthlyConsolidatedCents?: number;
  /** Segmento do serviço (streaming, fitness, cloud_ai, etc.). */
  segment?: ServiceSegment;
  /** Ciclo de vida da recorrência: active (recente) ou lapsed (cessada há >= 2 ciclos). */
  lifecycle?: RecurrenceLifecycle;
  /** Mês mais recente em que houve cobrança (YYYY-MM). */
  latestMonthCharged?: string;
  /** Meses com ocorrência. */
  months: string[];
  /** Valor médio mensal (centavos). */
  averageCents: number;
  confidence: number;
  categoryId?: string;
  categoryName?: string;
  /** Tier de corte quando aplicável. */
  tier?: CutTier;
  /** Economia mensal estimada se cortada (centavos). */
  savingsIfCutCents?: number;
  /** Dia típico do mês em que a despesa costuma ser cobrada (1–31). */
  typicalDayOfMonth?: number;
  /** Data ISO da próxima cobrança estimada (YYYY-MM-DD). */
  nextDueDate?: string;
  /** Dias restantes até a próxima cobrança estimada. */
  daysUntilNextDue?: number;
  /** Verdadeiro se a despesa era regular nos meses anteriores e ainda não foi cobrada no mês atual após o dia típico. */
  missingThisMonth?: boolean;
  /** Reajuste de preço detectado (aumento >= 10% vs meses anteriores). */
  priceAdjustment?: PriceAdjustment | null;
  /** Quantidade de cobranças no mês mais recente se houver duplicidade (>= 2). */
  duplicateChargesThisMonth?: number;
  /** Avaliação de impacto orçamentário e classificação de gasto vampiro (Fase 4, Tarefa 4.2). */
  budgetImpact?: BudgetImpactEvaluation;
  /** Lançamentos históricos que compõem esta recorrência (ordenados cronologicamente do mais recente ao mais antigo). */
  expenses?: ExpenseLike[];
  /** Cartão de crédito habitual associado (Fase 7, Tarefa 7.6). */
  cardId?: string | null;
  /** Nome legível do cartão de crédito habitual. */
  cardName?: string | null;
  /** Forma de pagamento predominante (credit_card, pix, boleto, debit, etc.). */
  paymentMethod?: string | null;
}

export interface RecurringTotalsResult {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
}

export {
  VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT,
  VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT,
  formatBRL,
  evaluateBudgetImpact,
  type BudgetImpactOccurrence,
  type BudgetImpactEvaluation,
} from "./recurrence-budget-impact";

/**
 * Calcula os totais recorrentes mensais e anuais, bem como a economia potencial de corte (tier "can_cut").
 * Soma exclusivamente assinaturas reais ('subscription') e contas com fornecedores repetidos ('recurring'),
 * descartando ruídos e despesas corriqueiras variáveis de mesma categoria ('similar') — Fase 7.
 */
export function calculateRecurringTotals(
  activeOccurrences: readonly {
    averageCents: number;
    tier?: CutTier;
    savingsIfCutCents?: number;
    level?: string;
    lifecycle?: RecurrenceLifecycle;
    cadence?: RecurrenceCadence;
    monthlyAmortizedCents?: number;
    monthlyConsolidatedCents?: number;
  }[],
): RecurringTotalsResult {
  let totalRecurringCents = 0;
  let canCutRecurringCents = 0;

  for (const o of activeOccurrences) {
    if (o.level === "similar") continue;
    if (o.level != null && o.level !== "subscription" && o.level !== "recurring") continue;
    if (o.lifecycle === "lapsed") continue;

    const effectiveMonthly =
      o.cadence === "weekly" && o.monthlyConsolidatedCents != null
        ? o.monthlyConsolidatedCents
        : (o.monthlyAmortizedCents ?? o.averageCents);

    totalRecurringCents += effectiveMonthly;
    if (o.tier === "can_cut") {
      canCutRecurringCents += o.savingsIfCutCents ?? effectiveMonthly;
    }
  }

  return {
    totalRecurringCents,
    totalAnnualRecurringCents: totalRecurringCents * 12,
    canCutRecurringCents,
    canCutAnnualCents: canCutRecurringCents * 12,
  };
}

/**
 * Calcula a taxa percentual de comprometimento da renda por custos fixos e recorrentes.
 *
 * Fórmula canônica:
 *   (Total Mensal Recorrente / Renda Mensal Total) * 100
 *
 * Retorna null se não houver renda mensal registrada ou se for <= 0.
 */
export function calculateFixedCommitmentRate(
  totalRecurringCents: number,
  monthlyIncomeCents?: number,
): number | null {
  if (typeof monthlyIncomeCents !== "number" || monthlyIncomeCents <= 0) {
    return null;
  }
  if (totalRecurringCents <= 0) {
    return 0;
  }
  const rate = (totalRecurringCents / monthlyIncomeCents) * 100;
  return Number(rate.toFixed(1));
}

export type RecurrenceFilterTab = "all" | "subscriptions" | "fixed_bills" | "with_alerts";

/**
 * Avalia se uma ocorrência possui alertas ativos (reajustes, duplicidades, pendência no mês ou vencimento próximo).
 */
export function isRecurrenceAlert(occurrence: RecurrenceOccurrence): boolean {
  return (
    Boolean(occurrence.priceAdjustment) ||
    (occurrence.duplicateChargesThisMonth != null && occurrence.duplicateChargesThisMonth > 1) ||
    Boolean(occurrence.missingThisMonth) ||
    (occurrence.daysUntilNextDue != null && occurrence.daysUntilNextDue <= 7)
  );
}

/**
 * Avalia se uma ocorrência representa uma assinatura (streaming, nuvem/IA, fitness, clubes ou lazer).
 */
export function isSubscriptionRecurrence(occurrence: RecurrenceOccurrence): boolean {
  // Serviços essenciais não são classificados como assinaturas de estilo de vida
  if (
    occurrence.segment === "utilities" ||
    occurrence.segment === "telecom" ||
    occurrence.segment === "health" ||
    occurrence.tier === "essential"
  ) {
    return false;
  }

  // Segmentos explicitamente voltados a estilo de vida / assinaturas
  if (
    occurrence.segment === "streaming" ||
    occurrence.segment === "cloud_ai" ||
    occurrence.segment === "fitness" ||
    occurrence.segment === "mobility"
  ) {
    return true;
  }

  // Classificação pelo nível do motor
  if (occurrence.level === "subscription") {
    return true;
  }

  // Tiers de corte (can_cut ou discretionary)
  if (occurrence.tier === "can_cut" || occurrence.tier === "discretionary") {
    return true;
  }

  return false;
}

/**
 * Avalia se uma ocorrência representa uma conta fixa (energia, água, condomínio, internet, saúde, etc.).
 */
export function isFixedBillRecurrence(occurrence: RecurrenceOccurrence): boolean {
  if (
    occurrence.segment === "utilities" ||
    occurrence.segment === "telecom" ||
    occurrence.segment === "health"
  ) {
    return true;
  }

  if (occurrence.tier === "essential") {
    return true;
  }

  const normName = occurrence.name.toLowerCase();
  const fixedKeywords = [
    "condomínio",
    "condominio",
    "aluguel",
    "energia",
    "luz",
    "agua",
    "água",
    "gas",
    "gás",
    "internet",
    "fibra",
    "plano de saude",
    "saude",
    "saúde",
    "iptu",
    "ipva",
    "seguro",
    "escola",
    "faculdade",
    "mensalidade escolar",
    "diarista",
    "faxina",
  ];

  if (fixedKeywords.some((kw) => normName.includes(kw))) {
    return true;
  }

  // Se for nível recorrente e não foi enquadrado como assinatura
  if (occurrence.level === "recurring" && !isSubscriptionRecurrence(occurrence)) {
    return true;
  }

  return false;
}

/**
 * Filtra as ocorrências ativas com base na aba selecionada.
 */
export function filterRecurrencesByTab(
  occurrences: readonly RecurrenceOccurrence[],
  tab: RecurrenceFilterTab,
): RecurrenceOccurrence[] {
  switch (tab) {
    case "subscriptions":
      return occurrences.filter(isSubscriptionRecurrence);
    case "fixed_bills":
      return occurrences.filter(isFixedBillRecurrence);
    case "with_alerts":
      return occurrences.filter(isRecurrenceAlert);
    case "all":
    default:
      return [...occurrences];
  }
}

const RECURRING_TOLERANCE = 0.5; // ±50% (recurring)

/** Calcula a mediana de um conjunto de valores. */
export function medianOf(values: readonly number[]): number {

  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

/** Calcula o dia do mês típico da despesa (1–31) a partir das datas históricas. */
export function calculateTypicalDay(dates: readonly (string | undefined)[]): number {
  const days = dates
    .filter((d): d is string => d != null && d.length >= 10)
    .map((d) => parseInt(d.slice(8, 10), 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 31);

  if (days.length === 0) return 1;
  return medianOf(days);
}

/**
 * Calcula a diferença em meses entre duas competências no formato YYYY-MM (to - from).
 */
export function diffMonths(fromYearMonth: string, toYearMonth: string): number {
  if (!fromYearMonth || !toYearMonth) return 0;
  const [y1, m1] = fromYearMonth.slice(0, 7).split("-").map(Number);
  const [y2, m2] = toYearMonth.slice(0, 7).split("-").map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Calcula a lista de intervalos em meses entre meses sucessivos ordenados cronologicamente.
 */
export function calculateMonthIntervals(months: readonly string[]): number[] {
  if (months.length < 2) return [];
  const sorted = [...new Set(months.map((m) => m.slice(0, 7)))].sort();
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = diffMonths(sorted[i - 1]!, sorted[i]!);
    if (diff > 0) {
      intervals.push(diff);
    }
  }
  return intervals;
}

/**
 * Infere determinísticamente a cadência temporal da recorrência com base na mediana dos intervalos de meses.
 */
export function inferRecurrenceCadence(intervals: readonly number[]): {
  cadence: RecurrenceCadence;
  intervalMonths: number;
} {
  if (intervals.length === 0) {
    return { cadence: "monthly", intervalMonths: 1 };
  }
  const med = medianOf(intervals);
  if (med <= 1) {
    return { cadence: "monthly", intervalMonths: 1 };
  }
  if (med === 2) {
    return { cadence: "bimonthly", intervalMonths: 2 };
  }
  if (med === 3) {
    return { cadence: "quarterly", intervalMonths: 3 };
  }
  if (med === 4) {
    return { cadence: "quadrimonthly", intervalMonths: 4 };
  }
  if (med >= 5 && med <= 8) {
    return { cadence: "semiannual", intervalMonths: 6 };
  }
  if (med >= 9 && med <= 14) {
    return { cadence: "annual", intervalMonths: 12 };
  }
  return { cadence: "monthly", intervalMonths: Math.max(1, med) };
}

/**
 * Estima a próxima data de cobrança e a contagem de dias restantes.
 * Identifica também o ciclo de vida da recorrência (active vs lapsed)
 * com base na cadência esperada (intervalMonths).
 */
export function estimateNextDueDate(
  typicalDay: number,
  latestMonthCharged: string,
  todayISO?: string,
  intervalMonths: number = 1,
): { nextDueDate?: string; daysUntilNextDue?: number; missingThisMonth?: boolean; lifecycle?: RecurrenceLifecycle } {
  if (!todayISO || todayISO.length < 10) return { lifecycle: "active" };
  const currentMonth = todayISO.slice(0, 7);
  const currentDay = parseInt(todayISO.slice(8, 10), 10);

  // Distância em meses entre a última cobrança e o mês atual
  const elapsedMonths = diffMonths(latestMonthCharged, currentMonth);

  // Se a última cobrança ocorreu há mais de (intervalMonths + 1) meses,
  // a despesa cessou/parou (lapsed/churned).
  // Não projeta cobrança futura no mês atual nem gera falso alerta de pendência.
  if (latestMonthCharged && elapsedMonths > intervalMonths + 1) {
    return {
      lifecycle: "lapsed",
      missingThisMonth: false,
    };
  }

  let targetYearMonth: string;
  const alreadyChargedThisMonth = latestMonthCharged >= currentMonth;

  if (alreadyChargedThisMonth) {
    // Já cobrada neste ciclo/mês -> próxima cobrança é no ciclo seguinte
    targetYearMonth = shiftMonth(latestMonthCharged, intervalMonths);
  } else {
    // Se a última cobrança ocorreu dentro do intervalo esperado, projeta a próxima data a partir da última
    const nextProjected = shiftMonth(latestMonthCharged, intervalMonths);
    if (nextProjected >= currentMonth) {
      targetYearMonth = nextProjected;
    } else {
      targetYearMonth = currentMonth;
    }
  }

  const [targetYearStr, targetMonthStr] = targetYearMonth.split("-");
  const targetYear = parseInt(targetYearStr!, 10);
  const targetMonth = parseInt(targetMonthStr!, 10);
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const actualDay = Math.min(typicalDay, daysInTargetMonth);
  const paddedDay = String(actualDay).padStart(2, "0");
  const nextDueDate = `${targetYearMonth}-${paddedDay}`;

  const todayDate = new Date(`${todayISO.slice(0, 10)}T00:00:00`);
  const nextDate = new Date(`${nextDueDate}T00:00:00`);
  const daysUntilNextDue = Math.round((nextDate.getTime() - todayDate.getTime()) / 86_400_000);

  // Considera ausente/pendente se não foi cobrada no ciclo atual, a cobrança prevista é para este mês e o dia típico já passou
  const isDueInCurrentMonth = targetYearMonth === currentMonth;
  const missingThisMonth = !alreadyChargedThisMonth && isDueInCurrentMonth && currentDay > typicalDay;

  return { nextDueDate, daysUntilNextDue, missingThisMonth, lifecycle: "active" };
}

/**
 * Tolerância relativa à MEDIANA (robusta a outliers e à ordem dos meses).
 */
function valuesWithinToleranceOfMedian(values: readonly number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const median = medianOf(values);
  if (median <= 0) return false;
  return values.every((value) => Math.abs(value - median) / median <= tolerance);
}

export interface DetectRecurrencesOptions {
  todayISO?: string;
  /** Renda mensal estimada para avaliação de impacto orçamentário. */
  monthlyIncomeCents?: number;
  /** Orçamento por categoria (categoryId -> centavos) para avaliação de impacto orçamentário. */
  categoryBudgets?: Record<string, number> | Map<string, number>;
  /** Mapa de feedback/aprendizado do usuário para calibração e anti-insistência (§F23). */
  feedbackMap?: FeedbackMap;
}

/**
 * Detecta recorrências entre despesas (parcelas já filtradas).
 * Agrupa por descrição normalizada (subscription/recurring) e por
 * categoria (similar), aplicando as tolerâncias da especificação.
 */
export function detectRecurrences(
  expenses: readonly ExpenseLike[],
  options: DetectRecurrencesOptions = {},
): RecurrenceOccurrence[] {
  const { todayISO } = options;
  // Parcelamento e recorrência formal são filtrados — não são repetições
  // "aprendidas": parcelas não são recorrência (§3.7.3) e recorrências
  // formais já são conhecidas do usuário (Fase 32).
  const active = expenses.filter((e) => e.installmentGroupId == null && e.recurrenceId == null);

  // Agrupa por descrição normalizada (níveis subscription/recurring).
  // Higieniza sufixos temporais e unifica despesas que compartilham o mesmo serviço conhecido.
  const byName = new Map<string, ExpenseLike[]>();
  for (const expense of active) {
    const rawDesc = (expense.description ?? expense.id).trim();
    const matchedService = findMatchingServiceKey(rawDesc);
    const key = matchedService ?? normalizeText(stripTemporalSuffixes(rawDesc));
    const list = byName.get(key) ?? [];
    list.push(expense);
    byName.set(key, list);
  }

  const occurrences: RecurrenceOccurrence[] = [];
  const seen = new Set<string>();

  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const first = group[0] ?? group[1];
    if (!first) continue;

    const rawFirstDesc = (first.description ?? "").trim();
    const cleanDisplayName = stripTemporalSuffixes(rawFirstDesc) || rawFirstDesc || key;

    // Agregação mensal real: agrupa despesas por mês.
    const monthMap = new Map<string, ExpenseLike[]>();
    for (const exp of group) {
      const list = monthMap.get(exp.month) ?? [];
      list.push(exp);
      monthMap.set(exp.month, list);
    }

    const months = [...monthMap.keys()].sort();
    if (months.length < 2) continue;

    const monthlyTotals = months.map((m) => {
      const monthExpenses = monthMap.get(m) ?? [];
      return monthExpenses.reduce((acc, e) => acc + e.valueCents, 0);
    });

    const averageMonthlyCents = Math.round(monthlyTotals.reduce((acc, v) => acc + v, 0) / monthlyTotals.length);
    const categoryIcons = [...new Set(group.map((e) => e.categoryIcon))];

    // Cálculo dos intervalos entre meses e inferência determinística da cadência
    const intervals = calculateMonthIntervals(months);
    const { cadence: detectedCadence, intervalMonths } = inferRecurrenceCadence(intervals);

    // Amortização contábil mensal (custo por mês para o orçamento)
    const monthlyAmortizedCents = Math.round(averageMonthlyCents / intervalMonths);

    // Diagnóstico de cobranças duplicadas e reajustes no mês mais recente (Fase 4, Tarefa 4.3).
    const latestMonth = months[months.length - 1];
    const latestExpenses = latestMonth ? (monthMap.get(latestMonth) ?? []) : [];

    // Previsão temporal de próximo vencimento e dia típico com respeito à cadência
    const dates = group.map((e) => e.date).filter(Boolean);
    const typicalDayOfMonth = calculateTypicalDay(dates);
    const { nextDueDate, daysUntilNextDue, missingThisMonth, lifecycle } = estimateNextDueDate(
      typicalDayOfMonth,
      latestMonth ?? "",
      todayISO,
      intervalMonths,
    );

    // subscription: usa a árvore de decisão de assinaturas (nome conhecido
    // no catálogo OU categoria de assinatura são sinais fortes).
    const subscription = classifySubscription({
      name: cleanDisplayName,
      categoryName: first.categoryName,
      categoryIcon: categoryIcons[0],
      monthlyValuesCents: monthlyTotals,
    });

    const segment = subscription?.segment ?? segmentOf(cleanDisplayName, categoryIcons[0], first.categoryName);

    // Diagnóstico de reajuste de preço com diferenciação inflacionária vs mudança de plano vs variação de consumo (Fase 7, Tarefa 7.3).
    let priceAdjustment: PriceAdjustment | null = null;
    if (monthlyTotals.length >= 2) {
      const previousTotals = monthlyTotals.slice(0, -1);
      const prevMedian = medianOf(previousTotals);
      const latestTotal = monthlyTotals[monthlyTotals.length - 1] ?? 0;
      if (prevMedian > 0 && latestTotal > prevMedian) {
        priceAdjustment = classifyPriceAdjustment(prevMedian, latestTotal, segment);
      }
    }

    // Regra estrita antirruído de duplicidade (Fase 4, Tarefa 4.3; Fase 7, Tarefa 7.3):
    // Restringe alerta em dias diferentes estritamente a assinaturas do catálogo com valor fixo (excluindo utilities).
    const isFixedValueSubscription =
      subscription !== null &&
      subscription.segment !== "utilities" &&
      (subscription.signs.knownName || subscription.signs.subscriptionCategory);
    const duplicateChargesThisMonth = detectDuplicateChargesInMonth(
      latestExpenses,
      isFixedValueSubscription,
    );

    const sortedExpenses = [...group].sort((a, b) => {
      const dateA = a.date ?? `${a.month}-01`;
      const dateB = b.date ?? `${b.month}-01`;
      return dateB.localeCompare(dateA);
    });

    // Mapeamento da forma de pagamento e cartão habitual associado (Fase 7, Tarefa 7.6).
    const methodCounts = new Map<string, number>();
    const cardData = new Map<string, { count: number; name?: string | null; latestDate: string }>();

    for (const exp of group) {
      if (exp.paymentMethod) {
        methodCounts.set(exp.paymentMethod, (methodCounts.get(exp.paymentMethod) ?? 0) + 1);
      }
      if (exp.cardId) {
        const expDate = exp.date ?? `${exp.month}-01`;
        const existing = cardData.get(exp.cardId);
        if (!existing) {
          cardData.set(exp.cardId, { count: 1, name: exp.cardName, latestDate: expDate });
        } else {
          existing.count += 1;
          if (exp.cardName) existing.name = exp.cardName;
          if (expDate > existing.latestDate) existing.latestDate = expDate;
        }
      }
    }

    let predominantPaymentMethod: string | null = null;
    let maxMethodCount = 0;
    for (const [m, count] of methodCounts.entries()) {
      if (count > maxMethodCount) {
        maxMethodCount = count;
        predominantPaymentMethod = m;
      }
    }

    let habitualCardId: string | null = null;
    let habitualCardName: string | null = null;
    let maxCardCount = 0;
    let maxCardLatestDate = "";
    for (const [cId, data] of cardData.entries()) {
      if (data.count > maxCardCount || (data.count === maxCardCount && data.latestDate > maxCardLatestDate)) {
        maxCardCount = data.count;
        habitualCardId = cId;
        habitualCardName = data.name ?? null;
        maxCardLatestDate = data.latestDate;
      }
    }

    if (subscription !== null && months.length >= 2) {
      const variance = varianceOf(monthlyTotals);
      const subKey = `sub:${key}`;
      const isSubPenalized =
        options.feedbackMap?.[subKey] === "not_subscription" ||
        options.feedbackMap?.[key] === "not_subscription";
      const isSubEssential =
        options.feedbackMap?.[subKey] === "essential" ||
        options.feedbackMap?.[key] === "essential";

      const rawConfidence = confidenceScore({
        base: subscription.confidence,
        monthsHistory: months.length,
        kind: "subscription",
        variance,
      });
      const confidence = isSubPenalized
        ? Number(Math.max(0.05, rawConfidence * 0.2).toFixed(2))
        : rawConfidence;

      occurrences.push({
        key: subKey,
        name: cleanDisplayName,
        level: "subscription",
        cadence: detectedCadence,
        intervalMonths,
        cycleValueCents: averageMonthlyCents,
        monthlyAmortizedCents,
        segment: subscription.segment,
        lifecycle,
        latestMonthCharged: latestMonth,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
        tier: isSubEssential ? "essential" : subscription.tier,
        savingsIfCutCents: isSubEssential ? 0 : subscription.savingsIfCutCents,
        typicalDayOfMonth,
        nextDueDate,
        daysUntilNextDue,
        missingThisMonth,
        priceAdjustment,
        duplicateChargesThisMonth,
        expenses: sortedExpenses,
        cardId: habitualCardId,
        cardName: habitualCardName,
        paymentMethod: predominantPaymentMethod,
      });
      seen.add(key);
      continue;
    }

    // recurring: mesma descrição, valor ±50% relativo à MEDIANA.
    const stable = valuesWithinToleranceOfMedian(monthlyTotals, RECURRING_TOLERANCE);
    if (stable && months.length >= 2) {
      const variance = varianceOf(monthlyTotals);
      const recurringKey = `recurring:${key}`;
      const isRecPenalized =
        options.feedbackMap?.[recurringKey] === "not_subscription" ||
        options.feedbackMap?.[key] === "not_subscription";
      const isRecEssential =
        options.feedbackMap?.[recurringKey] === "essential" ||
        options.feedbackMap?.[key] === "essential";

      const rawConfidence = confidenceScore({ base: 0.7, monthsHistory: months.length, kind: "recurring", variance });
      const confidence = isRecPenalized
        ? Number(Math.max(0.05, rawConfidence * 0.2).toFixed(2))
        : rawConfidence;

      const segment = segmentOf(cleanDisplayName, categoryIcons[0], first.categoryName);
      occurrences.push({
        key: recurringKey,
        name: cleanDisplayName,
        level: "recurring",
        cadence: detectedCadence,
        intervalMonths,
        cycleValueCents: averageMonthlyCents,
        monthlyAmortizedCents,
        segment,
        lifecycle,
        latestMonthCharged: latestMonth,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
        tier: isRecEssential ? "essential" : undefined,
        savingsIfCutCents: isRecEssential ? 0 : undefined,
        typicalDayOfMonth,
        nextDueDate,
        daysUntilNextDue,
        missingThisMonth,
        priceAdjustment,
        duplicateChargesThisMonth,
        expenses: sortedExpenses,
        cardId: habitualCardId,
        cardName: habitualCardName,
        paymentMethod: predominantPaymentMethod,
      });
      seen.add(key);
    }
  }

  // 3. Detecção e integração de compromissos com cadência semanal (F21)
  const weeklyCommitments = detectWeeklyCommitments(expenses, {
    todayISO,
    feedbackMap: options.feedbackMap,
  });

  for (const weekly of weeklyCommitments) {
    const existing = occurrences.find(
      (o) => normalizeText(o.name) === normalizeText(weekly.name),
    );

    if (existing) {
      existing.cadence = "weekly";
      existing.monthlyConsolidatedCents = weekly.monthlyConsolidatedCents;
    } else {
      const months = Array.from(
        new Set(
          weekly.expenses
            .map((e: { month?: string; date?: string }) => e.month || (e.date ? e.date.slice(0, 7) : ""))
            .filter((m): m is string => Boolean(m)),
        ),
      ).sort();

      const isWeeklyEssential = options.feedbackMap?.[weekly.key] === "essential";

      occurrences.push({
        key: weekly.key,
        name: weekly.name,
        level: "recurring",
        cadence: "weekly",
        averageCents: weekly.monthlyConsolidatedCents,
        monthlyConsolidatedCents: weekly.monthlyConsolidatedCents,
        confidence: weekly.confidence,
        categoryId: weekly.categoryId,
        categoryName: weekly.categoryName,
        months,
        expenses: weekly.expenses,
        lifecycle: weekly.active ? "active" : "lapsed",
        tier: isWeeklyEssential ? "essential" : undefined,
      });
    }
  }

  if (options.monthlyIncomeCents != null || options.categoryBudgets != null) {
    for (const occ of occurrences) {
      let categoryBudgetCents: number | undefined;
      if (occ.categoryId && options.categoryBudgets) {
        if (options.categoryBudgets instanceof Map) {
          categoryBudgetCents = options.categoryBudgets.get(occ.categoryId);
        } else if (typeof options.categoryBudgets === "object") {
          categoryBudgetCents = options.categoryBudgets[occ.categoryId];
        }
      }
      occ.budgetImpact = evaluateBudgetImpact(occ, options.monthlyIncomeCents, categoryBudgetCents);
    }
  }

  return occurrences.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detecta rendas previsíveis e recorrentes com classificação dual (Fase 4, Tarefa 4.1).
 *
 * Classificação Dual:
 *   • Perfil 1 — Renda Fixa/CLT: Dia típico fixo (± 2 dias) e valor estável (± 10%).
 *     Sugere confirmação em 1 toque com valor preenchido (`one_touch_confirm`).
 *   • Perfil 2 — Renda Recorrente de Cliente Frequente (Freelancer): Mesma fonte/cliente habitual,
 *     frequência mensal e valor flutuante. Sugere card com campo de valor aberto para digitação (`open_value_input`).
 *
 * Analisa o histórico dos últimos 3 a 6 meses e detecta `missingThisMonth` para receitas previstas no mês corrente.
 */
export function detectIncomeRecurrences(
  incomes: readonly IncomeLike[],
  options: DetectIncomeRecurrencesOptions = {},
): RecurringIncomeOccurrence[] {
  const { todayISO, historyMonthsLimit = 6 } = options;

  // Filtra parcelas e recorrências formais (já conhecidas pelo usuário)
  const active = incomes.filter(
    (i) => i.installmentGroupId == null && i.recurrenceId == null && i.valueCents > 0,
  );

  // Agrupa por descrição normalizada (fonte / pagador / cliente habitual)
  const byName = new Map<string, IncomeLike[]>();
  for (const income of active) {
    const rawName = (income.description || "").trim();
    const key = normalizeText(stripTemporalSuffixes(rawName) || rawName || income.id);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(income);
    byName.set(key, list);
  }

  const occurrences: RecurringIncomeOccurrence[] = [];

  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const first = group[0];
    if (!first) continue;

    // Agrupa por mês (YYYY-MM)
    const monthMap = new Map<string, IncomeLike[]>();
    for (const inc of group) {
      const list = monthMap.get(inc.month) ?? [];
      list.push(inc);
      monthMap.set(inc.month, list);
    }

    const allMonths = [...monthMap.keys()].sort();
    if (allMonths.length < 2) continue;

    // Limita à janela histórica recente (3 a 6 meses)
    const months = allMonths.slice(-historyMonthsLimit);
    if (months.length < 2) continue;

    // Total de receitas por mês desse pagador
    const monthlyTotals = months.map((m) => {
      const monthIncomes = monthMap.get(m) ?? [];
      return monthIncomes.reduce((acc, i) => acc + i.valueCents, 0);
    });

    const averageCents = Math.round(
      monthlyTotals.reduce((acc, v) => acc + v, 0) / monthlyTotals.length,
    );
    const median = medianOf(monthlyTotals);

    // Variação de valor: tolerância de ±10% para Renda Fixa
    const isValueStable = valuesWithinToleranceOfMedian(monthlyTotals, 0.10);
    const maxDev = median > 0
      ? Math.max(...monthlyTotals.map((v) => Math.abs(v - median) / median))
      : 0;
    const valueVariationRatio = Number(maxDev.toFixed(4));

    // Dia típico e desvios de datas
    const dates = group.map((i) => i.date).filter(Boolean);
    const typicalDayOfMonth = calculateTypicalDay(dates);

    const dayNumbers = dates
      .map((d) => (d ? parseInt(d.slice(8, 10), 10) : NaN))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 31);

    const dayDeviations = dayNumbers.map((d) => Math.abs(d - typicalDayOfMonth));
    const avgDayDeviation =
      dayDeviations.length > 0
        ? dayDeviations.reduce((a, b) => a + b, 0) / dayDeviations.length
        : 0;
    const isDayStable = dayDeviations.length === 0 || avgDayDeviation <= 2;

    // Classificação Dual: Perfil 1 (Fixa/CLT) vs Perfil 2 (Cliente Frequente)
    const isFixed = isValueStable && isDayStable;
    const profile: IncomeProfile = isFixed ? "fixed" : "frequent_client";
    const suggestedAction: IncomeSuggestedAction = isFixed ? "one_touch_confirm" : "open_value_input";

    const variance = varianceOf(monthlyTotals);
    const baseConfidence = isFixed ? 0.85 : 0.70;
    const confidence = confidenceScore({
      base: baseConfidence,
      monthsHistory: months.length,
      kind: "recurring",
      variance,
    });

    // Último valor recebido
    const latestMonth = months[months.length - 1];
    const latestIncomes = latestMonth ? (monthMap.get(latestMonth) ?? []) : [];
    const lastValueCents =
      latestIncomes[latestIncomes.length - 1]?.valueCents ??
      monthlyTotals[monthlyTotals.length - 1] ??
      averageCents;

    // Previsão temporal e status missingThisMonth
    let expectedDate: string | undefined;
    let daysUntilExpected: number | undefined;
    let missingThisMonth = false;

    if (todayISO && todayISO.length >= 10) {
      const currentMonth = todayISO.slice(0, 7);
      const currentDay = parseInt(todayISO.slice(8, 10), 10);
      const prevMonth = shiftMonth(currentMonth, -1);
      const alreadyReceivedThisMonth = latestMonth === currentMonth;

      if (!latestMonth || latestMonth < prevMonth) {
        // Receita cessou há 2+ meses (lapsed) -> não projeta no mês corrente
        expectedDate = undefined;
        daysUntilExpected = undefined;
        missingThisMonth = false;
      } else if (alreadyReceivedThisMonth) {
        // Já recebido neste mês -> previsão para o mês seguinte
        const { nextDueDate, daysUntilNextDue } = estimateNextDueDate(
          typicalDayOfMonth,
          currentMonth,
          todayISO,
        );
        expectedDate = nextDueDate;
        daysUntilExpected = daysUntilNextDue;
        missingThisMonth = false;
      } else {
        // Não recebido ainda no mês corrente -> esperado no mês corrente
        const [curYearStr, curMonthStr] = currentMonth.split("-");
        const daysInCurrentMonth = new Date(parseInt(curYearStr!, 10), parseInt(curMonthStr!, 10), 0).getDate();
        const actualIncomeDay = Math.min(typicalDayOfMonth, daysInCurrentMonth);
        const paddedDay = String(actualIncomeDay).padStart(2, "0");
        expectedDate = `${currentMonth}-${paddedDay}`;
        const todayDate = new Date(`${todayISO.slice(0, 10)}T00:00:00`);
        const nextDate = new Date(`${expectedDate}T00:00:00`);
        daysUntilExpected = Math.round((nextDate.getTime() - todayDate.getTime()) / 86_400_000);
        missingThisMonth = currentDay > typicalDayOfMonth;
      }
    }

    const rawFirstDesc = (first.description || "").trim();
    const cleanDisplayName = stripTemporalSuffixes(rawFirstDesc) || rawFirstDesc || key;

    occurrences.push({
      key: `income:${profile}:${key}`,
      name: cleanDisplayName,
      profile,
      suggestedAction,
      months,
      averageCents,
      lastValueCents,
      confidence,
      categoryId: first.categoryId,
      typicalDayOfMonth,
      expectedDate,
      daysUntilExpected,
      missingThisMonth,
      valueVariationRatio,
    });
  }

  return occurrences.sort((a, b) => b.confidence - a.confidence);
}

export interface ExpensePriceEvolutionItem {
  id: string;
  date: string;
  amountCents: number;
}

export interface ExpensePriceEvolution {
  currentCents: number;
  previousCents: number | null;
  deltaPreviousCents: number | null;
  deltaPreviousPercent: number | null;
  historicalMedianCents: number | null;
  deltaMedianCents: number | null;
  deltaMedianPercent: number | null;
  firstOccurrenceDate: string | null;
  firstOccurrenceCents: number | null;
  deltaFirstCents: number | null;
  deltaFirstPercent: number | null;
  hasPriceIncrease: boolean;
  history: ExpensePriceEvolutionItem[];
}

export function toExpenseLike(item: ExpenseLike | Expense): ExpenseLike {
  if ("valueCents" in item && "month" in item) {
    return item;
  }
  const exp = item as Expense;
  return {
    id: exp.id,
    description: exp.description,
    month: exp.date.slice(0, 7),
    date: exp.date,
    valueCents: exp.value,
    categoryId: exp.category_id,
    installmentGroupId: exp.installment_group_id,
    recurrenceId: exp.recurrence_id,
    paymentMethod: exp.payment_method,
    cardId: exp.card_id,
    rawExpense: exp,
  };
}

/**
 * Avalia puramente a evolução temporal de preços de um lançamento em relação ao seu histórico:
 * 1. vs. Lançamento anterior imediato (ciclo anterior)
 * 2. vs. Mediana histórica dos ciclos anteriores
 * 3. vs. Primeira ocorrência registrada (marco zero)
 */
export function evaluateExpensePriceEvolution(
  targetExpenseInput: ExpenseLike | Expense,
  allExpensesInput: readonly (ExpenseLike | Expense)[],
): ExpensePriceEvolution | null {
  const targetExpense = toExpenseLike(targetExpenseInput);
  if (!targetExpense || targetExpense.valueCents <= 0) return null;

  const rawDesc = (targetExpense.description ?? "").trim();
  if (!rawDesc) return null;

  const targetServiceKey = findMatchingServiceKey(rawDesc);
  const targetCleanKey = targetServiceKey ?? normalizeText(stripTemporalSuffixes(rawDesc));
  if (!targetCleanKey) return null;

  // Filtra lançamentos com a mesma chave normalizada, sem parcelamento e valor > 0
  const related = allExpensesInput.map(toExpenseLike).filter((e) => {
    if (e.valueCents <= 0) return false;
    if (e.installmentGroupId != null) return false;
    const desc = (e.description ?? "").trim();
    if (!desc) return false;
    const serviceKey = findMatchingServiceKey(desc);
    const cleanKey = serviceKey ?? normalizeText(stripTemporalSuffixes(desc));
    return cleanKey === targetCleanKey;
  });

  if (related.length < 2) return null;

  // Ordena cronologicamente por data asc
  const sorted = [...related].sort((a, b) => {
    const dateA = a.date ?? `${a.month}-01`;
    const dateB = b.date ?? `${b.month}-01`;
    return dateA.localeCompare(dateB);
  });

  const history: ExpensePriceEvolutionItem[] = sorted.map((e) => ({
    id: e.id,
    date: e.date ?? `${e.month}-01`,
    amountCents: e.valueCents,
  }));

  const targetIndex = sorted.findIndex((e) => e.id === targetExpense.id);
  const currentIndex = targetIndex >= 0 ? targetIndex : sorted.length - 1;
  if (currentIndex <= 0) return null;

  const current = sorted[currentIndex]!;
  const currentCents = current.valueCents;

  const previousExpenses = sorted.slice(0, currentIndex);
  const previous = previousExpenses[previousExpenses.length - 1]!;
  const previousCents = previous.valueCents;
  const deltaPreviousCents = currentCents - previousCents;
  const deltaPreviousPercent =
    previousCents > 0
      ? Number((((currentCents - previousCents) / previousCents) * 100).toFixed(1))
      : 0;

  const previousValues = previousExpenses.map((e) => e.valueCents);
  const historicalMedianCents = medianOf(previousValues);
  const deltaMedianCents = currentCents - historicalMedianCents;
  const deltaMedianPercent =
    historicalMedianCents > 0
      ? Number((((currentCents - historicalMedianCents) / historicalMedianCents) * 100).toFixed(1))
      : 0;

  const first = previousExpenses[0]!;
  const firstOccurrenceDate = first.date ?? `${first.month}-01`;
  const firstOccurrenceCents = first.valueCents;
  const deltaFirstCents = currentCents - firstOccurrenceCents;
  const deltaFirstPercent =
    firstOccurrenceCents > 0
      ? Number((((currentCents - firstOccurrenceCents) / firstOccurrenceCents) * 100).toFixed(1))
      : 0;

  // Limiar anti-câmbio/IOF: aumento real se deltaPreviousCents > 0 E (>= 3% OU >= R$ 3,00)
  const hasPriceIncrease =
    deltaPreviousCents > 0 && (deltaPreviousPercent >= 3 || deltaPreviousCents >= 300);

  return {
    currentCents,
    previousCents,
    deltaPreviousCents,
    deltaPreviousPercent,
    historicalMedianCents,
    deltaMedianCents,
    deltaMedianPercent,
    firstOccurrenceDate,
    firstOccurrenceCents,
    deltaFirstCents,
    deltaFirstPercent,
    hasPriceIncrease,
    history,
  };
}

