/**
 * Persona Insights & SmartAdvisor — Bateria de 100 Eventos Simultâneos
 *
 * Módulos: Insights e Alertas, Cartões de Crédito, Investimentos, Fluxo de Caixa.
 * Valida o motor SmartAdvisor com 100 eventos financeiros simultâneos em memória,
 * supressão de ruído, teto de 1 insight crítico por dia, cooldown de 30 dias em tópicos
 * dispensados e alertas preventivos de limite de fatura (>= 90%) e provisões 1/12.
 */

import type { TheoreticalPersona, InsightsStressState } from "./types";

export const personaInsightsStress: TheoreticalPersona<InsightsStressState> = {
  id: "persona-insights-stress",
  name: "Bateria de Estresse de Insights (100 Eventos)",
  description:
    "Testa 100 eventos simultâneos, ordenação por criticidade, cooldown de 30 dias de dispensas, radar de fatura >= 90% e provisão anual 1/12.",
  targetModules: ["insights", "cards", "portfolio", "projection"],
  instantiate: (): InsightsStressState => {
    const nowMs = 1795046400000; // 2026-11-18T12:00:00.000Z

    // Geração determinística de 100 eventos categorizados
    const severities: readonly ("critical" | "warning" | "info" | "success")[] = [
      "critical",
      "warning",
      "info",
      "success",
    ] as const;

    const events = Array.from({ length: 100 }, (_, i) => {
      const topicIndex = i % 10;
      const severityIndex = i < 15 ? 0 : i < 45 ? 1 : i < 80 ? 2 : 3;
      const topicKey = `topic-advisor-${topicIndex}`;
      const severity = severities[severityIndex] ?? "info";
      return {
        id: `event-advisor-${String(i + 1).padStart(3, "0")}`,
        topicKey,
        severity,
        createdAtIso: `2026-11-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
        message: `Diagnóstico automatizado forense para evento de auditoria #${i + 1}`,
      };
    });

    // Cooldown de 30 dias aplicado a 3 tópicos
    const dismissalCooldowns: Record<string, number> = {
      "topic-advisor-0": nowMs + 15 * 86_400_000, // Expira em 15 dias (ativo)
      "topic-advisor-1": nowMs + 28 * 86_400_000, // Expira em 28 dias (ativo)
      "topic-advisor-2": nowMs - 2 * 86_400_000, // Expirado há 2 dias
    };

    const annualProvisions = [
      {
        id: "annual-ipva",
        label: "IPVA Veicular",
        annualAmountCents: 360_000, // R$ 3.600,00 -> 300,00/mês
        dueMonth: "2027-01",
      },
      {
        id: "annual-iptu",
        label: "IPTU Imóvel",
        annualAmountCents: 180_000, // R$ 1.800,00 -> 150,00/mês
        dueMonth: "2027-02",
      },
    ] as const;

    return {
      totalSimulatedEvents: 100,
      events,
      cardLimitRadar: {
        cardId: "card-black-premium",
        totalLimitCents: 1_000_000, // Limite R$ 10.000,00
        currentInvoiceSpentCents: 850_000, // R$ 8.500,00 já gastos
        projectedSubscriptionsCents: 80_000, // R$ 800,00 previstos
        usagePercent: 93.0, // (8500 + 800) / 10000 = 93% (alerta >= 90%)
      },
      dismissalCooldowns,
      annualProvisions,
      nowMs,
    };
  },
};
