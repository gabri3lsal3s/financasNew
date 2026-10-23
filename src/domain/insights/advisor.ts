/**
 * Motor do Assistente Proativo de Insights (SmartAdvisor) — ESPECIFICAÇÃO & FASE 5.
 *
 * Função pura e determinística responsável por:
 *   1. Mapear anomalias, oportunidades e calibrações em insights estruturados;
 *   2. Ordenar estritamente pela Matriz de Prioridade (1. Crítica -> 2. Entrada -> 3. Economia -> 4. Calibração);
 *   3. Aplicar filtros antirruído de discrição (limite estrito de 1 insight por dia e cooldown de 30 dias por tema).
 */

import { isOccurrenceIgnored, type FeedbackMap } from "./feedback";
import type { ExpenseLike, RecurrenceOccurrence, RecurringIncomeOccurrence } from "./recurrences";
import { formatBRL } from "./recurrences";
import { learnBrokerAportePattern } from "./aporte-learning";
import { detectAnnualCommitments, detectWeeklyCommitments } from "./extended-periodicity";

export type SmartAdvisorCategory = "critical" | "income" | "savings" | "calibration";

export interface SmartAdvisorAction {
  label: string;
  kind: "confirm_income" | "open_income" | "confirm_expense" | "register_expense" | "cut_subscription" | "confirm_recurrence" | "ignore_recurrence" | "navigate_aporte" | "dismiss";
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
  iconName: "alert-triangle" | "arrow-down-left" | "trending-down" | "help-circle" | "trending-up";
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
  /** Poupança (sobra líquida) do ciclo em centavos para sugerir aporte (§Eixo 3). */
  savingsSurplusCents?: number;
  /** Meta mensal de aporte planejada em centavos. */
  plannedAporteCents?: number;
  /** Total de aportes já efetuados no mês vigente em centavos. */
  currentMonthAportesCents?: number;
  /** Histórico completo de despesas para correlação temporal com corretoras (§Eixo 3). */
  allExpenses?: readonly ExpenseLike[];
}

/**
 * Gera todos os candidatos a insights do SmartAdvisor cruzando recorrências, rendas e feedback.
 */
