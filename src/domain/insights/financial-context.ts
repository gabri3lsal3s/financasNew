/**
 * Motor Holístico de Contexto Financeiro (`UserFinancialContext`) — PLANO MESTRE FASE 1.
 *
 * Fonte única de verdade (SSOT) pura e determinística que consolida:
 *   1. Normalização contábil do ciclo (Lente Consumo vs. Lente Liquidez vs. Lente Patrimônio);
 *   2. Neutralização de estornos `[REFUND]` por bucket (e isolamento cross-month em `priorCycleRefundCreditCents`);
 *   3. Particionamento de despesas entre Estruturais/Fixas, Pontuais/Viagens e Variáveis cotidianas;
 *   4. Resolução inteligente da Base Mensal de Referência (incluindo suporte a recebimento quinzenal/fracionado);
 *   5. Classificação de Maturidade do Ciclo (`cold_start` | `awaiting_income` | `early_month` | `active_cycle`).
 *
 * 100% puro — zero dependências de UI, React ou Supabase. Moeda estritamente em centavos inteiros.
 */

import { numberToCents } from "@/domain/money/parse";
import { resolveCategorySemantics } from "./category-semantics";
import {
  buildUnifiedLearningGraph,
  estimateUpcomingCycleInflowsCents,
  stripOccurrencePrefix,
  type BuildUnifiedLearningGraphInput,
  type UnifiedLearningGraph,
} from "./learning-graph";
import { medianOf } from "./recurrences";
import { normalizeText, stripTemporalSuffixes } from "./shared";
import { findMatchingServiceKey } from "./subscriptions";

export type AccountMaturityStage =
  | "cold_start" // Sem renda no mês, sem histórico útil e sem orçamentos definidos
  | "awaiting_income" // Possui histórico de renda/metas/orçamentos, mas renda do mês = 0
  | "early_month" // Possui base de referência, mas dia < 8 ou amostragem variável insuficiente
  | "active_cycle"; // Ciclo maduro com base válida e massa crítica de transações

export type ReferenceBudgetSource =
  | "current_income" // Renda operacional efetiva do mês atual
  | "current_plus_expected_income" // Renda parcial já recebida + parcelas esperadas (PaydayProfile conf >= 0.6)
  | "expected_income" // Renda habitual aprendida (PaydayProfile / metas de receita / M-1)
  | "category_budgets" // Soma dos limites de orçamento definidos nas categorias
  | "none"; // Nenhuma referência cadastrada

export type ExpensePartitionBucket = "fixed" | "one_off_or_trip" | "variable";

export interface ContextCategoryLike {
  id: string;
  name: string;
  icon?: string | null;
  type?: string;
}

export interface ContextIncomeLike {
  id?: string;
  date: string;
  value: number;
  report_weight?: number | null;
  source_ref?: string | null;
  category_id?: string | null;
  description?: string | null;
}

export interface ContextExpenseLike {
  id: string;
  date: string;
  value: number;
  report_weight?: number | null;
  category_id: string;
  description?: string | null;
  recurrence_id?: string | null;
  installment_group_id?: string | null;
  trip_id?: string | null;
  payment_method?: string | null;
  card_id?: string | null;
}

export interface PendingRecurringCommitmentLike {
  key: string;
  amountCents: number;
  isFormal?: boolean;
  alreadyPaidThisMonth?: boolean;
}

