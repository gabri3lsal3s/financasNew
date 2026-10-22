/**
 * Motor do Assistente Proativo de Insights (SmartAdvisor) — ESPECIFICAÇÃO & FASE 5.
 *
 * Função pura e determinística responsável por:
 *   1. Mapear anomalias, oportunidades e calibrações em insights estruturados;
 *   2. Ordenar estritamente pela Matriz de Prioridade (1. Crítica -> 2. Entrada -> 3. Economia -> 4. Calibração);
 *   3. Aplicar filtros antirruído de discrição (limite estrito de 1 insight por dia e cooldown de 30 dias por tema).
 */

import type { FeedbackMap } from "./feedback";
import type { RecurrenceOccurrence, RecurringIncomeOccurrence } from "./recurrences";
import { formatBRL } from "./recurrences";

export type SmartAdvisorCategory = "critical" | "income" | "savings" | "calibration";

export interface SmartAdvisorAction {
  label: string;
  kind: "confirm_income" | "open_income" | "cut_subscription" | "confirm_recurrence" | "ignore_recurrence" | "dismiss";
  payload?: Record<string, unknown>;
}

export interface SmartAdvisorInsight {
  /** Identificador único do insight. */
  id: string;
  /** Chave estável do tema para controle de dismiss e feedback (ex: "dup:netflix", "income:salario"). */
  themeKey: string;
  /** Prioridade canônica (1 = Crítica, 2 = Entrada, 3 = Economia, 4 = Calibração). */
  priority: 1 | 2 | 3 | 4;
  /** Categoria do insight. */
  category: SmartAdvisorCategory;
  /** Título conciso e editorial sem emojis. */
  title: string;
  /** Descrição explicativa contextual. */
  description: string;
  /** Nome do ícone representativo lucide-react (tamanho size-4). */
  iconName: "alert-triangle" | "arrow-down-left" | "trending-down" | "help-circle";
  /** Ação primária de 1 toque recomendada. */
  primaryAction?: SmartAdvisorAction;
  /** Ação secundária (ex.: descartar ou discordar). */
  secondaryAction?: SmartAdvisorAction;
  /** Metadados contextuais adicionais. */
  metadata?: {
    valueCents?: number;
    expectedDate?: string;
    annualSavingsCents?: number;
    profile?: "fixed" | "frequent_client";
    duplicateCount?: number;
    percentIncrease?: number;
    categoryId?: string;
  };
}

export const SMART_ADVISOR_DISMISSALS_KEY = "axis_smart_advisor_dismissals";
export const SMART_ADVISOR_LAST_DISMISSED_DAY_KEY = "axis_smart_advisor_last_dismissed_day";
export const DEFAULT_DISMISS_DAYS = 30;

export interface GenerateSmartAdvisorInsightsInput {
  occurrences: readonly RecurrenceOccurrence[];
  incomes?: readonly RecurringIncomeOccurrence[];
  feedbackMap?: FeedbackMap;
  todayISO: string;
}

/**
 * Gera todos os candidatos a insights do SmartAdvisor cruzando recorrências, rendas e feedback.
 */
