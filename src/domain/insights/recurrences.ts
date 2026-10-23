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

export interface RecurrenceOccurrence {
  /** Chave estável para aprendizado/feedback (nome normalizado). */
  key: string;
  name: string;
  level: RecurrenceKind;
  /** Cadência temporal da recorrência (padrão mensal; suporta semanal e anual F21). */
  cadence?: "monthly" | "weekly" | "annual";
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

export const VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT = 15;
export const VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT = 30;

export interface BudgetImpactOccurrence {
  name?: string;
  averageCents: number;
  tier?: CutTier;
  level?: RecurrenceKind;
  key?: string;
}

export interface BudgetImpactEvaluation {
  /** Custo projetado anual em centavos (averageCents * 12). */
  annualCostCents: number;
  /** Valor monetário anual formatado (ex.: "R$ 1.080,00"). */
  annualCostFormatted: string;
  /** Mensagem editorial canônica com o custo anual projetado (ex.: "Essa assinatura custa R$ 1.080,00 por ano"). */
  annualCostMessage: string;
  /** Percentual da renda mensal comprometido por este gasto recorrente (0–100). */
  incomeSharePercent: number;
  /** Sinaliza se o gasto compromete >= 15% da renda mensal. */
  highIncomeImpact: boolean;
  /** Percentual do orçamento da categoria comprometido (0–100). */
  categoryBudgetSharePercent: number;
  /** Sinaliza se o gasto compromete >= 30% do orçamento da categoria. */
  highCategoryBudgetImpact: boolean;
  /** Sinaliza alto impacto orçamentário geral (renda >= 15% OU categoria >= 30%). */
  hasHighBudgetImpact: boolean;
  /**
   * Sinaliza se é considerado "gasto vampiro":
   * Assinatura ou recorrência com potencial de corte (can_cut / review)
   * ou com alto impacto orçamentário sem ser uma despesa essencial.
   */
  isVampire: boolean;
  /** Mensagem editorial de recomendação ou alerta para apresentação (ex.: no SmartAdvisorCard). */
  recommendationMessage?: string;
}

/** Formata centavos em moeda BRL pura (ex.: 108000 -> "R$ 1.080,00"). */
export function formatBRL(cents: number): string {
  const safe = Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : 0;
  const reais = (safe / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${reais}`;
}

/**
 * Avalia o impacto orçamentário e identifica "gastos vampiros" (Fase 4, Tarefa 4.2).
 *
 * Função pura que:
 *   1. Calcula o custo anual projetado (`averageCents * 12`) e gera a mensagem editorial
 *      (ex.: "Essa assinatura custa R$ 1.080,00 por ano");
 *   2. Sinaliza alto impacto quando compromete >= 15% da renda mensal ou >= 30% do orçamento da categoria;
 *   3. Identifica "gastos vampiros" (assinaturas com potencial de corte/revisão ou com alto impacto
 *      orçamentário que não sejam despesas essenciais).
 */
export function evaluateBudgetImpact(
  occurrence: BudgetImpactOccurrence,
  monthlyIncomeCents?: number,
  categoryBudgetCents?: number,
): BudgetImpactEvaluation {
  const safeAverageCents =
    Number.isFinite(occurrence.averageCents) && occurrence.averageCents > 0
      ? Math.round(occurrence.averageCents)
      : 0;

  const annualCostCents = safeAverageCents * 12;
  const annualCostFormatted = formatBRL(annualCostCents);
  const annualCostMessage = `Essa assinatura custa ${annualCostFormatted} por ano`;

  let incomeSharePercent = 0;
  let highIncomeImpact = false;
  if (typeof monthlyIncomeCents === "number" && monthlyIncomeCents > 0 && safeAverageCents > 0) {
    const rawShare = (safeAverageCents / monthlyIncomeCents) * 100;
    incomeSharePercent = Number(rawShare.toFixed(2));
    highIncomeImpact = rawShare >= VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT - 1e-9;
  }

  let categoryBudgetSharePercent = 0;
  let highCategoryBudgetImpact = false;
  if (typeof categoryBudgetCents === "number" && categoryBudgetCents > 0 && safeAverageCents > 0) {
    const rawShare = (safeAverageCents / categoryBudgetCents) * 100;
    categoryBudgetSharePercent = Number(rawShare.toFixed(2));
    highCategoryBudgetImpact = rawShare >= VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT - 1e-9;
  }

  const hasHighBudgetImpact = highIncomeImpact || highCategoryBudgetImpact;
  const isEssential = occurrence.tier === "essential";
  const isVampire =
    safeAverageCents > 0 &&
    !isEssential &&
    (occurrence.tier === "can_cut" || occurrence.tier === "discretionary" || hasHighBudgetImpact);

  let recommendationMessage: string | undefined;
  if (highIncomeImpact && highCategoryBudgetImpact) {
    recommendationMessage = `Compromete ${incomeSharePercent}% da sua renda e ${categoryBudgetSharePercent}% do orçamento da categoria.`;
  } else if (highIncomeImpact) {
    recommendationMessage = `Compromete ${incomeSharePercent}% da sua renda mensal.`;
  } else if (highCategoryBudgetImpact) {
    recommendationMessage = `Compromete ${categoryBudgetSharePercent}% do orçamento da categoria.`;
  } else if (occurrence.tier === "can_cut") {
    recommendationMessage = `Assinatura com potencial de corte. Economia projetada de ${annualCostFormatted} por ano.`;
  } else if (occurrence.tier === "discretionary") {
    recommendationMessage = `Gasto discricionário sugerido para revisão.`;
  }

  return {
    annualCostCents,
    annualCostFormatted,
    annualCostMessage,
    incomeSharePercent,
    highIncomeImpact,
    categoryBudgetSharePercent,
    highCategoryBudgetImpact,
    hasHighBudgetImpact,
    isVampire,
    recommendationMessage,
  };
}

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
    cadence?: "monthly" | "weekly" | "annual";
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
        : o.averageCents;

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
 * Estima a próxima data de cobrança e a contagem de dias restantes.
 * Identifica também o ciclo de vida da recorrência (active vs lapsed).
 */
export function estimateNextDueDate(
  typicalDay: number,
  latestMonthCharged: string,
  todayISO?: string,
): { nextDueDate?: string; daysUntilNextDue?: number; missingThisMonth?: boolean; lifecycle?: RecurrenceLifecycle } {
  if (!todayISO || todayISO.length < 10) return { lifecycle: "active" };
  const currentMonth = todayISO.slice(0, 7);
  const currentDay = parseInt(todayISO.slice(8, 10), 10);

  // Se a última cobrança ocorreu antes do mês imediatamente anterior (M-1),
  // a despesa cessou/parou há 2+ meses (lapsed/churned).
  // Não projeta cobrança futura no mês atual nem gera falso alerta de pendência.
  const prevMonth = shiftMonth(currentMonth, -1);
  if (latestMonthCharged && latestMonthCharged < prevMonth) {
    return {
      lifecycle: "lapsed",
      missingThisMonth: false,
    };
  }

  let targetYearMonth = currentMonth;
  const alreadyChargedThisMonth = latestMonthCharged >= currentMonth;

  if (alreadyChargedThisMonth) {
    // Já cobrada neste mês -> próxima cobrança é no mês seguinte
    targetYearMonth = shiftMonth(currentMonth, 1);
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

  // Considera ausente/pendente se não foi cobrada neste mês e o dia típico já passou
  const missingThisMonth = !alreadyChargedThisMonth && currentDay > typicalDay;

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

    // Diagnóstico de cobranças duplicadas e reajustes no mês mais recente (Fase 4, Tarefa 4.3).
    const latestMonth = months[months.length - 1];
    const latestExpenses = latestMonth ? (monthMap.get(latestMonth) ?? []) : [];

    // Previsão temporal de próximo vencimento e dia típico
    const dates = group.map((e) => e.date).filter(Boolean);
    const typicalDayOfMonth = calculateTypicalDay(dates);
    const { nextDueDate, daysUntilNextDue, missingThisMonth, lifecycle } = estimateNextDueDate(
      typicalDayOfMonth,
      latestMonth ?? "",
      todayISO,
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
        segment: subscription.segment,
        lifecycle,
        latestMonthCharged: latestMonth,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
        tier: subscription.tier,
        savingsIfCutCents: subscription.savingsIfCutCents,
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

      const rawConfidence = confidenceScore({ base: 0.7, monthsHistory: months.length, kind: "recurring", variance });
      const confidence = isRecPenalized
        ? Number(Math.max(0.05, rawConfidence * 0.2).toFixed(2))
        : rawConfidence;

      const segment = segmentOf(cleanDisplayName, categoryIcons[0], first.categoryName);
      occurrences.push({
        key: recurringKey,
        name: cleanDisplayName,
        level: "recurring",
        segment,
        lifecycle,
        latestMonthCharged: latestMonth,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
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
            .map((e) => e.month || (e.date ? e.date.slice(0, 7) : ""))
            .filter(Boolean),
        ),
      ).sort();

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

