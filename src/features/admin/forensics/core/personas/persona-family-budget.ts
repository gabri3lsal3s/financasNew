/**
 * Persona Família & Orçamentos — Rateio Proporcional e Provisões
 *
 * Módulos: Orçamento Familiar, Provisões / Caixinhas, Fluxo de Caixa.
 * Valida o rateio proporcional de despesas pela renda de cada parceiro (60% / 40%),
 * matriz 50/30/20, acúmulo e consumo de provisões carimbadas (IPVA/IPTU)
 * e envelopes orçamentários sem categorias órfãs.
 */

import type { TheoreticalPersona, FamilyBudgetState } from "./types";

export const personaFamilyBudget: TheoreticalPersona<FamilyBudgetState> = {
  id: "persona-family-budget",
  name: "Orçamento Familiar & Provisões",
  description:
    "Testa divisão proporcional à renda (60/40), regra 50/30/20, provisões carimbadas com 1/12 e envelopes orçamentários.",
  targetModules: ["family", "budgets", "projection"],
  instantiate: (): FamilyBudgetState => {
    const totalIncomeCents = 1_500_000; // R$ 15.000,00

    const partners = [
      {
        id: "partner-a",
        name: "Parceiro A",
        monthlyIncomeCents: 900_000, // R$ 9.000,00 (60%)
        expectedShareRatio: 0.6,
      },
      {
        id: "partner-b",
        name: "Parceiro B",
        monthlyIncomeCents: 600_000, // R$ 6.000,00 (40%)
        expectedShareRatio: 0.4,
      },
    ] as const;

    const sharedExpenses = [
      { id: "exp-moradia", name: "Aluguel & Condomínio", amountCents: 450_000, categoryGroup: "needs" as const },
      { id: "exp-mercado", name: "Supermercado Mensal", amountCents: 200_000, categoryGroup: "needs" as const },
      { id: "exp-lazer", name: "Restaurantes & Lazer", amountCents: 100_000, categoryGroup: "wants" as const },
      { id: "exp-reserva", name: "Poupança Conjunta", amountCents: 50_000, categoryGroup: "savings" as const },
    ] as const;

    const provisions = [
      {
        id: "prov-ipva",
        name: "Provisão IPVA",
        annualTargetCents: 360_000, // R$ 3.600,00
        monthlyAccrualCents: 30_000, // R$ 300,00/mês
        accruedBalanceCents: 330_000, // R$ 3.300,00 acumulados em 11 meses
        consumedCents: 360_000, // Consumo na competência anual
      },
      {
        id: "prov-iptu",
        name: "Provisão IPTU",
        annualTargetCents: 180_000, // R$ 1.800,00
        monthlyAccrualCents: 15_000, // R$ 150,00/mês
        accruedBalanceCents: 165_000,
        consumedCents: 0,
      },
    ] as const;

    const budgetEnvelopes = [
      { categoryId: "cat-needs", name: "Necessidades Básicas", limitCents: 750_000, categoryGroup: "needs" as const },
      { categoryId: "cat-wants", name: "Estilo de Vida & Desejos", limitCents: 450_000, categoryGroup: "wants" as const },
      { categoryId: "cat-savings", name: "Metas & Investimentos", limitCents: 300_000, categoryGroup: "savings" as const },
    ] as const;

    return {
      partners,
      sharedExpenses,
      rule50_30_20: {
        totalIncomeCents,
        targetNeedsCents: 750_000, // 50%
        targetWantsCents: 450_000, // 30%
        targetSavingsCents: 300_000, // 20%
      },
      provisions,
      budgetEnvelopes,
    };
  },
};
