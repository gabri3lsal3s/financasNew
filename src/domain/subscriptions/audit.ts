/**
 * Motor Puro de Auditoria de Assinaturas, Planos Recorrentes e Alerta de Reajustes (§Plano 12).
 *
 * Características de Engenharia:
 *   • Complexidade Linear-Logarítmica O(N log N) determinística (Zero Chamadas a LLMs);
 *   • Filtro Invariante Anti-Falso-Positivo: exclusão estrita de compras parceladas (installments_total > 1);
 *   • Limiar Anti-Câmbio/IOF: reajuste contratual classificado apenas se Δ >= 3% ou Δ >= R$ 3,00 (300 centavos);
 *   • Cálculo de Impacto Anualizado (12 x Δ) e histórico comparativo.
 *
 * 100% puro — sem dependências de UI, DOM ou Supabase.
 */

import { normalizeServiceKey, normalizeText, stripTemporalSuffixes } from "@/domain/insights/shared";

export interface ExpenseForAudit {
  id: string;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  installments_total?: number | null;
  categoryName?: string | null;
  paymentMethod?: string | null;
  creditCardId?: string | null;
}

export interface AuditedSubscriptionHistoryItem {
  id: string;
  date: string;
  amountCents: number;
}

export interface AuditedSubscription {
  serviceKey: string;
  displayName: string;
  categoryName?: string;
  previousCents: number;
  currentCents: number;
  deltaCents: number;
  deltaPercent: number;
  annualizedImpactCents: number;
  hasPriceIncrease: boolean;
  isExchangeFluctuation: boolean;
  lastChargedDate: string;
  history: AuditedSubscriptionHistoryItem[];
  frequency: "monthly" | "yearly";
}

export interface SubscriptionsAuditResult {
  subscriptions: AuditedSubscription[];
  totalMonthlyCents: number;
  totalAnnualizedCents: number;
  increasedSubscriptionsCount: number;
  totalAnnualizedIncreaseCents: number;
}

/**
 * Limpa prefixos de processadoras (PAG*, MP*, IFOOD*, AMZN*), códigos de autorização
 * e caracteres especiais para agrupamento determinístico da assinatura.
 */
export function cleanSubscriptionDescription(desc: string): string {
  if (!desc || !desc.trim()) return "";

  let cleaned = stripTemporalSuffixes(desc);

  // Remove prefixos comuns de adquirentes/gateways
  cleaned = cleaned.replace(/\b(?:pag\*|mp\*|mercadopago\*|ifd\*|amzn\*|dl\*|apple\.com\/bill|google\*)\b/gi, " ");

  // Remove caracteres pontuais de autorização ou números de cartão (ex: *1234, #01)
  cleaned = cleaned.replace(/[*#]\d+/g, " ");

  // Remove números isolados longos (códigos de autorização)
  cleaned = cleaned.replace(/\b\d{4,}\b/g, " ");

  return normalizeText(cleaned);
}

/**
 * Executa a auditoria determinística de assinaturas em tempo O(N log N).
 */
export function auditSubscriptions(expenses: readonly ExpenseForAudit[]): SubscriptionsAuditResult {
  if (!expenses || expenses.length === 0) {
    return {
      subscriptions: [],
      totalMonthlyCents: 0,
      totalAnnualizedCents: 0,
      increasedSubscriptionsCount: 0,
      totalAnnualizedIncreaseCents: 0,
    };
  }

  // 1. Filtro Invariante: descarta parcelamentos (installments_total > 1) e valores zerados/negativos
  const candidates = expenses.filter((e) => {
    if (e.amountCents <= 0) return false;
    if (e.installments_total && e.installments_total > 1) return false;
    return true;
  });

  // 2. Agrupamento por chave normalizada do serviço
  const groups = new Map<string, ExpenseForAudit[]>();

  for (const exp of candidates) {
    const cleaned = cleanSubscriptionDescription(exp.description);
    const key = normalizeServiceKey(cleaned);
    if (!key) continue;

    const list = groups.get(key);
    if (list) {
      list.push(exp);
    } else {
      groups.set(key, [exp]);
    }
  }

  const auditedList: AuditedSubscription[] = [];

  for (const [key, group] of groups.entries()) {
    // Exige ao menos 2 ocorrências para ser classificado como serviço recorrente
    if (group.length < 2) continue;

    // Ordena cronologicamente por data asc
    group.sort((a, b) => a.date.localeCompare(b.date));

    // Agrupa por mês único para evitar duplicidades de cobrança no mesmo mês (estornos, compras pontuais)
    const monthlyMap = new Map<string, ExpenseForAudit>();
    for (const exp of group) {
      const month = exp.date.slice(0, 7);
      monthlyMap.set(month, exp);
    }

    const uniqueMonthExpenses = Array.from(monthlyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    if (uniqueMonthExpenses.length < 2) continue;

    const history: AuditedSubscriptionHistoryItem[] = uniqueMonthExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      amountCents: e.amountCents,
    }));

    const latest = uniqueMonthExpenses[uniqueMonthExpenses.length - 1]!;
    const previous = uniqueMonthExpenses[uniqueMonthExpenses.length - 2]!;

    const currentCents = latest.amountCents;
    const previousCents = previous.amountCents;
    const deltaCents = currentCents - previousCents;
    const deltaPercent =
      previousCents > 0 ? ((currentCents - previousCents) / previousCents) * 100 : 0;

    // Limiar Anti-Câmbio/IOF (QG3):
    // Reajuste real exige aumento (deltaCents > 0) E (deltaPercent >= 3% OU deltaCents >= 300 centavos)
    const isRealIncrease = deltaCents > 0 && (deltaPercent >= 3 || deltaCents >= 300);
    const isExchangeFluctuation = deltaCents > 0 && !isRealIncrease;

    const annualizedImpactCents = isRealIncrease ? deltaCents * 12 : 0;

    // Usa a descrição mais limpa do lançamento mais recente
    const displayName =
      latest.description.trim().length > 0 ? latest.description.trim() : key;

    auditedList.push({
      serviceKey: key,
      displayName,
      categoryName: latest.categoryName ?? undefined,
      previousCents,
      currentCents,
      deltaCents,
      deltaPercent: Number(deltaPercent.toFixed(1)),
      annualizedImpactCents,
      hasPriceIncrease: isRealIncrease,
      isExchangeFluctuation,
      lastChargedDate: latest.date,
      history,
      frequency: "monthly",
    });
  }

  // Ordena por reajuste crítico primeiro, depois por valor atual desc
  auditedList.sort((a, b) => {
    if (a.hasPriceIncrease !== b.hasPriceIncrease) {
      return a.hasPriceIncrease ? -1 : 1;
    }
    return b.currentCents - a.currentCents;
  });

  const totalMonthlyCents = auditedList.reduce((acc, s) => acc + s.currentCents, 0);
  const totalAnnualizedCents = totalMonthlyCents * 12;
  const increased = auditedList.filter((s) => s.hasPriceIncrease);
  const totalAnnualizedIncreaseCents = increased.reduce(
    (acc, s) => acc + s.annualizedImpactCents,
    0,
  );

  return {
    subscriptions: auditedList,
    totalMonthlyCents,
    totalAnnualizedCents,
    increasedSubscriptionsCount: increased.length,
    totalAnnualizedIncreaseCents,
  };
}
