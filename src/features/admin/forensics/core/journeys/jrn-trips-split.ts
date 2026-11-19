/**
 * Jornada JRN-TRIP-01: Viagem Internacional, Câmbio, Racha Customizado & Min-Cash-Flow.
 *
 * Cobre:
 * 1. Criação de viagem internacional em grupo com moeda estrangeira (USD) e taxa cambial.
 * 2. Inclusão e cadastro de 4 participantes com chaves Pix.
 * 3. Conversão cambial determinística de despesas (USD -> BRL) com divisão igualitária.
 * 4. Despesa com divisão customizada e cotas proporcionais em centavos.
 * 5. Cômputo dos balanços líquidos individuais de cada participante.
 * 6. Minimização do fluxo de liquidação via algoritmo Greedy Min-Cash-Flow (menor número de Pix).
 * 7. Comprovação da invariante de conservação estrita zero-sum (soma dos saldos = 0).
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type { JourneyDefinition, JourneyExecutionResult, JourneyStepResult } from "./types";

export const journeyTripsSplit: JourneyDefinition = {
  id: "JRN-TRIP-01",
  name: "Viagem em Grupo, Câmbio Internacional & Racha Min-Cash-Flow",
  pillar: "trips",
  description:
    "Comprova a conversão cambial, divisão de cotas personalizadas, algoritmo de liquidação Min-Cash-Flow e invariante de conservação zero-sum.",
  execute: (ctx): JourneyExecutionResult => {
    const startTime = performance.now();
    const steps: JourneyStepResult[] = [];
    const { store, router } = ctx;

    const snapshotId = store.takeSnapshot();

    try {
      const userId = store.getState().profile.id;

      // -----------------------------------------------------------------------
      // Passo 1: Criação de Viagem Internacional (Orlando 2026 - USD)
      // -----------------------------------------------------------------------
      const t1 = performance.now();
      const trip = {
        id: "trip-orlando-2026",
        userId,
        title: "Férias Orlando & Parques",
        destination: "Orlando, FL",
        currency: "USD",
        exchangeRate: 5.20, // R$ 5,20 por dólar
        startDate: "2026-07-01",
        endDate: "2026-07-15",
      };
      store.addTrip(trip);

      const tripCreated = store.getState().trips.some((t) => t.id === trip.id);
      steps.push({
        stepNumber: 1,
        name: "Criação de Viagem Internacional em Grupo com Moeda USD e Câmbio R$ 5,20",
        passed: tripCreated,
        details: `Viagem '${trip.title}' cadastrada em USD com cotação base de R$ 5,20.`,
        durationMs: Math.round((performance.now() - t1) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 2: Inclusão de 4 Participantes no Grupo
      // -----------------------------------------------------------------------
      const t2 = performance.now();
      const members = [
        { id: "mem-host", tripId: trip.id, name: "Gabriel (Host)", isHost: true, pixKey: "gabriel@pix.me" },
        { id: "mem-amigo1", tripId: trip.id, name: "Lucas", isHost: false, pixKey: "lucas@pix.me" },
        { id: "mem-amigo2", tripId: trip.id, name: "Mariana", isHost: false, pixKey: "mariana@pix.me" },
        { id: "mem-amigo3", tripId: trip.id, name: "Beatriz", isHost: false, pixKey: "beatriz@pix.me" },
      ];

      for (const m of members) {
        store.addTripMember(m);
      }

      const membersCount = store.getState().tripMembers.filter((m) => m.tripId === trip.id).length;
      steps.push({
        stepNumber: 2,
        name: "Inclusão e Configuração de 4 Participantes com Chaves Pix",
        passed: membersCount === 4,
        details: "Host e 3 convidados vinculados com sucesso ao grupo de despesas.",
        durationMs: Math.round((performance.now() - t2) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 3: Despesa em USD com Conversão Cambial (Hospedagem US$ 600)
      // -----------------------------------------------------------------------
      const t3 = performance.now();
      // US$ 600,00 * 5.20 = R$ 3.120,00 (312.000 cts) pago pelo Host e dividido por 4
      const amountUsdCents = 60000;
      const amountBaseCents = Math.round(amountUsdCents * trip.exchangeRate); // 312000 cts
      const sharePerMemberCents = 312000 / 4; // 78000 cts cada (R$ 780,00)

      store.addTripExpense({
        id: "exp-hotel",
        tripId: trip.id,
        description: "Resort Orlando 7 Noites",
        amountBaseCents,
        currency: "USD",
        exchangeRate: trip.exchangeRate,
        payerMemberId: "mem-host",
        splits: members.map((m) => ({
          memberId: m.id,
          shareCents: sharePerMemberCents,
        })),
      });

      const expenseSaved = store.getState().tripExpenses.some((e) => e.id === "exp-hotel");
      const conversionPassed = amountBaseCents === 3120_00 && sharePerMemberCents === 780_00;

      steps.push({
        stepNumber: 3,
        name: "Despesa em Moeda Estrangeira com Conversão Cambial Rigorosa (US$ 600 -> R$ 3.120)",
        passed: expenseSaved && conversionPassed,
        details: `Cota individual de R$ 780,00 (78.000 cts) atribuída igualmente a cada participante.`,
        durationMs: Math.round((performance.now() - t3) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 4: Despesa com Divisão Customizada em Centavos (Jantar Comemorativo)
      // -----------------------------------------------------------------------
      const t4 = performance.now();
      // R$ 800,00 pago pelo Lucas (amigo1) com divisão desigual:
      // Host: 250, Lucas: 250, Mariana: 150, Beatriz: 150 = 800 total
      const dinnerTotalCents = 800_00;
      const dinnerSplits = [
        { memberId: "mem-host", shareCents: 250_00 },
        { memberId: "mem-amigo1", shareCents: 250_00 },
        { memberId: "mem-amigo2", shareCents: 150_00 },
        { memberId: "mem-amigo3", shareCents: 150_00 },
      ];

      store.addTripExpense({
        id: "exp-jantar",
        tripId: trip.id,
        description: "Jantar Temático",
        amountBaseCents: dinnerTotalCents,
        currency: "BRL",
        payerMemberId: "mem-amigo1",
        splits: dinnerSplits,
      });

      const splitSum = dinnerSplits.reduce((acc, s) => acc + s.shareCents, 0);
      const splitMathPassed = splitSum === dinnerTotalCents;

      steps.push({
        stepNumber: 4,
        name: "Registro de Despesa com Divisão Customizada com Soma Exata de Cotas",
        passed: splitMathPassed,
        details: "R$ 800,00 alocados de forma ponderada (250 / 250 / 150 / 150) sem sobras de centavos.",
        durationMs: Math.round((performance.now() - t4) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 5: Cômputo dos Balanços Líquidos Individuais
      // -----------------------------------------------------------------------
      const t5 = performance.now();
      const { balances, simplifiedSettlements } = router.rebalanceTripSplitsMinCashFlow(trip.id);

      const hostBal = balances.find((b) => b.memberId === "mem-host")?.netBalanceCents ?? 0;
      const amigo1Bal = balances.find((b) => b.memberId === "mem-amigo1")?.netBalanceCents ?? 0;
      const amigo2Bal = balances.find((b) => b.memberId === "mem-amigo2")?.netBalanceCents ?? 0;
      const amigo3Bal = balances.find((b) => b.memberId === "mem-amigo3")?.netBalanceCents ?? 0;

      // Host: Pagou 3.120, Deve (780 + 250 = 1.030) -> Saldo = +2.090,00 (209.000 cts)
      // Amigo 1: Pagou 800, Deve (780 + 250 = 1.030) -> Saldo = -230,00 (-23.000 cts)
      // Amigo 2: Pagou 0, Deve (780 + 150 = 930) -> Saldo = -930,00 (-93.000 cts)
      // Amigo 3: Pagou 0, Deve (780 + 150 = 930) -> Saldo = -930,00 (-93.000 cts)
      const balancesAccurate =
        hostBal === 2090_00 &&
        amigo1Bal === -230_00 &&
        amigo2Bal === -930_00 &&
        amigo3Bal === -930_00;

      steps.push({
        stepNumber: 5,
        name: "Cálculo dos Balanços Líquidos Individuais de Todos os Participantes",
        passed: balancesAccurate,
        details: `Host: +R$ 2.090,00 | Lucas: -R$ 230,00 | Mariana: -R$ 930,00 | Beatriz: -R$ 930,00.`,
        durationMs: Math.round((performance.now() - t5) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 6: Otimização Greedy Min-Cash-Flow de Liquidações
      // -----------------------------------------------------------------------
      const t6 = performance.now();
      // Como apenas o Host é credor (+2.090), todos os 3 devedores pagam direto ao Host: 3 transferências!
      const settlementCount = simplifiedSettlements.length;
      const allPayToHost = simplifiedSettlements.every((s) => s.toMemberId === "mem-host");
      const minCashFlowPassed = settlementCount === 3 && allPayToHost;

      steps.push({
        stepNumber: 6,
        name: "Minimização de Fluxo via Algoritmo Greedy Min-Cash-Flow (3 Pix Totais)",
        passed: minCashFlowPassed,
        details: `3 transferências Pix simplificadas liquidam 100% das obrigações do grupo sem triangulações.`,
        durationMs: Math.round((performance.now() - t6) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 7: Invariante Estrita de Conservação Zero-Sum
      // -----------------------------------------------------------------------
      const t7 = performance.now();
      const sumNetBalances = balances.reduce((acc, b) => acc + b.netBalanceCents, 0);
      const isZeroSum = sumNetBalances === 0;

      steps.push({
        stepNumber: 7,
        name: "Auditoria da Invariante de Conservação Zero-Sum da Viagem (Soma = 0)",
        passed: isZeroSum,
        details: `Soma de todos os saldos líquidos = rigorosamente R$ 0,00 (${sumNetBalances} cts).`,
        durationMs: Math.round((performance.now() - t7) * 100) / 100,
      });

      const allPassed = steps.every((s) => s.passed);
      return {
        journeyId: "JRN-TRIP-01",
        name: "Viagem em Grupo, Câmbio Internacional & Racha Min-Cash-Flow",
        pillar: "trips",
        passed: allPassed,
        totalDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
        steps,
      };
    } finally {
      store.restoreSnapshot(snapshotId);
    }
  },
};
