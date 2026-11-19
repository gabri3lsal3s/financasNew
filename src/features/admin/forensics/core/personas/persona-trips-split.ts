/**
 * Persona Viagem & Racha de Despesas — Multimoeda e Soma Zero
 *
 * Módulos: Racha de Despesas (Modo Viagem), Fluxo de Caixa.
 * Valida a conservação contábil estrita (soma algébrica dos saldos líquidos = 0 centavos),
 * suporte a múltiplas moedas (BRL, USD, EUR), divisões desiguais e
 * algoritmo de simplificação de dívidas (Min-Cash-Flow via Pix).
 */

import type { TheoreticalPersona, TripsSplitState } from "./types";

export const personaTripsSplit: TheoreticalPersona<TripsSplitState> = {
  id: "persona-trips-split",
  name: "Modo Viagem & Racha de Despesas",
  description:
    "Testa racha com 4 participantes, divisões desiguais, conversão cambial (EUR/USD para BRL), acertos via Pix e invariante de soma zero.",
  targetModules: ["trips", "projection"],
  instantiate: (): TripsSplitState => {
    const participants = [
      { id: "member-alice", name: "Alice", joinedDate: "2026-11-01" },
      { id: "member-bob", name: "Bob", joinedDate: "2026-11-01" },
      { id: "member-carol", name: "Carol", joinedDate: "2026-11-01" },
      { id: "member-david", name: "David", joinedDate: "2026-11-01" },
    ] as const;

    const expenses = [
      // Despesa 1: Hospedagem R$ 1.200,00 paga por Alice, divisão igual (R$ 300,00 cada)
      {
        id: "exp-trip-1",
        description: "Hospedagem Airbnb",
        amountCents: 120_000,
        paidByMemberId: "member-alice",
        expenseDate: "2026-11-02",
        splitType: "equal" as const,
      },
      // Despesa 2: Jantar R$ 450,00 pago por Bob, pesos desiguais (Alice 2x = R$ 180, outros R$ 90)
      {
        id: "exp-trip-2",
        description: "Jantar Típico",
        amountCents: 45_000,
        paidByMemberId: "member-bob",
        expenseDate: "2026-11-03",
        splitType: "custom" as const,
        splits: [
          { memberId: "member-alice", shareCents: 18_000 },
          { memberId: "member-bob", shareCents: 9_000 },
          { memberId: "member-carol", shareCents: 9_000 },
          { memberId: "member-david", shareCents: 9_000 },
        ],
      },
      // Despesa 3: Excursão € 200,00 (PTAX 6,00 = R$ 1.200,00) paga por Carol, David de fora
      {
        id: "exp-trip-3",
        description: "Passeio de Barco (EUR 200)",
        amountCents: 120_000,
        paidByMemberId: "member-carol",
        expenseDate: "2026-11-04",
        splitType: "custom" as const,
        splits: [
          { memberId: "member-alice", shareCents: 40_000 },
          { memberId: "member-bob", shareCents: 40_000 },
          { memberId: "member-carol", shareCents: 40_000 },
        ],
      },
      // Despesa 4: Aluguel de Carro R$ 500,00 pago por David, Alice tem valor fixo R$ 100,00
      {
        id: "exp-trip-4",
        description: "Locação de Veículo",
        amountCents: 50_000,
        paidByMemberId: "member-david",
        expenseDate: "2026-11-05",
        splitType: "custom" as const,
        splits: [
          { memberId: "member-alice", shareCents: 10_000 },
          { memberId: "member-bob", shareCents: 13_334 },
          { memberId: "member-carol", shareCents: 13_333 },
          { memberId: "member-david", shareCents: 13_333 },
        ],
      },
    ] as const;

    const settlements = [
      // Bob faz um acerto parcial de R$ 200,00 para Alice via Pix
      {
        id: "settle-1",
        fromMemberId: "member-bob",
        toMemberId: "member-alice",
        amountCents: 20_000,
        settledAt: "2026-11-06T15:30:00Z",
      },
    ] as const;

    const currencies = [
      { code: "BRL", rateToBRL: 1.0 },
      { code: "USD", rateToBRL: 5.25 },
      { code: "EUR", rateToBRL: 6.0 },
    ] as const;

    return {
      participants,
      expenses,
      settlements,
      currencies,
    };
  },
};
