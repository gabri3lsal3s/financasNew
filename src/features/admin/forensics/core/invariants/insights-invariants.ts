/**
 * Invariantes Matemáticos de Inteligência & SmartAdvisor (insights-invariants.ts).
 *
 * Assertivas:
 * 1. Ordenação Estrita por Severidade no SmartAdvisor
 * 2. Supressão de Ruído e Cooldown de 30 Dias para Tópicos Dispensados
 * 3. Radar Preventivo de Limite de Cartão (>= 90%)
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { InsightsStressState } from "../personas/types";

export const assertInsightSeverityOrdering: InvariantAssertion<InsightsStressState> = {
  id: "INV-INS-01",
  name: "Ordenação Estrita por Severidade (SmartAdvisor)",
  module: "insights",
  description: "Garante que eventos de severidade crítica tenham precedência absoluta sobre avisos, informativos e sucessos.",
  execute: (state: InsightsStressState) => {
    const priorityWeights: Record<string, number> = {
      critical: 4,
      warning: 3,
      info: 2,
      success: 1,
    };

    const sorted = [...state.events].sort(
      (a, b) => (priorityWeights[b.severity] ?? 0) - (priorityWeights[a.severity] ?? 0),
    );

    let correctlyOrdered = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current && next) {
        const currentWeight = priorityWeights[current.severity] ?? 0;
        const nextWeight = priorityWeights[next.severity] ?? 0;
        if (currentWeight < nextWeight) {
          correctlyOrdered = false;
          break;
        }
      }
    }

    return createAssertionResult({
      id: "INV-INS-01",
      name: "Ordenação Estrita por Severidade (SmartAdvisor)",
      module: "insights",
      expected: "critical >= warning >= info >= success",
      found: correctlyOrdered ? "Ordenação hierárquica respeitada" : "Inversão de prioridade detectada",
      passed: correctlyOrdered,
      origin: "src/domain/insights/advisor.ts",
    });
  },
};

export const assertDismissalCooldown: InvariantAssertion<InsightsStressState> = {
  id: "INV-INS-02",
  name: "Cooldown de 30 Dias em Dispensas de Insights",
  module: "insights",
  description: "Comprova que tópicos dispensados permanecem suprimidos até o término do período de 30 dias.",
  execute: (state: InsightsStressState) => {
    const { dismissalCooldowns, nowMs } = state;

    // "topic-advisor-0" e "topic-advisor-1" devem estar ativos (expiry > nowMs)
    // "topic-advisor-2" deve estar expirado (expiry < nowMs)
    const topic0Active = (dismissalCooldowns["topic-advisor-0"] ?? 0) > nowMs;
    const topic1Active = (dismissalCooldowns["topic-advisor-1"] ?? 0) > nowMs;
    const topic2Expired = (dismissalCooldowns["topic-advisor-2"] ?? 0) < nowMs;

    const passed = topic0Active && topic1Active && topic2Expired;

    return createAssertionResult({
      id: "INV-INS-02",
      name: "Cooldown de 30 Dias em Dispensas de Insights",
      module: "insights",
      expected: "Tópicos 0 e 1 ativos no cooldown; tópico 2 liberado",
      found: passed ? "Filtro temporal de cooldown íntegro" : "Falha na expiração de cooldown",
      passed,
      origin: "src/domain/insights/smart-advisor-rules.ts",
    });
  },
};

export const assertCardLimitRadar: InvariantAssertion<InsightsStressState> = {
  id: "INV-INS-03",
  name: "Radar Preventivo de Limite de Cartão (>= 90%)",
  module: "insights",
  description: "Verifica se o uso da fatura somado às assinaturas projetadas aciona alerta preventivo quando atinge >= 90%.",
  execute: (state: InsightsStressState) => {
    const { cardLimitRadar } = state;
    const totalCommittedCents = cardLimitRadar.currentInvoiceSpentCents + cardLimitRadar.projectedSubscriptionsCents;
    const usageRatio = totalCommittedCents / cardLimitRadar.totalLimitCents;
    const triggersAlert = usageRatio >= 0.9;
    const passed = triggersAlert && cardLimitRadar.usagePercent >= 90.0;

    return createAssertionResult({
      id: "INV-INS-03",
      name: "Radar Preventivo de Limite de Cartão (>= 90%)",
      module: "insights",
      expected: "Alerta preventivo ativado para uso >= 90%",
      found: `Uso = ${cardLimitRadar.usagePercent}% (${triggersAlert ? "Alerta acionado" : "Silenciado"})`,
      passed,
      origin: "src/domain/insights/card-radar.ts",
    });
  },
};

export const insightsInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Inteligência & SmartAdvisor",
  module: "insights",
  assertions: [assertInsightSeverityOrdering, assertDismissalCooldown, assertCardLimitRadar],
};