export interface NormalizedCycleLens {
  /** Lente Consumo / Competência (ponderada por report_weight, com [REFUND] neutralizado). */
  consumption: {
    operatingIncomeCents: number; // Exclui [REFUND]
    refundsNeutralizedCents: number; // Estornos abatidos contra despesas do mês atual
    priorCycleRefundCreditCents: number; // Estornos de ciclos anteriores (não distorcem variableExpenseCents)
    grossWeightedExpenseCents: number; // Soma ponderada bruta antes de abatimentos
    netExpenseCents: number; // max(0, fixedPaidCents + oneOffAndTripCents + variableExpenseCents - priorCycleRefundCreditCents)
    fixedPaidCents: number; // Recorrências + estruturais + essenciais pagas (pós-estorno no bucket)
    oneOffAndTripCents: number; // Compras pontuais (one_off / tx_one_off) + despesas com trip_id (pós-estorno no bucket)
    variableExpenseCents: number; // Gasto cotidiano variável (pós-estorno no bucket; base para burn rate)
    variableDaysCount: number; // Dias distintos com gasto variável
    variableTxCount: number; // Quantidade de transações variáveis
    historicalVariableMedianCents: number; // Mediana de gastos variáveis de M-1..M-3
  };
  /** Lente Liquidez / Caixa (estritamente regime de caixa bancário). */
  liquidity: {
    hasLiquidityContext: boolean; // true se há CashCheckpoint ou histórico real de caixa
    realCashBalanceCents: number;
    committedObligationsCents: number; // Faturas abertas + dívidas pagáveis do ciclo
    safeToSpendCents: number;
    pendingRecurringExpensesCents: number; // Custos fixos previstos ainda não lançados no mês
    expectedUpcomingInflowsCents: number; // Rendas habituais previstas ainda não recebidas no mês
  };
  /** Lente Patrimônio & Investimentos (integração holística). */
  wealth: {
    hasInvestmentsAccess: boolean;
    monthlyContributionsCents: number;
    monthlySettledDividendsCents: number;
    emergencyReserveCents: number;
    emergencyTargetCents: number;
    emergencyMonthsCovered: number | null; // null quando não há custo de vida base
    emergencyTargetMonths: 3 | 6 | 12;
    hasExternalEmergencyFund: boolean; // Override limpo em emergencyFundConfig
    isEmergencyFundComplete: boolean;
    emergencyGapCents: number;
  };
}

export interface UserFinancialContext {
  month: string;
  todayISO: string;
  dayOfMonth: number;
  daysInMonth: number;
  elapsedPercent: number;
  isCurrentMonth: boolean;
  maturity: AccountMaturityStage;
  referenceBudgetCents: number;
  referenceBudgetSource: ReferenceBudgetSource;
  /** Flag informando se a base está usando estimativa provisória (expected_income, current_plus_expected_income ou category_budgets). */
  isProvisionalReference: boolean;
  learning: UnifiedLearningGraph;
  lens: NormalizedCycleLens;
  /** Obrigações recorrentes (formais + detectadas) unificadas para todos os módulos. */
  fixedCommitmentsSummary: {
    totalMonthlyFixedCents: number;
    pendingThisMonthCents: number;
    formalCount: number;
    detectedCount: number;
    fixedCommitmentRatePercent: number | null;
  };
}

export interface BuildUserFinancialContextInput {
  /** Competência de referência (YYYY-MM). */
  month: string;
  /** Data atual local (YYYY-MM-DD). */
  todayISO: string;
  /** Se a competência de referência corresponde ao mês calendário corrente. */
  isCurrentMonth?: boolean;
  /** Receitas do mês de referência. */
  monthIncomes: readonly ContextIncomeLike[];
  /** Despesas do mês de referência. */
  monthExpenses: readonly ContextExpenseLike[];
  /** Receitas de meses anteriores (para PaydayProfile e fallback de renda histórica). */
  historicalIncomes?: readonly ContextIncomeLike[];
  /** Despesas agrupadas por meses anteriores (ex.: [M-1, M-2, M-3]) para mediana histórica variável. */
  historicalExpensesByMonth?: readonly (readonly ContextExpenseLike[])[];
  /** Catálogo de categorias do usuário. */
  categories?: readonly ContextCategoryLike[];
  /** Grafo de aprendizado pré-construído (ou parâmetros para construí-lo internamente). */
  learning?: UnifiedLearningGraph;
  learningInput?: Omit<BuildUnifiedLearningGraphInput, "referenceMonth">;
  /** Chaves de ocorrências recorrentes conhecidas (detectadas ou formais) para classificar fixos. */
  knownRecurringKeys?: ReadonlySet<string>;
  /** Obrigações recorrentes do ciclo (formais + detectadas) para cômputo de fixos pendentes. */
  recurringCommitments?: readonly PendingRecurringCommitmentLike[];
  /** Soma das metas de receita configuradas para o mês (em centavos). */
  incomeGoalsForMonthCents?: number;
  /** Lente de liquidez em conta (opcional — fallback seguro). */
  liquidity?: {
    hasCheckpoint?: boolean;
    hasCashHistory?: boolean;
    realCashBalanceCents?: number;
    committedObligationsCents?: number;
    safeToSpendCents?: number;
  };
  /** Lente de patrimônio / investimentos / reserva de emergência (opcional). */
  wealth?: {
    hasInvestmentsAccess?: boolean;
    monthlyContributionsCents?: number;
    monthlySettledDividendsCents?: number;
    emergencyReserveCents?: number;
    emergencyTargetMonths?: 3 | 6 | 12;
    hasExternalEmergencyFund?: boolean;
    baselineMonthlyExpensesCents?: number;
  };
}

