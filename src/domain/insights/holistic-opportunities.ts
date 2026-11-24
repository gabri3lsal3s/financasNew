/**
 * Oportunidades e radares holísticos puros — Fase 2.
 *
 * Conecta sinais de múltiplos cartões, meios de pagamento, parcelas encerrando,
 * juros/dívidas, reserva de emergência e meta de aporte em centavos inteiros.
 *
 * Motor 100% puro: zero dependências de UI, React ou Supabase.
 */

import { numberToCents } from "@/domain/money";
import type { ExpenseLike } from "./recurrences";
import { normalizeText, stripTemporalSuffixes } from "./shared";
import {
  findMatchingServiceKey,
  segmentOf,
  type LearnedServiceDef,
} from "./subscriptions";

export interface CrossMethodDuplicateSubscription {
  key: string;
  name: string;
  count: number;
  totalChargedCents: number;
  estimatedExtraCents: number;
  sourcesLabel: string;
  expenseIds: string[];
}

export interface DetectCrossMethodDuplicatesOptions {
  referenceMonth: string;
  merchantAliasMap?: ReadonlyMap<string, string>;
  learnedServices?: ReadonlyMap<string, LearnedServiceDef>;
}

const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  pix: "Pix",
  debit: "Débito",
  cash: "Dinheiro",
  transfer: "Transferência",
  credit_card: "Cartão de crédito",
  other: "Outro meio",
};

function formatChargeSourceLabel(exp: ExpenseLike): string {
  if (exp.cardName && exp.cardName.trim()) {
    return exp.cardName.trim();
  }
  if (exp.cardId) {
    return `Cartão ${exp.cardId.slice(0, 4)}`;
  }
  const method = exp.paymentMethod ?? "other";
  return PAYMENT_SOURCE_LABELS[method] ?? "Outro meio";
}

function buildSourceIdentityKey(exp: ExpenseLike): string {
  if (exp.cardId) return `card:${exp.cardId}`;
  if (exp.paymentMethod) return `method:${exp.paymentMethod}`;
  return `single:${exp.id}`;
}