export function generateSmartAdvisorInsights(input: GenerateSmartAdvisorInsightsInput): SmartAdvisorInsight[] {
  const { occurrences, incomes = [], feedbackMap = {}, todayISO } = input;
  const candidates: SmartAdvisorInsight[] = [];

  // 1. PRIORIDADE 1: CRÍTICA
  // 1.1 Cobranças duplicadas no mês
  for (const occ of occurrences) {
    if (occ.duplicateChargesThisMonth && occ.duplicateChargesThisMonth >= 2) {
      candidates.push({
        id: `dup:${occ.key}`,
        themeKey: `dup:${occ.key}`,
        priority: 1,
        category: "critical",
        title: "Cobrança duplicada detectada",
        description: `Identificamos ${occ.duplicateChargesThisMonth} cobranças de ${occ.name} no mês atual.`,
        iconName: "alert-triangle",
        primaryAction: {
          label: "Ver cobranças",
          kind: "cut_subscription",
          payload: { key: occ.key, name: occ.name },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          duplicateCount: occ.duplicateChargesThisMonth,
          valueCents: occ.averageCents,
        },
      });
    }

    // 1.2 Conta esquecida com risco de juros/atraso
    if (occ.missingThisMonth && (occ.tier === "essential" || occ.level === "subscription")) {
      candidates.push({
        id: `missing_expense:${occ.key}`,
        themeKey: `missing_expense:${occ.key}`,
        priority: 1,
        category: "critical",
        title: "Conta pendente no mês",
        description: `${occ.name} costuma ser cobrada por volta do dia ${occ.typicalDayOfMonth ?? 10} e ainda não foi identificada no mês.`,
        iconName: "alert-triangle",
        primaryAction: {
          label: "Registrar pagamento",
          kind: "open_income",
          payload: { key: occ.key, name: occ.name, valueCents: occ.averageCents },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          valueCents: occ.averageCents,
          expectedDate: occ.nextDueDate,
        },
      });
    }
  }

  // 2. PRIORIDADE 2: ENTRADA (Renda habitual prevista para confirmação em 1 toque)
  for (const inc of incomes) {
    const isReadyForConfirmation =
      inc.missingThisMonth ||
      (inc.daysUntilExpected != null && inc.daysUntilExpected >= -3 && inc.daysUntilExpected <= 3);

    if (isReadyForConfirmation) {
      const themeKey = inc.key.startsWith("income:") ? inc.key : `income:${inc.key}`;
      if (inc.profile === "fixed") {
        candidates.push({
          id: themeKey,
          themeKey,
          priority: 2,
          category: "income",
          title: "Confirmar recebimento",
          description: `Renda de ${inc.name} (${formatBRL(inc.lastValueCents)}) prevista por volta do dia ${inc.typicalDayOfMonth ?? 5}. Deseja confirmar?`,
          iconName: "arrow-down-left",
          primaryAction: {
            label: "Confirmar entrada",
            kind: "confirm_income",
            payload: {
              name: inc.name,
              valueCents: inc.lastValueCents,
              categoryId: inc.categoryId,
              date: inc.expectedDate ?? todayISO,
            },
          },
          secondaryAction: {
            label: "Dispensar por 30 dias",
            kind: "dismiss",
          },
          metadata: {
            valueCents: inc.lastValueCents,
            expectedDate: inc.expectedDate,
            profile: "fixed",
          },
        });
      } else {
        candidates.push({
          id: themeKey,
          themeKey,
          priority: 2,
          category: "income",
          title: "Renda habitual prevista",
          description: `Recebimento habitual de ${inc.name} previsto. Informe o valor recebido neste mês.`,
          iconName: "arrow-down-left",
          primaryAction: {
            label: "Informar valor",
            kind: "open_income",
            payload: {
              name: inc.name,
              categoryId: inc.categoryId,
              date: inc.expectedDate ?? todayISO,
            },
          },
          secondaryAction: {
            label: "Dispensar por 30 dias",
            kind: "dismiss",
          },
          metadata: {
            profile: "frequent_client",
            expectedDate: inc.expectedDate,
          },
        });
      }
    }
  }

  // 3. PRIORIDADE 3: ECONOMIA (Reajustes de preço e oportunidades de corte)
  for (const occ of occurrences) {
    if (feedbackMap[occ.key] === "ignore") continue;
    if (candidates.some((c) => c.themeKey.includes(occ.key))) continue;

    // 3.1 Reajuste de preço detectado
    if (occ.priceAdjustment) {
      candidates.push({
        id: `price_adj:${occ.key}`,
        themeKey: `price_adj:${occ.key}`,
        priority: 3,
        category: "savings",
        title: `Reajuste em ${occ.name}`,
        description: `${occ.name} aumentou ${occ.priceAdjustment.percentIncrease}% (de ${formatBRL(occ.priceAdjustment.oldCents)} para ${formatBRL(occ.priceAdjustment.newCents)}).`,
        iconName: "trending-down",
        primaryAction: {
          label: "Rever assinatura",
          kind: "cut_subscription",
          payload: { key: occ.key, name: occ.name },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          percentIncrease: occ.priceAdjustment.percentIncrease,
          valueCents: occ.priceAdjustment.newCents,
        },
      });
    } else if (occ.tier === "can_cut" || (occ.budgetImpact?.isVampire && occ.tier !== "essential")) {
      // 3.2 Oportunidade de corte de gasto vampiro
      const annualCents = occ.budgetImpact?.annualCostCents ?? occ.averageCents * 12;
      candidates.push({
        id: `savings:${occ.key}`,
        themeKey: `savings:${occ.key}`,
        priority: 3,
        category: "savings",
        title: "Oportunidade de economia",
        description: `${occ.name} custa ${formatBRL(annualCents)} por ano. Deseja manter ou avaliar corte?`,
        iconName: "trending-down",
        primaryAction: {
          label: "Avaliar corte",
          kind: "cut_subscription",
          payload: { key: occ.key, name: occ.name, annualSavingsCents: annualCents },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          annualSavingsCents: annualCents,
          valueCents: occ.averageCents,
        },
      });
    }
  }

  // 4. PRIORIDADE 4: CALIBRAÇÃO (Pergunta simples para ensinar o motor)
  for (const occ of occurrences) {
    // Apenas despesas recorrentes ainda não avaliadas pelo usuário
    if (feedbackMap[occ.key] == null && occ.level === "recurring") {
      const alreadyCovered = candidates.some((c) => c.themeKey.includes(occ.key));
      if (!alreadyCovered) {
        candidates.push({
          id: `calib:${occ.key}`,
          themeKey: `calib:${occ.key}`,
          priority: 4,
          category: "calibration",
          title: "Calibração de gastos fixos",
          description: `Identificamos cobranças mensais de ${formatBRL(occ.averageCents)} em "${occ.name}". Deseja monitorar como gasto fixo?`,
          iconName: "help-circle",
          primaryAction: {
            label: "Sim, monitorar",
            kind: "confirm_recurrence",
            payload: { key: occ.key },
          },
          secondaryAction: {
            label: "Não, foi pontual",
            kind: "ignore_recurrence",
            payload: { key: occ.key },
          },
          metadata: {
            valueCents: occ.averageCents,
          },
        });
      }
    }
  }

  return candidates;
}