/** Raízes lexicais de despesas estruturais/fixas de ciclo único (não multiplicáveis por dia). */
const STRUCTURAL_FIXED_CATEGORY_SLUGS = new Set(["moradia", "educacao"]);
const STRUCTURAL_FIXED_ICONS = new Set([
  "moradia",
  "educacao",
  "energia",
  "agua",
  "internet",
  "telefone",
  "impostos",
  "tributos",
  "assinaturas",
  "streaming",
]);
const STRUCTURAL_FIXED_DESCRIPTION_REGEX =
  /\b(?:aluguel|condom[ií]nio|iptu|ipva|financiamento|presta[cç][aã]o|mensalidade|plano\s+de\s+sa[uú]de|seguro|energia|luz|[aá]gua|g[aá]s|internet|fibra|escola|faculdade|creche)\b/i;

function weightedCents(value: number, reportWeight?: number | null): number {
  const base = numberToCents(value);
  if (reportWeight === undefined || reportWeight === null || reportWeight === 1) {
    return base;
  }
  const w = Number.isFinite(reportWeight) ? Math.max(0, reportWeight) : 1;
  return Math.round(base * w);
}

function getDaysInYearMonth(month: string): number {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr ?? 2026);
  const monthNum = Number(mStr ?? 1);
  return new Date(year, monthNum, 0).getDate();
}

function parseDayOfMonth(todayISO: string, daysInMonth: number): number {
  const day = parseInt(todayISO.slice(8, 10), 10);
  if (Number.isNaN(day) || day < 1) return 1;
  return Math.min(day, daysInMonth);
}

function resolveCanonicalExpenseKey(
  expense: ContextExpenseLike,
  learning: UnifiedLearningGraph,
): string {
  const raw = (expense.description ?? "").trim();
  const matchedService = raw ? findMatchingServiceKey(raw) : null;
  if (matchedService) return matchedService;
  const cleaned = normalizeText(stripTemporalSuffixes(raw));
  if (!cleaned) return "";
  return learning.merchantAliasMap.get(cleaned) ?? cleaned;
}

/**
 * Classifica uma única despesa em um dos 3 buckets canônicos:
 *   • `one_off_or_trip`: marcada como `tx_one_off:<id>`, `one_off` no ciclo ou pertencente a viagem (`trip_id`);
 *   • `fixed`: recorrência formal (`recurrence_id`), parcela (`installment_group_id`), recorrência conhecida,
 *              marcada como `"essential"` no aprendizado, serviço conhecido ou despesa estrutural (aluguel/imposto/utilities);
 *   • `variable`: gasto cotidiano variável que compõe o burn rate diário.
 */