function formatDistinctSourcesLabel(sources: readonly string[]): string {
  const unique = Array.from(new Set(sources.filter(Boolean)));
  if (unique.length === 0) return "múltiplos meios";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} e ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} e outros`;
}

/**
 * Detecta assinaturas ativas cobradas em duplicidade no mesmo mês em cartões distintos
 * ou meios de pagamento distintos (ex.: mesmo streaming no Nubank + Itaú, ou Cartão + Pix),
 * mesmo no primeiro mês de histórico do usuário.
 */
export function detectCrossMethodDuplicateSubscriptions(
  expenses: readonly ExpenseLike[],
  options: DetectCrossMethodDuplicatesOptions,
): CrossMethodDuplicateSubscription[] {
  const { referenceMonth, merchantAliasMap, learnedServices } = options;
  if (!referenceMonth) return [];

  const groups = new Map<string, { displayName: string; items: ExpenseLike[] }>();

  for (const exp of expenses) {
    const expMonth = exp.month || (exp.date ? exp.date.slice(0, 7) : "");
    if (expMonth !== referenceMonth) continue;
    if (exp.valueCents <= 0 || exp.installmentGroupId != null) continue;
    if ((exp.sourceRef ?? "").trim().toUpperCase().startsWith("[REFUND]")) continue;

    const rawDesc = (exp.description ?? "").trim();
    if (!rawDesc) continue;

    const cleanedNorm = normalizeText(stripTemporalSuffixes(rawDesc));
    const aliasedKey =
      merchantAliasMap?.get(cleanedNorm) ?? merchantAliasMap?.get(normalizeText(rawDesc));

    const matchedServiceKey =
      findMatchingServiceKey(rawDesc, learnedServices) ??
      (aliasedKey ? findMatchingServiceKey(aliasedKey, learnedServices) : null);

    if (!matchedServiceKey) continue;

    const seg = segmentOf(
      aliasedKey || rawDesc,
      exp.categoryIcon,
      exp.categoryName,
      learnedServices,
    );
    if (seg === "utilities") continue;

    const existing = groups.get(matchedServiceKey);
    const preferredName =
      learnedServices?.get(aliasedKey ?? cleanedNorm)?.canonicalKey
        ? stripTemporalSuffixes(rawDesc)
        : stripTemporalSuffixes(rawDesc) || rawDesc;

    if (!existing) {
      groups.set(matchedServiceKey, {
        displayName: preferredName,
        items: [exp],
      });
    } else {
      existing.items.push(exp);
    }
  }

  const duplicates: CrossMethodDuplicateSubscription[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.items.length < 2) continue;

    const distinctSources = new Set(group.items.map(buildSourceIdentityKey));
    if (distinctSources.size < 2) {
      continue;
    }

    let totalChargedCents = 0;
    let maxSingleCents = 0;
    const sourceLabels: string[] = [];
    const expenseIds: string[] = [];

    for (const item of group.items) {
      totalChargedCents += item.valueCents;
      if (item.valueCents > maxSingleCents) {
        maxSingleCents = item.valueCents;
      }
      sourceLabels.push(formatChargeSourceLabel(item));
      expenseIds.push(item.id);
    }

    const estimatedExtraCents = Math.max(0, totalChargedCents - maxSingleCents);
    if (estimatedExtraCents <= 0) continue;

    duplicates.push({
      key,
      name: group.displayName,
      count: group.items.length,
      totalChargedCents,
      estimatedExtraCents,
      sourcesLabel: formatDistinctSourcesLabel(sourceLabels),
      expenseIds,
    });
  }

  return duplicates.sort((a, b) => b.totalChargedCents - a.totalChargedCents);
}

export interface EndingInstallmentExpenseInput {
  id: string;
  description?: string | null;
  date?: string;
  month?: string;
  bill_competence?: string | null;
  value?: number;
  valueCents?: number;
  report_weight?: number | null;
  installment_group_id?: string | null;
  installmentGroupId?: string | null;
  installment_number?: number;
  installments_total?: number;
  rawExpense?: {
    bill_competence?: string | null;
    installment_group_id?: string | null;
    installment_number?: number;
    installments_total?: number;
    value?: number;
    report_weight?: number | null;
    description?: string | null;
    date?: string;
  };
}

export interface EndingInstallmentItem {
  id: string;
  description: string;
  freedCents: number;
  installmentsTotal: number;
}

export interface EndingInstallmentsReliefResult {
  count: number;
  totalFreedMonthlyCents: number;
  items: EndingInstallmentItem[];
}

/**
 * Calcula o alívio mensal de caixa que será liberado no próximo ciclo quando compras parceladas
 * atingem sua última parcela (`installment_number === installments_total`) no mês de referência.
 */
export function computeEndingInstallmentsRelief(
  expenses: readonly EndingInstallmentExpenseInput[],
  referenceMonth: string,
): EndingInstallmentsReliefResult {
  if (!referenceMonth || expenses.length === 0) {
    return { count: 0, totalFreedMonthlyCents: 0, items: [] };
  }

  const seenGroups = new Set<string>();
  const items: EndingInstallmentItem[] = [];

  for (const exp of expenses) {
    const raw = exp.rawExpense;
    const total = exp.installments_total ?? raw?.installments_total ?? 1;
    const current = exp.installment_number ?? raw?.installment_number ?? 1;
    if (total < 2 || current !== total) continue;

    const competence =
      exp.bill_competence?.slice(0, 7) ||
      raw?.bill_competence?.slice(0, 7) ||
      exp.month ||
      exp.date?.slice(0, 7) ||
      raw?.date?.slice(0, 7) ||
      "";

    if (competence !== referenceMonth) continue;

    const groupKey =
      exp.installment_group_id ?? exp.installmentGroupId ?? raw?.installment_group_id ?? exp.id;
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);

    const freedCents =
      typeof exp.valueCents === "number"
        ? Math.max(0, Math.round(exp.valueCents))
        : numberToCents((exp.value ?? raw?.value ?? 0) * (exp.report_weight ?? raw?.report_weight ?? 1));

    if (freedCents <= 0) continue;

    const description = stripTemporalSuffixes(
      (exp.description ?? raw?.description ?? "Compra parcelada").trim(),
    );

    items.push({
      id: exp.id,
      description: description || "Compra parcelada",
      freedCents,
      installmentsTotal: total,
    });
  }

  const sortedItems = items.sort((a, b) => b.freedCents - a.freedCents);
  const totalFreedMonthlyCents = sortedItems.reduce((acc, item) => acc + item.freedCents, 0);

  return {
    count: sortedItems.length,
    totalFreedMonthlyCents,
    items: sortedItems,
  };
}

export type OptimalSurplusDestination =
  | "none"
  | "settle_high_interest"
  | "emergency_reserve"
  | "portfolio_rebalance";

export interface OptimalSurplusAllocationInput {
  surplusCents: number;
  safeToSpendCents?: number;
  committedObligationsCents?: number;
  highInterestCardChargesCents?: number;
  overdueDebtsCents?: number;
  isEmergencyFundComplete: boolean;
  emergencyGapCents?: number;
  plannedAporteCents?: number;
  averageLearnedAporteCents?: number;
  learnedBrokerName?: string | null;
}

export interface OptimalSurplusAllocationPlan {
  destination: OptimalSurplusDestination;
  allocatableCents: number;
  suggestedAmountCents: number;
  learnedBrokerName: string | null;
}

/**
 * Roteador holístico de sobra mensal:
 * 1) Encargos/juros de cartão ou dívidas vencidas;
 * 2) Lacuna da Reserva de Emergência;
 * 3) Aporte para rebalanceamento da carteira (apoiado pelo histórico de corretora).
 */
export function computeOptimalSurplusAllocation(
  params: OptimalSurplusAllocationInput,
): OptimalSurplusAllocationPlan {
  let allocatableCents = Math.max(0, Math.round(params.surplusCents));

  if (params.committedObligationsCents !== undefined && params.committedObligationsCents > 0) {
    allocatableCents = Math.max(0, allocatableCents - Math.round(params.committedObligationsCents));
  }

  if (params.safeToSpendCents !== undefined) {
    if (params.safeToSpendCents <= 0) {
      allocatableCents = 0;
    } else {
      allocatableCents = Math.min(allocatableCents, Math.round(params.safeToSpendCents));
    }
  }

  const brokerName = params.learnedBrokerName?.trim() || null;

  if (allocatableCents <= 0) {
    return {
      destination: "none",
      allocatableCents: 0,
      suggestedAmountCents: 0,
      learnedBrokerName: brokerName,
    };
  }

  const liabilityPressureCents =
    Math.max(0, Math.round(params.highInterestCardChargesCents ?? 0)) +
    Math.max(0, Math.round(params.overdueDebtsCents ?? 0));

  if (liabilityPressureCents > 0) {
    return {
      destination: "settle_high_interest",
      allocatableCents,
      suggestedAmountCents: Math.min(allocatableCents, liabilityPressureCents),
      learnedBrokerName: brokerName,
    };
  }

  if (!params.isEmergencyFundComplete) {
    const gap =
      params.emergencyGapCents && params.emergencyGapCents > 0
        ? Math.round(params.emergencyGapCents)
        : allocatableCents;
    return {
      destination: "emergency_reserve",
      allocatableCents,
      suggestedAmountCents: Math.min(allocatableCents, gap),
      learnedBrokerName: brokerName,
    };
  }

  const targetAporte =
    params.plannedAporteCents || params.averageLearnedAporteCents || allocatableCents;

  return {
    destination: "portfolio_rebalance",
    allocatableCents,
    suggestedAmountCents: Math.min(allocatableCents, Math.max(0, Math.round(targetAporte))),
    learnedBrokerName: brokerName,
  };
}
