/**
 * Invariantes Matemáticos de Racha de Despesas & Modo Viagem (trips-split-invariants.ts).
 *
 * Assertivas:
 * 1. Conservação Contábil de Soma Zero: soma(net_balance_cents) === 0
 * 2. Min-Cash-Flow Debt Simplification: Acertos sugeridos liquidam integralmente os saldos
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { TripsSplitState } from "../personas/types";
import { calculateMemberBalances, calculateSimplifiedSettlements } from "@/domain/trips/trip-math";

export const assertTripsZeroSum: InvariantAssertion<TripsSplitState> = {
  id: "INV-TRIP-01",
  name: "Conservação Contábil de Soma Zero",
  module: "trips",
  description: "Comprova matematicamente que a soma algébrica dos saldos líquidos de todos os membros é estritamente zero.",
  execute: (state: TripsSplitState) => {
    const balances = calculateMemberBalances(
      state.participants.map((p) => ({ id: p.id, name: p.name, joined_date: p.joinedDate })),
      state.expenses.map((e) => ({
        id: e.id,
        amount_cents: e.amountCents,
        paid_by_member_id: e.paidByMemberId,
        expense_date: e.expenseDate,
        split_type: e.splitType,
        splits: e.splits?.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
      })),
      state.settlements.map((s) => ({
        id: s.id,
        from_member_id: s.fromMemberId,
        to_member_id: s.toMemberId,
        amount_cents: s.amountCents,
        settled_at: s.settledAt,
      })),
    );

    const sumNetBalances = balances.reduce((sum, b) => sum + b.netBalanceCents, 0);
    const passed = sumNetBalances === 0;

    return createAssertionResult({
      id: "INV-TRIP-01",
      name: "Conservação Contábil de Soma Zero",
      module: "trips",
      expected: 0,
      found: sumNetBalances,
      passed,
      origin: "src/domain/trips/trip-math.ts",
    });
  },
};

export const assertMinCashFlowSettlement: InvariantAssertion<TripsSplitState> = {
  id: "INV-TRIP-02",
  name: "Liquidação Ótima Min-Cash-Flow",
  module: "trips",
  description: "Assegura que o algoritmo guloso de simplificação de dívidas gera transferências em número menor ou igual a N-1.",
  execute: (state: TripsSplitState) => {
    const balances = calculateMemberBalances(
      state.participants.map((p) => ({ id: p.id, name: p.name, joined_date: p.joinedDate })),
      state.expenses.map((e) => ({
        id: e.id,
        amount_cents: e.amountCents,
        paid_by_member_id: e.paidByMemberId,
        expense_date: e.expenseDate,
        split_type: e.splitType,
        splits: e.splits?.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
      })),
      state.settlements.map((s) => ({
        id: s.id,
        from_member_id: s.fromMemberId,
        to_member_id: s.toMemberId,
        amount_cents: s.amountCents,
        settled_at: s.settledAt,
      })),
    );

    const settlements = calculateSimplifiedSettlements(balances);
    const maxAllowedTransfers = Math.max(0, state.participants.length - 1);
    const passed = settlements.length <= maxAllowedTransfers;

    return createAssertionResult({
      id: "INV-TRIP-02",
      name: "Liquidação Ótima Min-Cash-Flow",
      module: "trips",
      expected: `<= ${maxAllowedTransfers} transferências`,
      found: `${settlements.length} transferências geradas`,
      passed,
      origin: "src/domain/trips/trip-math.ts",
    });
  },
};

export const tripsSplitInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Modo Viagem & Racha",
  module: "trips",
  assertions: [assertTripsZeroSum, assertMinCashFlowSettlement],
};