export function classifyExpensePartitionBucket(
  expense: ContextExpenseLike,
  category: ContextCategoryLike | undefined,
  learning: UnifiedLearningGraph,
  knownRecurringKeys?: ReadonlySet<string>,
): ExpensePartitionBucket {
  // 1. Isolamento de viagens e pontuais (tem precedência para nunca inflar burn rate)
  if (expense.trip_id) {
    return "one_off_or_trip";
  }
  if (learning.oneOffExpenseIds.has(expense.id)) {
    return "one_off_or_trip";
  }

  const canonicalKey = resolveCanonicalExpenseKey(expense, learning);
  if (
    canonicalKey &&
    (learning.currentMonthOneOffKeys.has(canonicalKey) ||
      learning.currentMonthOneOffKeys.has(`sub:${canonicalKey}`) ||
      learning.currentMonthOneOffKeys.has(`recurring:${canonicalKey}`) ||
      learning.currentMonthOneOffKeys.has(`habit:${expense.category_id}:${canonicalKey}`))
  ) {
    return "one_off_or_trip";
  }

  // 2. Despesas estruturais / fixas / contratuais (entram 1x no mês, nunca extrapoladas x30)
  if (expense.recurrence_id || expense.installment_group_id) {
    return "fixed";
  }

  if (
    canonicalKey &&
    (learning.essentialKeys.has(canonicalKey) ||
      learning.essentialKeys.has(`sub:${canonicalKey}`) ||
      learning.essentialKeys.has(`recurring:${canonicalKey}`))
  ) {
    return "fixed";
  }

  if (knownRecurringKeys && canonicalKey) {
    if (
      knownRecurringKeys.has(canonicalKey) ||
      knownRecurringKeys.has(`sub:${canonicalKey}`) ||
      knownRecurringKeys.has(`recurring:${canonicalKey}`) ||
      knownRecurringKeys.has(`weekly:${canonicalKey}`)
    ) {
      return "fixed";
    }
  }

  const rawDesc = (expense.description ?? "").trim();
  if (rawDesc && (findMatchingServiceKey(rawDesc) !== null || STRUCTURAL_FIXED_DESCRIPTION_REGEX.test(rawDesc))) {
    return "fixed";
  }

  if (category) {
    const icon = (category.icon ?? "").toLowerCase().trim();
    const sem = resolveCategorySemantics({ name: category.name, icon: category.icon });
    if (
      sem.isSubscriptionCategory ||
      STRUCTURAL_FIXED_ICONS.has(icon) ||
      (sem.canonicalSlug !== undefined && STRUCTURAL_FIXED_CATEGORY_SLUGS.has(sem.canonicalSlug))
    ) {
      return "fixed";
    }
  }

  return "variable";
}

export interface PartitionedExpensesResult {
  grossWeightedExpenseCents: number;
  fixedPaidCents: number;
  oneOffAndTripCents: number;
  variableExpenseCents: number;
  variableDaysCount: number;
  variableTxCount: number;
  refundsNeutralizedCents: number;
  priorCycleRefundCreditCents: number;
  netExpenseCents: number;
}

/**
 * Particiona as despesas do mês entre `fixed`, `one_off_or_trip` e `variable`,
 * aplicando neutralização precisa de estornos (`[REFUND]`):
 *   • Se o estorno casar com despesa compatível no mês atual (mesma categoria ou valor <= bucket),
 *     abate exatamente daquele bucket;
 *   • Se for estorno de ciclo anterior (sem despesa correspondente no mês), isola em
 *     `priorCycleRefundCreditCents` para abater `netExpenseCents` sem distorcer `variableExpenseCents`.
 *
 * Invariante garantida:
 *   `netExpenseCents === Math.max(0, fixedPaidCents + oneOffAndTripCents + variableExpenseCents - priorCycleRefundCreditCents)`
 */
