/**
 * Avaliadores puros das 7 pontes bidirecionais e projeções Home <-> Carteira (Onda 2 · Fase 5).
 *
 * Regras estruturais:
 *   - 100% puro: zero dependências de React, TanStack Query, DOM ou Supabase.
 *   - Ausência de qualquer fonte necessária suprime o sinal silenciosamente (`return null`).
 *   - Sem arredondamentos prematuros antes de testar limiares em centavos inteiros.
 *   - Não soma proventos previstos/a conferir em saldo de caixa nem altera saldo livre.
 */

import {
  budgetLimitsByCategory,
  resolveEffectiveLimit,
  spentByCategoryMap,
} from "@/domain/budgets/index";
import type { CycleInvoiceItem } from "@/domain/cash/cycle-obligations";
import { numberToCents } from "@/domain/money/parse";
import {
  buildBillImpactBreakdown,
  buildBudgetCategoryPaceBreakdown,
  buildCombinedContributionBreakdown,
  buildDebtVsInvestBreakdown,
  buildMonthlyContributionConsistencyBreakdown,
  buildTripSettlementBreakdown,
  type CalculationBreakdown,
} from "@/domain/calculation-memory/index";
import type { SurplusAllocationIntent } from "@/domain/overview/surplus";
import type { GovernanceInsight } from "@/domain/portfolio/asset-governance-insights";
import type { StructuralRiskAlert } from "@/domain/portfolio/portfolio-risk-policy";
import type { CashGapAnalysisResult } from "@/domain/projection/cash-gap";
import { resolveActiveTripMember } from "@/domain/trips/index";
import type {
  Budget,
  Category,
  Debt,
  Expense,
  Loan,
  PortfolioContribution,
} from "@/types";
import type { Trip, TripMember, TripMemberBalance } from "@/types/trips";
import type { ClosedCardBillAlert } from "./event-detectors";
import type {
  AppNotification,
  NotificationChannel,
  NotificationDomain,
  NotificationIconName,
  NotificationSeverity,
  NotificationTone,
} from "./types";

export interface BridgeAlertEvaluation {
  canonicalId: string;
  title: string;
  description: string;
  badgeLabel: string;
  ctaLabel: string;
  targetRoute: string;
  priority: number;
  severity: NotificationSeverity;
  cycleRelevance: number;
  tone: NotificationTone;
  domain: NotificationDomain;
  iconName: NotificationIconName;
  channels: readonly NotificationChannel[];
  entityRefs: readonly string[];
  suppressCanonicalIds?: readonly string[];
  amountCents?: number;
  breakdown?: CalculationBreakdown;
  hubNotification: AppNotification;
}

function formatBRLCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercentPtBr(value: number, decimals = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function toneToBadgeVariant(tone: NotificationTone) {
  if (tone === "critical") return "critical" as const;
  if (tone === "warning") return "warning" as const;
  if (tone === "positive") return "positive" as const;
  if (tone === "portfolio") return "portfolio" as const;
  if (tone === "muted") return "muted" as const;
  return "default" as const;
}

function toHubNotification(
  evaluation: Omit<BridgeAlertEvaluation, "hubNotification"> & { dueDate?: string },
): AppNotification {
  return {
    id: `bridge:${evaluation.canonicalId}`,
    domain: evaluation.domain,
    severity: evaluation.severity,
    title: evaluation.title,
    body: evaluation.description,
    badgeLabel: evaluation.badgeLabel,
    badgeVariant: toneToBadgeVariant(evaluation.tone),
    tone: evaluation.tone,
    iconName: evaluation.iconName,
    amountCents: evaluation.amountCents,
    dueDate: evaluation.dueDate,
    targetRoute: evaluation.targetRoute,
    channels: [...evaluation.channels],
    entityRefs: [...evaluation.entityRefs],
    state: "unread",
    carouselCardKey: evaluation.canonicalId,
  };
}

// ---------------------------------------------------------------------------
// 1. Ponte Sobra + Caixa na Corretora (bridge.combined_contribution)
// ---------------------------------------------------------------------------

export interface EvaluateCombinedContributionParams {
  asOf: string;
  month: string;
  isCurrentMonth: boolean;
  allocationIntent: SurplusAllocationIntent;
  suggestedAporteCents: number;
  brokerageCashCents?: number | null;
  minTicketCents?: number;
  hasEligibleDeficitTarget?: boolean | null;
  eligibleClass?: string;
  pendingDividendsCount?: number;
  pendingDividendsBRLCents?: number;
}

export function evaluateCombinedContributionBridge(
  params: EvaluateCombinedContributionParams,
): BridgeAlertEvaluation | null {
  const {
    asOf,
    month,
    isCurrentMonth,
    allocationIntent,
    suggestedAporteCents,
    brokerageCashCents,
    minTicketCents = 10_000,
    hasEligibleDeficitTarget,
    eligibleClass,
    pendingDividendsCount = 0,
    pendingDividendsBRLCents = 0,
  } = params;

  if (!isCurrentMonth) return null;
  if (allocationIntent !== "portfolio_aporte") return null;
  if (!Number.isFinite(suggestedAporteCents) || suggestedAporteCents <= 0) return null;
  if (
    typeof brokerageCashCents !== "number" ||
    !Number.isFinite(brokerageCashCents) ||
    brokerageCashCents < minTicketCents
  ) {
    return null;
  }
  if (hasEligibleDeficitTarget !== true) return null;

  const combinedCents = suggestedAporteCents + brokerageCashCents;
  const dividendMention =
    pendingDividendsCount > 0
      ? ` Há ainda ${pendingDividendsCount} provento(s) a conferir separadamente.`
      : "";

  const base = {
    canonicalId: "bridge.combined_contribution",
    title: "Aporte combinado disponível",
    description: `Some ${formatBRLCents(suggestedAporteCents)} da sobra do mês com ${formatBRLCents(brokerageCashCents)} já em caixa na corretora (total de ${formatBRLCents(combinedCents)}).${dividendMention}`,
    badgeLabel: "Aporte combinado",
    ctaLabel: "Simular aporte combinado",
    targetRoute: `/investments?tab=rebalancear&view=simulador&valor=${suggestedAporteCents}&usarCaixa=1`,
    priority: 2.2,
    severity: "P2_ADVISORY" as const,
    cycleRelevance: 88,
    tone: "portfolio" as const,
    domain: "portfolio" as const,
    iconName: "trending-up" as const,
    channels: ["home_carousel", "investments_carousel", "reminders_page"] as const,
    entityRefs: [
      "bridge:combined_contribution",
      `surplus:${month}`,
      "portfolio:idle_cash",
    ] as const,
    suppressCanonicalIds: [
      "cashflow.surplus",
      "cashflow.surplus_aporte",
      "portfolio.idle_cash",
      "bridge.monthly_contribution_consistency",
    ] as const,
    amountCents: combinedCents,
    breakdown: buildCombinedContributionBreakdown({
      asOf,
      month,
      surplusCents: suggestedAporteCents,
      brokerageCashCents,
      combinedCents,
      minTicketCents,
      pendingDividendsCount,
      pendingDividendsBRLCents,
      eligibleClass,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 2. Ponte Dívida Cara vs. Aporte (bridge.debt_vs_invest.{loanId})
// ---------------------------------------------------------------------------

export interface EvaluateDebtVsInvestParams {
  asOf: string;
  debts?: readonly Debt[];
  loans?: readonly Loan[] | null;
  allocationIntent: SurplusAllocationIntent;
  suggestedAporteCents: number;
  brokerageCashCents?: number | null;
  minMonthlyInterestRatePct?: number;
  minSurplusCents?: number;
  minBrokerageCashCents?: number;
}

export function evaluateDebtVsInvestBridge(
  params: EvaluateDebtVsInvestParams,
): BridgeAlertEvaluation | null {
  const {
    asOf,
    debts,
    loans,
    allocationIntent,
    suggestedAporteCents,
    brokerageCashCents,
    minMonthlyInterestRatePct = 1.5,
    minSurplusCents = 20_000,
    minBrokerageCashCents = 50_000,
  } = params;

  if (!debts || !loans || loans.length === 0) return null;

  const hasEligibleSurplus =
    allocationIntent === "portfolio_aporte" &&
    Number.isFinite(suggestedAporteCents) &&
    suggestedAporteCents >= minSurplusCents;
  const safeCashCents =
    typeof brokerageCashCents === "number" && Number.isFinite(brokerageCashCents)
      ? Math.max(0, brokerageCashCents)
      : 0;
  const hasEligibleCash = safeCashCents >= minBrokerageCashCents;

  if (!hasEligibleSurplus && !hasEligibleCash) return null;

  const candidates: Array<{
    loan: Loan;
    ratePct: number;
    pendingCount: number;
    remainingDebtCents: number;
  }> = [];

  for (const loan of loans) {
    if (
      !Number.isFinite(loan.interest_rate_monthly) ||
      loan.interest_rate_monthly < minMonthlyInterestRatePct
    ) {
      continue;
    }

    const activeInstallments = debts.filter(
      (d) =>
        d.installment_group_id === loan.installment_group_id &&
        d.type === "payable" &&
        !d.paid_at,
    );
    if (activeInstallments.length === 0) continue;

    const remainingDebtCents = activeInstallments.reduce(
      (acc, d) => acc + numberToCents(d.amount),
      0,
    );
    if (remainingDebtCents <= 0) continue;

    candidates.push({
      loan,
      ratePct: loan.interest_rate_monthly,
      pendingCount: activeInstallments.length,
      remainingDebtCents,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.ratePct - a.ratePct ||
      b.remainingDebtCents - a.remainingDebtCents ||
      a.loan.id.localeCompare(b.loan.id),
  );

  const leader = candidates[0]!;
  const canonicalId = `bridge.debt_vs_invest.${leader.loan.id}`;
  const availableCents = (hasEligibleSurplus ? suggestedAporteCents : 0) + safeCashCents;

  const base = {
    canonicalId,
    title: `Avalie contrato a ${formatPercentPtBr(leader.ratePct, 2)} a.m. antes de aportar`,
    description: `${leader.loan.name} tem taxa contratada de ${formatPercentPtBr(leader.ratePct, 2)} a.m. e ${formatBRLCents(leader.remainingDebtCents)} em aberto diante de ${formatBRLCents(availableCents)} disponíveis.`,
    badgeLabel: `${formatPercentPtBr(leader.ratePct, 2)} a.m.`,
    ctaLabel: "Comparar contrato",
    targetRoute: `/dividas?type=loans&q=${encodeURIComponent(leader.loan.id)}`,
    priority: 2.5,
    severity: "P2_ADVISORY" as const,
    cycleRelevance: 82,
    tone: "warning" as const,
    domain: "payable" as const,
    iconName: "alert-triangle" as const,
    channels: ["home_carousel", "investments_carousel", "reminders_page"] as const,
    entityRefs: [`loan:${leader.loan.id}`] as const,
    amountCents: leader.remainingDebtCents,
    breakdown: buildDebtVsInvestBreakdown({
      loanId: leader.loan.id,
      loanName: leader.loan.name,
      interestRateMonthlyPct: leader.ratePct,
      thresholdRateMonthlyPct: minMonthlyInterestRatePct,
      pendingInstallmentsCount: leader.pendingCount,
      remainingDebtCents: leader.remainingDebtCents,
      availableSurplusCents: hasEligibleSurplus ? suggestedAporteCents : 0,
      availableBrokerageCashCents: safeCashCents,
      asOf,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 3. Impacto de Fatura Fechada no Caixa (cashflow.bill_impact.{cardId}.{month})
// ---------------------------------------------------------------------------

export interface EvaluateBillImpactParams {
  isCurrentMonth: boolean;
  billClosingEnabled: boolean;
  hasLiquidityContext: boolean;
  safeToSpendCents: number;
  closedBills?: readonly ClosedCardBillAlert[];
  cycleInvoices?: readonly CycleInvoiceItem[];
  thresholdPct?: number;
}

export function evaluateBillImpactBridge(
  params: EvaluateBillImpactParams,
): BridgeAlertEvaluation | null {
  const {
    isCurrentMonth,
    billClosingEnabled,
    hasLiquidityContext,
    safeToSpendCents,
    closedBills = [],
    cycleInvoices = [],
    thresholdPct = 35,
  } = params;

  if (!isCurrentMonth || !billClosingEnabled || !hasLiquidityContext || closedBills.length === 0) {
    return null;
  }

  const candidates: Array<{
    bill: ClosedCardBillAlert;
    alreadyDeductedCents: number;
    baseLiquidityCents: number;
    impactPct: number;
  }> = [];

  for (const bill of closedBills) {
    if (!Number.isFinite(bill.balanceCents) || bill.balanceCents <= 0) continue;

    const matchedInvoice = cycleInvoices.find(
      (inv) => inv.cardId === bill.cardId && inv.competenceMonth === bill.competenceMonth,
    );
    const alreadyDeductedCents = matchedInvoice
      ? Math.min(bill.balanceCents, Math.max(0, matchedInvoice.saldoCents))
      : 0;
    const baseLiquidityCents = safeToSpendCents + alreadyDeductedCents;

    if (baseLiquidityCents <= 0) continue;
    if (bill.balanceCents * 100 < thresholdPct * baseLiquidityCents) continue;

    candidates.push({
      bill,
      alreadyDeductedCents,
      baseLiquidityCents,
      impactPct: (bill.balanceCents / baseLiquidityCents) * 100,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.impactPct - a.impactPct ||
      b.bill.balanceCents - a.bill.balanceCents ||
      a.bill.cardId.localeCompare(b.bill.cardId) ||
      a.bill.competenceMonth.localeCompare(b.bill.competenceMonth),
  );

  const leader = candidates[0]!;
  const canonicalId = `cashflow.bill_impact.${leader.bill.cardId}.${leader.bill.competenceMonth}`;

  const base = {
    canonicalId,
    title: `Fatura ${leader.bill.cardName} concentra ${formatPercentPtBr(leader.impactPct, 0)} da liquidez`,
    description: `Fatura de ${leader.bill.competenceMonth} em ${formatBRLCents(leader.bill.balanceCents)} representa ${formatPercentPtBr(leader.impactPct, 1)} da liquidez pré-reserva.`,
    badgeLabel: `${formatPercentPtBr(leader.impactPct, 0)} da liquidez`,
    ctaLabel: "Conferir fatura",
    targetRoute: `/cartoes?card=${encodeURIComponent(leader.bill.cardId)}&month=${encodeURIComponent(leader.bill.competenceMonth)}`,
    priority: 2.1,
    severity: "P1_ACTION_NEEDED" as const,
    cycleRelevance: 90,
    tone: "warning" as const,
    domain: "cashflow" as const,
    iconName: "credit-card" as const,
    channels: ["home_carousel", "reminders_page"] as const,
    entityRefs: [
      `bill_impact:${leader.bill.cardId}:${leader.bill.competenceMonth}`,
      `bill:${leader.bill.cardId}:${leader.bill.competenceMonth}`,
    ] as const,
    amountCents: leader.bill.balanceCents,
    dueDate: leader.bill.dueDate,
    breakdown: buildBillImpactBreakdown({
      cardId: leader.bill.cardId,
      cardName: leader.bill.cardName,
      competenceMonth: leader.bill.competenceMonth,
      dueDate: leader.bill.dueDate,
      billBalanceCents: leader.bill.balanceCents,
      safeToSpendCents,
      alreadyDeductedCents: leader.alreadyDeductedCents,
      baseLiquidityCents: leader.baseLiquidityCents,
      impactPct: leader.impactPct,
      thresholdPct,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 4. Ritmo de Orçamento por Categoria (budget.category_pace.{categoryId})
// ---------------------------------------------------------------------------

export interface EvaluateBudgetCategoryPaceParams {
  month: string;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  budgets?: readonly Budget[];
  expenses?: readonly Expense[];
  categories?: readonly Category[];
  excludedExceededCategoryIds?: ReadonlySet<string>;
  deduplicateExceeded?: boolean;
}

export function evaluateBudgetCategoryPaceBridge(
  params: EvaluateBudgetCategoryPaceParams,
): BridgeAlertEvaluation | null {
  const {
    month,
    isCurrentMonth,
    dayOfMonth,
    daysInMonth,
    budgets,
    expenses,
    categories,
    excludedExceededCategoryIds,
    deduplicateExceeded = true,
  } = params;

  if (!isCurrentMonth || !budgets || !expenses || !categories || daysInMonth <= 0) {
    return null;
  }
  if (dayOfMonth <= 0 || dayOfMonth * 100 >= 60 * daysInMonth) {
    return null;
  }

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const limitsMap = budgetLimitsByCategory(budgets);
  const spentMap = spentByCategoryMap(monthExpenses);

  const candidates: Array<{
    category: Category;
    limitCents: number;
    spentCents: number;
    usedPct: number;
  }> = [];

  for (const cat of categories) {
    if (cat.type !== "expense" || cat.is_active === false) continue;
    const limitCents = resolveEffectiveLimit(limitsMap.get(cat.id) ?? [], month);
    if (limitCents <= 0) continue;

    const spentCents = spentMap.get(cat.id) ?? 0;
    if (excludedExceededCategoryIds?.has(cat.id)) continue;
    if (deduplicateExceeded && spentCents > limitCents) continue;
    if (spentCents * 100 < 80 * limitCents) continue;

    candidates.push({
      category: cat,
      limitCents,
      spentCents,
      usedPct: (spentCents / limitCents) * 100,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.usedPct - a.usedPct ||
      b.spentCents - a.spentCents ||
      a.category.id.localeCompare(b.category.id),
  );

  const leader = candidates[0]!;
  const canonicalId = `budget.category_pace.${leader.category.id}`;
  const elapsedPct = (dayOfMonth / daysInMonth) * 100;
  const remainingCents = Math.max(0, leader.limitCents - leader.spentCents);

  const base = {
    canonicalId,
    title: `${leader.category.name} já consumiu ${formatPercentPtBr(leader.usedPct, 0)} do limite`,
    description: `Gasto de ${formatBRLCents(leader.spentCents)} sobre teto de ${formatBRLCents(leader.limitCents)} com ${formatPercentPtBr(elapsedPct, 0)} do mês decorrido.`,
    badgeLabel: `${formatPercentPtBr(leader.usedPct, 0)} usado`,
    ctaLabel: "Ajustar orçamento",
    targetRoute: `/orcamentos?tab=limits&mes=${encodeURIComponent(month)}&categoria=${encodeURIComponent(leader.category.id)}`,
    priority: 2.3,
    severity: "P1_ACTION_NEEDED" as const,
    cycleRelevance: 85,
    tone: "warning" as const,
    domain: "budget_pace" as const,
    iconName: "alert-triangle" as const,
    channels: ["home_carousel", "reminders_page"] as const,
    entityRefs: [`budget_category_pace:${leader.category.id}:${month}`] as const,
    amountCents: leader.spentCents,
    breakdown: buildBudgetCategoryPaceBreakdown({
      categoryId: leader.category.id,
      categoryName: leader.category.name,
      month,
      spentCents: leader.spentCents,
      limitCents: leader.limitCents,
      usedPct: leader.usedPct,
      dayOfMonth,
      daysInMonth,
      elapsedPct,
      remainingCents,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 5. Consistência Mensal de Aportes (bridge.monthly_contribution_consistency)
// ---------------------------------------------------------------------------

const INTERNAL_OR_OPENING_NOTE_RE =
  /marco\s*zero|saldo\s*inicial|movimenta[cç][aã]o\s*interna|transfer[eê]ncia\s*interna/i;

export interface EvaluateMonthlyContributionConsistencyParams {
  month: string;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  allocationIntent: SurplusAllocationIntent;
  suggestedAporteCents: number;
  contributions?: readonly PortfolioContribution[];
  cashflowInvestmentCents?: number;
  hasCombinedContributionBridge?: boolean;
  minDayThreshold?: number;
  minSurplusCents?: number;
}

export function evaluateMonthlyContributionConsistencyBridge(
  params: EvaluateMonthlyContributionConsistencyParams,
): BridgeAlertEvaluation | null {
  const {
    month,
    isCurrentMonth,
    dayOfMonth,
    daysInMonth,
    allocationIntent,
    suggestedAporteCents,
    contributions,
    cashflowInvestmentCents = 0,
    hasCombinedContributionBridge = false,
    minDayThreshold = 22,
    minSurplusCents = 20_000,
  } = params;

  if (!isCurrentMonth || hasCombinedContributionBridge || contributions === undefined) {
    return null;
  }
  if (dayOfMonth < minDayThreshold) return null;
  if (allocationIntent !== "portfolio_aporte" || suggestedAporteCents < minSurplusCents) {
    return null;
  }
  if ((cashflowInvestmentCents ?? 0) > 0) return null;

  let realizedCents = 0;
  for (const contrib of contributions) {
    if (!contrib.date?.startsWith(month)) continue;
    const cents = numberToCents(contrib.amount);
    if (cents <= 0) continue;
    if (contrib.notes && INTERNAL_OR_OPENING_NOTE_RE.test(contrib.notes)) continue;
    realizedCents += cents;
  }

  if (realizedCents > 0) return null;

  const base = {
    canonicalId: "bridge.monthly_contribution_consistency",
    title: "Nenhum aporte registrado neste mês",
    description: `Você já passou do dia ${minDayThreshold} e possui ${formatBRLCents(suggestedAporteCents)} em sobra investível disponível para o aporte mensal.`,
    badgeLabel: `Dia ${dayOfMonth}`,
    ctaLabel: "Simular aporte do mês",
    targetRoute: `/investments?tab=rebalancear&view=simulador&valor=${suggestedAporteCents}`,
    priority: 2.8,
    severity: "P2_ADVISORY" as const,
    cycleRelevance: 76,
    tone: "portfolio" as const,
    domain: "portfolio" as const,
    iconName: "trending-up" as const,
    channels: ["home_carousel", "investments_carousel", "reminders_page"] as const,
    entityRefs: [`bridge:monthly_contribution:${month}`] as const,
    suppressCanonicalIds: ["cashflow.surplus", "cashflow.surplus_aporte"] as const,
    amountCents: suggestedAporteCents,
    breakdown: buildMonthlyContributionConsistencyBreakdown({
      month,
      dayOfMonth,
      daysInMonth,
      suggestedAporteCents,
      realizedContributionsCents: realizedCents,
      minDayThreshold,
      minSurplusCents,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 6. Viagem em Acerto Pendente (trip.settlement_pending.{tripId})
// ---------------------------------------------------------------------------

export interface WarmTripDetailSnapshot {
  trip: Trip;
  members: readonly TripMember[];
  balances: readonly TripMemberBalance[];
  totalExpensesCents: number;
}

export interface EvaluateTripSettlementPendingParams {
  trips?: readonly Trip[];
  warmTripDetailsById?: ReadonlyMap<string, WarmTripDetailSnapshot>;
  currentUserId?: string | null;
  today: string;
}

export function evaluateTripSettlementPendingBridge(
  params: EvaluateTripSettlementPendingParams,
): BridgeAlertEvaluation | null {
  const { trips, warmTripDetailsById, currentUserId, today } = params;
  if (!trips || trips.length === 0 || !warmTripDetailsById || warmTripDetailsById.size === 0) {
    return null;
  }

  const candidates: Array<{
    trip: Trip;
    member: TripMember;
    balance: TripMemberBalance;
    totalExpensesCents: number;
    absBalanceCents: number;
  }> = [];

  for (const trip of trips) {
    const isSettling = trip.status === "settling";
    const isEndedWhileActive = trip.status === "active" && trip.end_date < today;
    if (!isSettling && !isEndedWhileActive) continue;

    const details = warmTripDetailsById.get(trip.id);
    if (!details) continue;

    const myMember = resolveActiveTripMember(
      [...details.members],
      currentUserId,
      trip.host_user_id,
    );
    if (!myMember) continue;

    const myBalance = details.balances.find((b) => b.memberId === myMember.id);
    if (!myBalance || myBalance.netBalanceCents === 0) continue;

    candidates.push({
      trip,
      member: myMember,
      balance: myBalance,
      totalExpensesCents: details.totalExpensesCents,
      absBalanceCents: Math.abs(myBalance.netBalanceCents),
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.absBalanceCents - a.absBalanceCents || a.trip.id.localeCompare(b.trip.id),
  );

  const leader = candidates[0]!;
  const isCreditor = leader.balance.netBalanceCents > 0;
  const canonicalId = `trip.settlement_pending.${leader.trip.id}`;

  const base = {
    canonicalId,
    title: `Acerto pendente em ${leader.trip.title}`,
    description: isCreditor
      ? `Seu saldo residual na viagem é de ${formatBRLCents(leader.absBalanceCents)} a receber.`
      : `Seu saldo residual na viagem é de ${formatBRLCents(leader.absBalanceCents)} a acertar.`,
    badgeLabel: isCreditor ? "A receber" : "Em acerto",
    ctaLabel: "Abrir acerto",
    targetRoute: `/viagens/${encodeURIComponent(leader.trip.id)}?tab=settlements&member=${encodeURIComponent(leader.member.id)}`,
    priority: 2.4,
    severity: "P2_ADVISORY" as const,
    cycleRelevance: 80,
    tone: isCreditor ? ("positive" as const) : ("warning" as const),
    domain: "family" as const,
    iconName: "users" as const,
    channels: ["home_carousel", "reminders_page"] as const,
    entityRefs: [`trip:${leader.trip.id}`] as const,
    amountCents: leader.absBalanceCents,
    breakdown: buildTripSettlementBreakdown(leader.balance, {
      tripTitle: leader.trip.title,
      totalTripExpensesCents: leader.totalExpensesCents,
    }),
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

// ---------------------------------------------------------------------------
// 7. Higiene de Classificação & Recorrências Paradas (data.hygiene_review)
// ---------------------------------------------------------------------------

const PENDING_CATEGORY_NAME_SET = new Set([
  "sem categoria",
  "a classificar",
  "não categorizado",
  "nao categorizado",
]);

export interface StaleRecurrenceCandidate {
  recurrenceId: string;
  name: string;
  lastOccurrenceDate: string;
  daysInactive: number;
  isActive?: boolean;
  isClosed?: boolean;
}

export interface EvaluateDataHygieneReviewParams {
  month: string;
  isCurrentMonth: boolean;
  expenses?: readonly Expense[];
  categories?: readonly Category[];
  staleRecurrences?: readonly StaleRecurrenceCandidate[];
  minPendingCount?: number;
  minStaleDays?: number;
}

export function evaluateDataHygieneReviewBridge(
  params: EvaluateDataHygieneReviewParams,
): BridgeAlertEvaluation | null {
  const {
    month,
    isCurrentMonth,
    expenses,
    categories,
    staleRecurrences = [],
    minPendingCount = 5,
    minStaleDays = 90,
  } = params;

  if (!isCurrentMonth || !expenses || !categories || categories.length === 0) {
    return null;
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const pendingIds: string[] = [];

  for (const exp of expenses) {
    if (!exp.date.startsWith(month)) continue;
    if (exp.is_internal_transfer) continue;

    const rawCatId = typeof exp.category_id === "string" ? exp.category_id.trim() : "";
    if (!rawCatId) {
      pendingIds.push(exp.id);
      continue;
    }

    const cat = categoryMap.get(rawCatId);
    // Somente marca quando a categoria existe no catálogo ativo e representa pendência explícita.
    // Categorias históricas/inativas ausentes no catálogo filtrado NÃO são tratadas como erro.
    if (
      cat &&
      cat.is_active !== false &&
      PENDING_CATEGORY_NAME_SET.has(cat.name.trim().toLowerCase())
    ) {
      pendingIds.push(exp.id);
    }
  }

  if (pendingIds.length >= minPendingCount) {
    const base = {
      canonicalId: "data.hygiene_review",
      title: `${pendingIds.length} lançamentos sem classificação definida`,
      description: `Revise ${pendingIds.length} despesas de ${month} aguardando categoria para manter orçamentos e relatórios precisos.`,
      badgeLabel: `${pendingIds.length} pendentes`,
      ctaLabel: "Revisar lançamentos",
      targetRoute: `/transacoes?mes=${encodeURIComponent(month)}&ids=${encodeURIComponent(pendingIds.join(","))}`,
      priority: 3.4,
      severity: "P3_OPPORTUNITY" as const,
      cycleRelevance: 60,
      tone: "info" as const,
      domain: "cashflow" as const,
      iconName: "sparkles" as const,
      channels: ["home_carousel", "reminders_page"] as const,
      entityRefs: [`data_hygiene:uncategorized:${month}`] as const,
    };

    return {
      ...base,
      hubNotification: toHubNotification(base),
    };
  }

  const activeStale = staleRecurrences.filter(
    (r) =>
      r.isActive !== false &&
      r.isClosed !== true &&
      Number.isFinite(r.daysInactive) &&
      r.daysInactive > minStaleDays,
  );
  if (activeStale.length > 0) {
    const first = activeStale[0]!;
    const base = {
      canonicalId: "data.hygiene_review",
      title:
        activeStale.length === 1
          ? `Recorrência parada: ${first.name}`
          : `${activeStale.length} recorrências sem atividade há > 90 dias`,
      description:
        activeStale.length === 1
          ? `${first.name} não registra lançamento há ${first.daysInactive} dias. Vale confirmar se foi encerrada.`
          : `Há ${activeStale.length} recorrências ativas sem atividade recente para revisar e manter a previsão limpa.`,
      badgeLabel: `${activeStale.length} revisáveis`,
      ctaLabel: "Revisar recorrências",
      targetRoute: "/insights?aba=recurrences",
      priority: 3.7,
      severity: "P3_OPPORTUNITY" as const,
      cycleRelevance: 52,
      tone: "info" as const,
      domain: "cashflow" as const,
      iconName: "sparkles" as const,
      channels: ["home_carousel", "reminders_page"] as const,
      entityRefs: [`data_hygiene:stale_recurrences:${month}`] as const,
    };

    return {
      ...base,
      hubNotification: toHubNotification(base),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 8. Projeções direcionais Carteira <-> Home (cache/host passivos)
// ---------------------------------------------------------------------------

export function evaluatePortfolioCriticalRiskForHome(params: {
  alerts: readonly StructuralRiskAlert[];
}): BridgeAlertEvaluation | null {
  const critical = params.alerts
    .filter((a) => a.tone === "critical" || a.priority <= 1)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0];
  if (!critical) return null;

  const canonicalId = critical.id.startsWith("portfolio.risk.")
    ? critical.id
    : `portfolio.risk.${critical.id}`;

  const base = {
    canonicalId,
    title: critical.title,
    description: critical.description,
    badgeLabel: "Risco na carteira",
    ctaLabel: critical.ctaText || "Ver Posição",
    targetRoute: "/investments?tab=posicao",
    priority: 2.15,
    severity: "P1_ACTION_NEEDED" as const,
    cycleRelevance: 89,
    tone: "critical" as const,
    domain: "portfolio" as const,
    iconName: "shield-alert" as const,
    channels: ["home_carousel"] as const,
    entityRefs: [canonicalId] as const,
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

export function evaluatePortfolioIdleCashForHome(params: {
  brokerageCashBRL?: number | null;
  hasEligibleDeficitTarget?: boolean | null;
  hasCombinedContributionBridge?: boolean;
}): BridgeAlertEvaluation | null {
  const { brokerageCashBRL, hasEligibleDeficitTarget, hasCombinedContributionBridge } = params;
  if (hasCombinedContributionBridge) return null;
  if (typeof brokerageCashBRL !== "number" || !Number.isFinite(brokerageCashBRL) || brokerageCashBRL < 500) {
    return null;
  }
  if (hasEligibleDeficitTarget !== true) return null;

  const cashCents = Math.round(brokerageCashBRL * 100);
  const base = {
    canonicalId: "portfolio.idle_cash",
    title: `${formatBRLCents(cashCents)} parados na corretora`,
    description: `Há saldo em caixa disponível na corretora com classes abaixo da meta pronta para simular.`,
    badgeLabel: "Caixa na corretora",
    ctaLabel: "Simular uso do caixa",
    targetRoute: "/investments?tab=rebalancear&view=simulador&usarCaixa=1",
    priority: 3.1,
    severity: "P3_OPPORTUNITY" as const,
    cycleRelevance: 68,
    tone: "portfolio" as const,
    domain: "portfolio" as const,
    iconName: "wallet" as const,
    channels: ["home_carousel"] as const,
    entityRefs: ["portfolio:idle_cash"] as const,
    amountCents: cashCents,
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

export function evaluatePortfolioDiscountForHome(params: {
  discountInsights?: readonly GovernanceInsight[];
  allocationIntent: SurplusAllocationIntent;
  suggestedAporteCents: number;
}): BridgeAlertEvaluation | null {
  const { discountInsights = [], allocationIntent, suggestedAporteCents } = params;
  if (allocationIntent !== "portfolio_aporte" || suggestedAporteCents <= 0) {
    return null;
  }

  const validDiscount = discountInsights.find(
    (item) =>
      item.kind === "discount_opportunity" &&
      item.ticker &&
      (item.discountPct ?? 0) >= 15,
  );
  if (!validDiscount) return null;

  const base = {
    canonicalId: "portfolio.discount",
    title: validDiscount.title,
    description: validDiscount.description,
    badgeLabel: validDiscount.ticker || "Desconto",
    ctaLabel: "Simular aporte",
    targetRoute: `/investments?tab=rebalancear&view=simulador&valor=${suggestedAporteCents}`,
    priority: 3.3,
    severity: "P3_OPPORTUNITY" as const,
    cycleRelevance: 64,
    tone: "portfolio" as const,
    domain: "portfolio" as const,
    iconName: "trending-up" as const,
    channels: ["home_carousel"] as const,
    entityRefs: [`portfolio:discount:${validDiscount.assetId ?? validDiscount.ticker ?? "top"}`] as const,
    amountCents: suggestedAporteCents,
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

export function evaluateHomeCashGapForInvestments(params: {
  cashGapResult?: CashGapAnalysisResult | null;
  isCurrentMonth: boolean;
}): BridgeAlertEvaluation | null {
  const { cashGapResult, isCurrentMonth } = params;
  if (
    !isCurrentMonth ||
    !cashGapResult ||
    !cashGapResult.isCashGapDetected ||
    cashGapResult.severity !== "critical"
  ) {
    return null;
  }

  const base = {
    canonicalId: "cashflow.cash_gap",
    title: "Furo de caixa previsto antes do aporte",
    description:
      cashGapResult.recommendationMessage ||
      `Saldo diário pode ficar negativo em ${formatBRLCents(cashGapResult.maxDeficitCents)} nos próximos dias. Priorize a liquidez do caixa.`,
    badgeLabel: "Furo crítico",
    ctaLabel: "Ver projeção de caixa",
    targetRoute: "/insights?aba=projection",
    priority: 1,
    severity: "P0_CRITICAL" as const,
    cycleRelevance: 98,
    tone: "critical" as const,
    domain: "cashflow" as const,
    iconName: "alert-triangle" as const,
    channels: ["investments_carousel"] as const,
    entityRefs: ["cashflow:cash_gap"] as const,
    suppressCanonicalIds: [
      "cashflow.surplus",
      "cashflow.surplus_aporte",
      "portfolio.idle_cash",
      "bridge.combined_contribution",
      "bridge.monthly_contribution_consistency",
    ] as const,
    amountCents: cashGapResult.maxDeficitCents,
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}

export function evaluateHomeSurplusForInvestments(params: {
  isCurrentMonth: boolean;
  allocationIntent: SurplusAllocationIntent;
  suggestedAporteCents: number;
  hasCashGapCritical?: boolean;
  hasCombinedContributionBridge?: boolean;
}): BridgeAlertEvaluation | null {
  const {
    isCurrentMonth,
    allocationIntent,
    suggestedAporteCents,
    hasCashGapCritical = false,
    hasCombinedContributionBridge = false,
  } = params;

  if (
    !isCurrentMonth ||
    hasCashGapCritical ||
    hasCombinedContributionBridge ||
    allocationIntent !== "portfolio_aporte" ||
    suggestedAporteCents <= 0
  ) {
    return null;
  }

  const base = {
    canonicalId: "cashflow.surplus",
    title: `${formatBRLCents(suggestedAporteCents)} livres para investir`,
    description: `Sua sobra livre apurada na Visão Geral já pode ser alocada na carteira sem comprometer o mês.`,
    badgeLabel: "Sobra do mês",
    ctaLabel: "Simular este valor",
    targetRoute: `/investments?tab=rebalancear&view=simulador&valor=${suggestedAporteCents}`,
    priority: 3.5,
    severity: "P3_OPPORTUNITY" as const,
    cycleRelevance: 70,
    tone: "positive" as const,
    domain: "cashflow" as const,
    iconName: "trending-up" as const,
    channels: ["investments_carousel"] as const,
    entityRefs: ["cashflow:surplus"] as const,
    amountCents: suggestedAporteCents,
  };

  return {
    ...base,
    hubNotification: toHubNotification(base),
  };
}
