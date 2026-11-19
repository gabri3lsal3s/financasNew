/**
 * Persona Estresse Temporal — Descontinuidades e Colapso de Denominador
 *
 * Módulos: Investimentos, Fluxo de Caixa, Relatórios.
 * Valida a espinha cronológica (mês em branco de agosto/2026),
 * ponderação diária de fluxo intra-mês (Wi) e proteção contra divisão por zero em resgates maciços.
 */

import type { TheoreticalPersona, TemporalStressState } from "./types";

export const personaTemporalStress: TheoreticalPersona<TemporalStressState> = {
  id: "persona-temporal-stress",
  name: "Estresse Temporal & Continuidade de Séries",
  description:
    "Testa ausência de dados em agosto/2026, fluxos com ponderação diária Wi e resgate extremo de 98% para blindagem de TWR/TIR.",
  targetModules: ["portfolio", "projection"],
  instantiate: (): TemporalStressState => {
    const consecutiveMonths = [
      "2026-06",
      "2026-07",
      "2026-08", // Mês vazio / sem transações
      "2026-09",
      "2026-10",
    ] as const;

    return {
      timelineStart: "2026-06-01",
      timelineEnd: "2026-10-31",
      blankMonth: "2026-08",
      consecutiveMonths,
      startingCapitalCents: 5_000_000, // R$ 50.000,00
      intraMonthFlows: [
        {
          date: "2026-06-05",
          amountCents: 500_000, // R$ 5.000,00
          description: "Aporte programado no 5º dia",
          calendarDaysInMonth: 30,
          dayOfMonth: 5,
        },
        {
          date: "2026-06-15",
          amountCents: -200_000, // R$ 2.000,00
          description: "Resgate parcial no meio do mês",
          calendarDaysInMonth: 30,
          dayOfMonth: 15,
        },
        {
          date: "2026-06-25",
          amountCents: 100_000, // R$ 1.000,00
          description: "Aporte residual no 25º dia",
          calendarDaysInMonth: 30,
          dayOfMonth: 25,
        },
      ],
      denominatorCollapse: {
        initialEquityCents: 10_000_000, // R$ 100.000,00
        largeRedemptionCents: 9_800_000, // R$ 98.000,00 (98% de retirada)
        postRedemptionValuationCents: 210_000, // R$ 2.100,00 (ganho de R$ 100 no saldo remanescente)
        epsilonThresholdCents: 100, // R$ 1,00 limiar de precisão
      },
    };
  },
};