export function partitionAndNormalizeCycleExpenses(params: {
  monthExpenses: readonly ContextExpenseLike[];
  monthIncomes: readonly ContextIncomeLike[];
  categoryById: ReadonlyMap<string, ContextCategoryLike>;
  learning: UnifiedLearningGraph;
  knownRecurringKeys?: ReadonlySet<string>;
}): PartitionedExpensesResult {
  const { monthExpenses, monthIncomes, categoryById, learning, knownRecurringKeys } = params;

  interface BucketedExpense {
    expense: ContextExpenseLike;
    cents: number;
    bucket: ExpensePartitionBucket;
    remainingCents: number;
  }

  const items: BucketedExpense[] = [];
  let grossWeightedExpenseCents = 0;

  for (const exp of monthExpenses) {
    const cents = weightedCents(exp.value, exp.report_weight);
    if (cents <= 0) continue;
    grossWeightedExpenseCents += cents;
    const bucket = classifyExpensePartitionBucket(
      exp,
      categoryById.get(exp.category_id),
      learning,
      knownRecurringKeys,
    );
    items.push({ expense: exp, cents, bucket, remainingCents: cents });
  }

  // Neutralização de estornos [REFUND]
  const refundIncomes = monthIncomes.filter(
    (inc) => Boolean(inc.source_ref?.startsWith("[REFUND]")) && weightedCents(inc.value, inc.report_weight) > 0,
  );

  let refundsNeutralizedCents = 0;
  let priorCycleRefundCreditCents = 0;

  for (const refund of refundIncomes) {
    const refundCents = weightedCents(refund.value, refund.report_weight);
    const refundDescNorm = normalizeText(refund.description ?? "");
    const cleanRefundDesc = refundDescNorm
      .replace(/^(?:estorno|reembolso|devolucao|credito|cashback)(?:\s+(?:de|da|do|em|na|no))?\s+/, "")
      .trim();

    // 1º: Procura despesa no mês atual com valor suficiente (>= refundCents) e descrição compatível (mesmo após remover prefixo de estorno)
    let matchedItem = items.find((item) => {
      if (item.remainingCents < refundCents) return false;
      const itemDescNorm = normalizeText(item.expense.description ?? "");
      if (cleanRefundDesc.length < 3 || itemDescNorm.length < 3) return false;
      return itemDescNorm.includes(cleanRefundDesc) || cleanRefundDesc.includes(itemDescNorm);
    });

    if (!matchedItem) {
      // 2º: Despesa no mês atual com valor exato (tolerância 0 centavos) em cartão de crédito (caso mais comum de estorno no mesmo mês)
      matchedItem = items.find(
        (item) =>
          item.remainingCents === refundCents &&
          (item.expense.payment_method === "credit_card" || Boolean(item.expense.card_id)),
      );
    }

    if (!matchedItem) {
      // 3º: Qualquer despesa no mês atual com valor exato
      matchedItem = items.find((item) => item.remainingCents === refundCents);
    }

    if (!matchedItem && refund.category_id) {
      // 4º: Despesa na mesma categoria com valor suficiente no mês atual (estorno parcial)
      matchedItem = items.find(
        (item) =>
          item.expense.category_id === refund.category_id &&
          item.remainingCents >= refundCents,
      );
    }

    if (matchedItem) {
      matchedItem.remainingCents -= refundCents;
      refundsNeutralizedCents += refundCents;
    } else {
      // Estorno cross-month (compra ocorreu em ciclo anterior): isola sem distorcer os buckets do mês atual
      priorCycleRefundCreditCents += refundCents;
    }
  }

  let fixedPaidCents = 0;
  let oneOffAndTripCents = 0;
  let variableExpenseCents = 0;
  let variableTxCount = 0;
  const variableDays = new Set<string>();

  for (const item of items) {
    if (item.remainingCents <= 0) continue;
    if (item.bucket === "fixed") {
      fixedPaidCents += item.remainingCents;
    } else if (item.bucket === "one_off_or_trip") {
      oneOffAndTripCents += item.remainingCents;
    } else {
      variableExpenseCents += item.remainingCents;
      variableTxCount += 1;
      if (item.expense.date && item.expense.date.length >= 10) {
        variableDays.add(item.expense.date.slice(0, 10));
      }
    }
  }

  const totalAfterBucketNeutralization = fixedPaidCents + oneOffAndTripCents + variableExpenseCents;
  const netExpenseCents = Math.max(0, totalAfterBucketNeutralization - priorCycleRefundCreditCents);

  return {
    grossWeightedExpenseCents,
    fixedPaidCents,
    oneOffAndTripCents,
    variableExpenseCents,
    variableDaysCount: variableDays.size,
    variableTxCount,
    refundsNeutralizedCents,
    priorCycleRefundCreditCents,
    netExpenseCents,
  };
}

export interface MonthlyReferenceBudgetResult {
  referenceBudgetCents: number;
  source: ReferenceBudgetSource;
  isProvisionalReference: boolean;
}

/**
 * Resolve a Base Mensal de Referência de forma única e determinística (SSOT):
 *   1. `operatingIncomeCents > 0`:
 *        • Se o `PaydayProfile` (confiança >= 0.6) ainda tiver `expectedUpcomingInflowsCents > 0`
 *          previstos no ciclo atual (ex.: recebimento quinzenal/fracionado), retorna
 *          `operatingIncomeCents + expectedUpcomingInflowsCents` (`current_plus_expected_income`, provisório);
 *        • Caso contrário, retorna `operatingIncomeCents` (`current_income`, definitivo).
 *   2. `operatingIncomeCents === 0`:
 *        • Se houver renda esperada aprendida (`paydayProfile.expectedMonthlyIncomeCents > 0`) ou metas de receita
 *          (`incomeGoalsForMonthCents > 0`), usa a maior entre elas (`expected_income`, provisório);
 *        • Caso contrário, se o usuário definiu tetos de orçamento em categorias (`totalBudgetLimitsCents > 0`),
 *          usa `totalBudgetLimitsCents` (`category_budgets`, provisório);
 *        • Caso contrário (cold start absoluto), retorna `0` (`none`).
 */