export function generateSmartAdvisorInsights(input: GenerateSmartAdvisorInsightsInput): SmartAdvisorInsight[] {
  const {
    occurrences,
    incomes = [],
    feedbackMap = {},
    todayISO,
    savingsSurplusCents,
    plannedAporteCents,
    currentMonthAportesCents,
    allExpenses = [],
  } = input;
  const candidates: SmartAdvisorInsight[] = [];

  // 1. PRIORIDADE 1: CRÍTICA
  // 1.1 Cobranças duplicadas no mês
  for (const occ of occurrences) {
    if (isOccurrenceIgnored(feedbackMap[`dup:${occ.key}`]) || isOccurrenceIgnored(feedbackMap[occ.key])) {
      continue;
    }

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
    if (occ.missingThisMonth && (occ.tier === "essential" || occ.level === "subscription") && !isOccurrenceIgnored(feedbackMap[occ.key])) {
      const expectedDue =
        occ.nextDueDate ??
        (occ.typicalDayOfMonth
          ? `${todayISO.slice(0, 7)}-${String(occ.typicalDayOfMonth).padStart(2, "0")}`
          : todayISO);

      // Compromissos fixos e assinaturas de alta previsibilidade com conta/cartão já conhecidos e valor constante
      // (ex.: streaming, academia, internet) oferecem confirmação expressa em 1 toque (F27)
      const isHighlyPredictable =
        Boolean(occ.categoryId) &&
        (Boolean(occ.cardId) || Boolean(occ.paymentMethod)) &&
        (occ.level === "subscription" ||
          occ.segment === "streaming" ||
          occ.segment === "fitness" ||
          occ.segment === "cloud_ai" ||
          occ.segment === "telecom");

      const actionKind = isHighlyPredictable ? "confirm_expense" : "register_expense";
      const actionLabel = isHighlyPredictable ? "Confirmar pagamento" : "Registrar pagamento";

      candidates.push({
        id: `missing_expense:${occ.key}`,
        themeKey: `missing_expense:${occ.key}`,
        priority: 1,
        category: "critical",
        title: "Conta pendente no mês",
        description: `${occ.name} costuma ser cobrada por volta do dia ${occ.typicalDayOfMonth ?? 10} e ainda não foi identificada no mês.`,
        iconName: "alert-triangle",
        primaryAction: {
          label: actionLabel,
          kind: actionKind,
          payload: {
            key: occ.key,
            name: occ.name,
            valueCents: occ.averageCents,
            categoryId: occ.categoryId,
            date: expectedDue,
            forma: occ.paymentMethod ?? (occ.cardId ? "credit_card" : "pix"),
            cardId: occ.cardId,
          },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          valueCents: occ.averageCents,
          expectedDate: expectedDue,
          categoryId: occ.categoryId,
        },
      });
    }
  }

  // 1.3 Compromissos anuais e sazonais frequentes com antecedência de até 30 dias (F21)
  if (allExpenses.length > 0) {
    const annualCommitments = detectAnnualCommitments(allExpenses, {
      todayISO,
      feedbackMap,
    });

    for (const commitment of annualCommitments) {
      if (!commitment.isDueSoon || commitment.isAlreadyPaidThisYear) continue;
      if (isOccurrenceIgnored(feedbackMap[commitment.key])) continue;
      if (candidates.some((c) => c.themeKey === commitment.key)) continue;

      candidates.push({
        id: commitment.key,
        themeKey: commitment.key,
        priority: 1,
        category: "critical",
        title: "Compromisso anual previsto",
        description: commitment.alertMessage,
        iconName: "alert-triangle",
        primaryAction: {
          label: "Provisionar pagamento",
          kind: "register_expense",
          payload: {
            name: commitment.name,
            valueCents: commitment.lastValueCents,
            date: commitment.projectedDate,
            categoryId: commitment.categoryId,
          },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          valueCents: commitment.lastValueCents,
          expectedDate: commitment.projectedDate,
          categoryId: commitment.categoryId,
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
      const typicalDay = inc.typicalDayOfMonth ?? 5;
      const description = inc.missingThisMonth
        ? `Renda de ${inc.name} prevista para o dia ${typicalDay} ainda não foi identificada no mês.`
        : inc.profile === "fixed"
          ? `Renda de ${inc.name} (${formatBRL(inc.lastValueCents)}) prevista por volta do dia ${typicalDay}. Deseja confirmar?`
          : `Recebimento habitual de ${inc.name} previsto. Informe o valor recebido neste mês.`;

      if (inc.profile === "fixed") {
        candidates.push({
          id: themeKey,
          themeKey,
          priority: 2,
          category: "income",
          title: "Confirmar recebimento",
          description,
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
          description,
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

  // 3. PRIORIDADE 3: ECONOMIA & APORTES (Reajustes de preço, corte de gastos e rebalanceamento de aportes)
  // 3.1 Oportunidade de aporte e rebalanceamento de carteira (§Eixo 3)
  if (savingsSurplusCents !== undefined && savingsSurplusCents > 0) {
    const brokerPattern = allExpenses.length > 0
      ? learnBrokerAportePattern({ expenses: allExpenses, incomes, todayISO })
      : undefined;

    const alreadyAported =
      (currentMonthAportesCents != null && currentMonthAportesCents > 0) ||
      (brokerPattern?.hasAporteThisMonth ?? false);

    const aporteUnderTarget =
      plannedAporteCents != null &&
      plannedAporteCents > 0 &&
      (currentMonthAportesCents ?? 0) < plannedAporteCents;

    if ((!alreadyAported || aporteUnderTarget) && !isOccurrenceIgnored(feedbackMap["aporte:rebalance"])) {
      const suggestedValueCents =
        plannedAporteCents || brokerPattern?.averageAporteCents || savingsSurplusCents;

      candidates.push({
        id: "aporte:rebalance",
        themeKey: "aporte:rebalance",
        priority: 3,
        category: "savings",
        title: "Aporte para rebalanceamento",
        description: `Você poupou ${formatBRL(savingsSurplusCents)} neste mês. Deseja realizar o aporte planejado para rebalancear sua carteira?`,
        iconName: "trending-down",
        primaryAction: {
          label: "Realizar aporte",
          kind: "navigate_aporte",
          payload: {
            valorCents: suggestedValueCents,
          },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          valueCents: suggestedValueCents,
          annualSavingsCents: savingsSurplusCents,
        },
      });
    }
  }

  for (const occ of occurrences) {
    if (isOccurrenceIgnored(feedbackMap[occ.key])) continue;
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

  // 3.3 Conscientização de compromissos com cadência semanal (F21)
  if (allExpenses.length > 0) {
    const weeklyCommitments = detectWeeklyCommitments(allExpenses, {
      todayISO,
      feedbackMap,
    });

    for (const weekly of weeklyCommitments) {
      if (!weekly.active) continue;
      if (isOccurrenceIgnored(feedbackMap[weekly.key])) continue;
      if (feedbackMap[weekly.key] === "confirm") continue;
      if (candidates.some((c) => c.themeKey === weekly.key)) continue;

      candidates.push({
        id: weekly.key,
        themeKey: weekly.key,
        priority: 3,
        category: "savings",
        title: `Compromisso semanal: ${weekly.name}`,
        description: `Sua despesa semanal com ${weekly.name} (${weekly.dayOfWeekLabel}) totaliza aproximadamente ${formatBRL(weekly.monthlyConsolidatedCents)} por mês.`,
        iconName: "trending-down",
        primaryAction: {
          label: "Ver compromisso",
          kind: "cut_subscription",
          payload: { key: weekly.key, name: weekly.name },
        },
        secondaryAction: {
          label: "Dispensar por 30 dias",
          kind: "dismiss",
        },
        metadata: {
          valueCents: weekly.monthlyConsolidatedCents,
          annualSavingsCents: weekly.monthlyConsolidatedCents * 12,
          categoryId: weekly.categoryId,
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
  /**
   * Se true (padrão: true), insights de prioridade 1 (Críticos) permanecem elegíveis
   * mesmo se o dia estiver marcado como dispensado para itens regulares.
   */
  allowCriticalOnDismissedDay?: boolean;
}

/**
 * Retorna todos os insights elegíveis ordenados estritamente pela Matriz de Prioridade
 * e desempate por valor financeiro, respeitando cooldown de 30 dias e discrição diária.
 */
export function filterAndRankAllAdvisorInsights(
  insights: readonly SmartAdvisorInsight[],
  options: FilterAndRankAdvisorInsightsOptions = {},
): SmartAdvisorInsight[] {
  const {
    dismissals = {},
    lastDismissedDay,
    currentDayISO,
    nowMs = Date.now(),
    allowCriticalOnDismissedDay = true,
  } = options;

  const isDismissedToday = Boolean(
    currentDayISO && lastDismissedDay && currentDayISO === lastDismissedDay,
  );

  // Filtra temas em cooldown de 30 dias
  const eligible = insights.filter((insight) => {
    const dismissedUntil = dismissals[insight.themeKey];
    if (dismissedUntil != null && dismissedUntil > nowMs) {
      return false;
    }

    // Regra de discrição: se já dispensado hoje, apenas alertas críticos (prioridade 1)
    // permanecem ativos (quando allowCriticalOnDismissedDay === true).
    if (isDismissedToday) {
      if (allowCriticalOnDismissedDay && insight.priority === 1) {
        return true;
      }
      return false;
    }

    return true;
  });

  if (eligible.length === 0) {
    return [];
  }

  // Ordena estritamente por prioridade canônica (1 -> 2 -> 3 -> 4)
  return [...eligible].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Desempate por maior valor financeiro envolvido
    const valA = a.metadata?.annualSavingsCents ?? a.metadata?.valueCents ?? 0;
    const valB = b.metadata?.annualSavingsCents ?? b.metadata?.valueCents ?? 0;
    return valB - valA;
  });
}

/**
 * Aplica os filtros de discrição, cooldown de 30 dias por tema e limite diário,
 * retornando o insight mais relevante ou null se tudo estiver regular/silenciado.
 */
export function filterAndRankAdvisorInsights(
  insights: readonly SmartAdvisorInsight[],
  options: FilterAndRankAdvisorInsightsOptions = {},
): SmartAdvisorInsight | null {
  const all = filterAndRankAllAdvisorInsights(insights, options);
  return all[0] ?? null;
}