export interface FilterAndRankAdvisorInsightsOptions {
  dismissals?: Record<string, number>;
  lastDismissedDay?: string;
  currentDayISO?: string;
  nowMs?: number;
}

/**
 * Aplica os filtros de discrição, cooldown de 30 dias por tema e limite diário (1 insight por dia),
 * retornando o insight mais relevante ou null se tudo estiver regular/silenciado.
 */
export function filterAndRankAdvisorInsights(
  insights: readonly SmartAdvisorInsight[],
  options: FilterAndRankAdvisorInsightsOptions = {},
): SmartAdvisorInsight | null {
  const {
    dismissals = {},
    lastDismissedDay,
    currentDayISO,
    nowMs = Date.now(),
  } = options;

  // Regra de Discrição: Limite estrito de no máximo 1 insight por dia.
  // Se o usuário já dispensou um insight hoje, silenciar o card pelo restante do dia.
  if (currentDayISO && lastDismissedDay && currentDayISO === lastDismissedDay) {
    return null;
  }

  // Filtra temas em cooldown de 30 dias
  const eligible = insights.filter((insight) => {
    const dismissedUntil = dismissals[insight.themeKey];
    if (dismissedUntil != null && dismissedUntil > nowMs) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  // Ordena estritamente por prioridade canônica (1 -> 2 -> 3 -> 4)
  const sorted = [...eligible].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Desempate por maior valor financeiro envolvido
    const valA = a.metadata?.annualSavingsCents ?? a.metadata?.valueCents ?? 0;
    const valB = b.metadata?.annualSavingsCents ?? b.metadata?.valueCents ?? 0;
    return valB - valA;
  });

  return sorted[0] ?? null;
}