export function resolveMonthlyReferenceBudget(params: {
  operatingIncomeCents: number;
  expectedUpcomingInflowsCents: number;
  paydayProfileConfidence: number;
  expectedMonthlyIncomeCents: number;
  incomeGoalsForMonthCents: number;
  totalBudgetLimitsCents: number;
}): MonthlyReferenceBudgetResult {
  const {
    operatingIncomeCents,
    expectedUpcomingInflowsCents,
    paydayProfileConfidence,
    expectedMonthlyIncomeCents,
    incomeGoalsForMonthCents,
    totalBudgetLimitsCents,
  } = params;

  if (operatingIncomeCents > 0) {
    if (paydayProfileConfidence >= 0.6 && expectedUpcomingInflowsCents > 0) {
      return {
        referenceBudgetCents: operatingIncomeCents + expectedUpcomingInflowsCents,
        source: "current_plus_expected_income",
        isProvisionalReference: true,
      };
    }
    return {
      referenceBudgetCents: operatingIncomeCents,
      source: "current_income",
      isProvisionalReference: false,
    };
  }

  const expectedBase = Math.max(expectedMonthlyIncomeCents, incomeGoalsForMonthCents);
  if (expectedBase > 0) {
    return {
      referenceBudgetCents: expectedBase,
      source: "expected_income",
      isProvisionalReference: true,
    };
  }

  if (totalBudgetLimitsCents > 0) {
    return {
      referenceBudgetCents: totalBudgetLimitsCents,
      source: "category_budgets",
      isProvisionalReference: true,
    };
  }

  return {
    referenceBudgetCents: 0,
    source: "none",
    isProvisionalReference: false,
  };
}

/**
 * Classifica o estágio de maturidade do ciclo atual (`AccountMaturityStage`).
 */
export function resolveAccountMaturityStage(params: {
  referenceBudgetSource: ReferenceBudgetSource;
  operatingIncomeCents: number;
  dayOfMonth: number;
  variableTxCount: number;
  variableDaysCount: number;
  historicalVariableMedianCents: number;
  isCurrentMonth: boolean;
}): AccountMaturityStage {
  const {
    referenceBudgetSource,
    operatingIncomeCents,
    dayOfMonth,
    variableTxCount,
    variableDaysCount,
    historicalVariableMedianCents,
    isCurrentMonth,
  } = params;

  if (referenceBudgetSource === "none") {
    return "cold_start";
  }

  if (operatingIncomeCents <= 0) {
    return "awaiting_income";
  }

  if (
    isCurrentMonth &&
    (dayOfMonth < 8 ||
      (historicalVariableMedianCents <= 0 && (variableTxCount < 3 || variableDaysCount < 2)))
  ) {
    return "early_month";
  }

  return "active_cycle";
}

/**
 * Constrói o contexto financeiro holístico completo (`UserFinancialContext`) a partir dos dados do mês e histórico.
 */
export function buildUserFinancialContext(
  input: BuildUserFinancialContextInput,
): UserFinancialContext {
  const {
    month,
    todayISO,
    isCurrentMonth = todayISO.slice(0, 7) === month,
    monthIncomes,
    monthExpenses,
    historicalIncomes = [],
    historicalExpensesByMonth = [],
    categories = [],
    knownRecurringKeys,
    recurringCommitments = [],
    incomeGoalsForMonthCents = 0,
    liquidity,
    wealth,
  } = input;

  const daysInMonth = getDaysInYearMonth(month);
  const dayOfMonth = isCurrentMonth ? parseDayOfMonth(todayISO, daysInMonth) : daysInMonth;
  const elapsedPercent = Math.min(100, (dayOfMonth / daysInMonth) * 100);

  const learning: UnifiedLearningGraph =
    input.learning ??
    buildUnifiedLearningGraph({
      referenceMonth: month,
      historicalIncomes: [...historicalIncomes, ...monthIncomes],
      incomeGoalsForMonthCents,
      ...(input.learningInput ?? {}),
    });

  const categoryById = new Map<string, ContextCategoryLike>(categories.map((c) => [c.id, c]));

  // 1. Renda operacional do mês (exclui estornos [REFUND])
  let operatingIncomeCents = 0;
  for (const inc of monthIncomes) {
    if (inc.source_ref?.startsWith("[REFUND]")) continue;
    const cents = weightedCents(inc.value, inc.report_weight);
    if (cents > 0) operatingIncomeCents += cents;
  }

  // 2. Particionamento de despesas do mês + neutralização de estornos [REFUND]
  const partitioned = partitionAndNormalizeCycleExpenses({
    monthExpenses,
    monthIncomes,
    categoryById,
    learning,
    knownRecurringKeys,
  });

  // 3. Mediana histórica de gastos variáveis (M-1..M-3)
  // Isola `currentMonthOneOffKeys` para que `one_off` do mês corrente não contamine a mediana histórica.
  const historicalLearning: UnifiedLearningGraph = {
    ...learning,
    currentMonthOneOffKeys: new Set<string>(),
  };
  const pastVariableTotals: number[] = [];
  for (const pastMonthExps of historicalExpensesByMonth) {
    if (pastMonthExps.length === 0) continue;
    let varTotal = 0;
    for (const exp of pastMonthExps) {
      const cents = weightedCents(exp.value, exp.report_weight);
      if (cents <= 0) continue;
      const bucket = classifyExpensePartitionBucket(
        exp,
        categoryById.get(exp.category_id),
        historicalLearning,
        knownRecurringKeys,
      );
      if (bucket === "variable") {
        varTotal += cents;
      }
    }
    if (varTotal > 0) {
      pastVariableTotals.push(varTotal);
    }
  }
  const historicalVariableMedianCents = medianOf(pastVariableTotals);

  // 4. Entradas habituais ainda previstas no ciclo (PaydayProfile)
  const expectedUpcomingInflowsCents = isCurrentMonth
    ? estimateUpcomingCycleInflowsCents({
        paydayProfile: learning.paydayProfile,
        operatingIncomeSoFarCents: operatingIncomeCents,
        dayOfMonth,
        daysInMonth,
      })
    : 0;

  // 5. Base de Referência Mensal (SSOT)
  let totalBudgetLimitsCents = 0;
  for (const limitCents of learning.budgetedCategoryLimits.values()) {
    totalBudgetLimitsCents += limitCents;
  }

  const refBudget = resolveMonthlyReferenceBudget({
    operatingIncomeCents,
    expectedUpcomingInflowsCents,
    paydayProfileConfidence: learning.paydayProfile.confidence,
    expectedMonthlyIncomeCents: learning.paydayProfile.expectedMonthlyIncomeCents,
    incomeGoalsForMonthCents,
    totalBudgetLimitsCents,
  });

  // 6. Obrigações fixas recorrentes do ciclo (formais + detectadas)
  let totalMonthlyFixedCents = 0;
  let pendingThisMonthCents = 0;
  let formalCount = 0;
  let detectedCount = 0;

  for (const commitment of recurringCommitments) {
    const cleanKey = stripOccurrencePrefix(commitment.key);
    if (learning.ignoredKeys.has(commitment.key) || (cleanKey && learning.ignoredKeys.has(cleanKey))) {
      continue;
    }
    const amt = Math.max(0, Math.round(commitment.amountCents));
    totalMonthlyFixedCents += amt;
    if (commitment.isFormal) formalCount += 1;
    else detectedCount += 1;
    if (isCurrentMonth && !commitment.alreadyPaidThisMonth) {
      pendingThisMonthCents += amt;
    }
  }

  const fixedCommitmentRatePercent =
    refBudget.referenceBudgetCents > 0
      ? Number(((totalMonthlyFixedCents / refBudget.referenceBudgetCents) * 100).toFixed(1))
      : null;

  // 7. Estágio de Maturidade
  const maturity = resolveAccountMaturityStage({
    referenceBudgetSource: refBudget.source,
    operatingIncomeCents,
    dayOfMonth,
    variableTxCount: partitioned.variableTxCount,
    variableDaysCount: partitioned.variableDaysCount,
    historicalVariableMedianCents,
    isCurrentMonth,
  });

  // 8. Lente Liquidez
  const realCashBalanceCents = liquidity?.realCashBalanceCents ?? 0;
  const committedObligationsCents = Math.max(0, liquidity?.committedObligationsCents ?? 0);
  const safeToSpendCents = liquidity?.safeToSpendCents ?? realCashBalanceCents - committedObligationsCents;
  const hasLiquidityContext = Boolean(
    liquidity?.hasCheckpoint ||
      liquidity?.hasCashHistory ||
      realCashBalanceCents > 0 ||
      operatingIncomeCents > 0,
  );

  // 9. Lente Patrimônio & Reserva de Emergência
  const emergencyTargetMonths: 3 | 6 | 12 = wealth?.emergencyTargetMonths ?? 6;
  const hasExternalEmergencyFund = Boolean(wealth?.hasExternalEmergencyFund);
  const emergencyReserveCents = Math.max(0, wealth?.emergencyReserveCents ?? 0);

  // Custo de vida base para reserva (evita projeção distorcida em cold start)
  const pastFullTotals = historicalExpensesByMonth
    .map((list) => list.reduce((acc, e) => acc + weightedCents(e.value, e.report_weight), 0))
    .filter((v) => v > 0);
  const historicalFullMedian = medianOf(pastFullTotals);
  const effectiveBaselineExpensesCents =
    wealth?.baselineMonthlyExpensesCents !== undefined
      ? Math.max(0, wealth.baselineMonthlyExpensesCents)
      : historicalFullMedian > 0
        ? historicalFullMedian
        : totalMonthlyFixedCents + historicalVariableMedianCents > 0
          ? totalMonthlyFixedCents + historicalVariableMedianCents
          : partitioned.fixedPaidCents > 0
            ? partitioned.fixedPaidCents
            : partitioned.netExpenseCents > 0
              ? partitioned.netExpenseCents
              : 0;

  const emergencyTargetCents =
    effectiveBaselineExpensesCents > 0
      ? Math.round(effectiveBaselineExpensesCents * emergencyTargetMonths)
      : 0;
  const emergencyMonthsCovered =
    effectiveBaselineExpensesCents > 0
      ? Number((emergencyReserveCents / effectiveBaselineExpensesCents).toFixed(1))
      : null;
  const emergencyGapCents =
    hasExternalEmergencyFund || emergencyTargetCents <= 0
      ? 0
      : Math.max(0, emergencyTargetCents - emergencyReserveCents);
  const isEmergencyFundComplete =
    hasExternalEmergencyFund ||
    (emergencyTargetCents > 0 && emergencyReserveCents >= emergencyTargetCents);

  return {
    month,
    todayISO,
    dayOfMonth,
    daysInMonth,
    elapsedPercent,
    isCurrentMonth,
    maturity,
    referenceBudgetCents: refBudget.referenceBudgetCents,
    referenceBudgetSource: refBudget.source,
    isProvisionalReference: refBudget.isProvisionalReference,
    learning,
    lens: {
      consumption: {
        operatingIncomeCents,
        refundsNeutralizedCents: partitioned.refundsNeutralizedCents,
        priorCycleRefundCreditCents: partitioned.priorCycleRefundCreditCents,
        grossWeightedExpenseCents: partitioned.grossWeightedExpenseCents,
        netExpenseCents: partitioned.netExpenseCents,
        fixedPaidCents: partitioned.fixedPaidCents,
        oneOffAndTripCents: partitioned.oneOffAndTripCents,
        variableExpenseCents: partitioned.variableExpenseCents,
        variableDaysCount: partitioned.variableDaysCount,
        variableTxCount: partitioned.variableTxCount,
        historicalVariableMedianCents,
      },
      liquidity: {
        hasLiquidityContext,
        realCashBalanceCents,
        committedObligationsCents,
        safeToSpendCents,
        pendingRecurringExpensesCents: pendingThisMonthCents,
        expectedUpcomingInflowsCents,
      },
      wealth: {
        hasInvestmentsAccess: Boolean(wealth?.hasInvestmentsAccess),
        monthlyContributionsCents: Math.max(0, wealth?.monthlyContributionsCents ?? 0),
        monthlySettledDividendsCents: Math.max(0, wealth?.monthlySettledDividendsCents ?? 0),
        emergencyReserveCents,
        emergencyTargetCents,
        emergencyMonthsCovered,
        emergencyTargetMonths,
        hasExternalEmergencyFund,
        isEmergencyFundComplete,
        emergencyGapCents,
      },
    },
    fixedCommitmentsSummary: {
      totalMonthlyFixedCents,
      pendingThisMonthCents,
      formalCount,
      detectedCount,
      fixedCommitmentRatePercent,
    },
  };
}
