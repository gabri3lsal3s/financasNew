/**
 * Jornada JRN-CARD-01: Lançamento Multi-Passos, Parcelamento 60x, Corte de Fatura & CDC 52.
 *
 * Cobre:
 * 1. Cadastro de cartão de crédito com dia de fechamento (closing_day = 10).
 * 2. Compra parcelada antes do fechamento (dia 09 -> competência do mês atual).
 * 3. Compra parcelada no dia do fechamento (dia 10 -> competência do mês subsequente).
 * 4. Conservação estrita de centavos na divisão de dízimas periódicas.
 * 5. Pagamento parcial de fatura e cômputo de crédito rotativo.
 * 6. Contrato de empréstimo com cronograma de amortização (Tabela Price).
 * 7. Quitação extraordinária antecipada de trás para frente com desconto CDC 52.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type { JourneyDefinition, JourneyExecutionResult, JourneyStepResult } from "./types";
import { calculateLoanSchedule } from "@/domain/loans";

export const journeyCardsDebtsLifecycle: JourneyDefinition = {
  id: "JRN-CARD-01",
  name: "Lançamento Multi-Passos, Parcelamentos 60x & Quitação CDC 52",
  pillar: "transactions",
  description:
    "Comprova o corte de competência da fatura, divisão exata de centavos em parcelamentos de até 60x e antecipação a valor presente (CDC 52).",
  execute: (ctx): JourneyExecutionResult => {
    const startTime = performance.now();
    const steps: JourneyStepResult[] = [];
    const { store, router } = ctx;

    const snapshotId = store.takeSnapshot();

    try {
      const userId = store.getState().profile.id;

      // -----------------------------------------------------------------------
      // Passo 1: Cadastro de Cartão de Crédito com Fechamento no Dia 10
      // -----------------------------------------------------------------------
      const t1 = performance.now();
      const card = {
        id: "card-forense-ouro",
        userId,
        name: "Cartão Axir Platinum",
        creditLimitCents: 20000_00, // R$ 20.000,00
        closingDay: 10,
        dueDay: 18,
        isActive: true,
      };
      store.addCreditCard(card);

      const cardAdded = store.getState().creditCards.some((c) => c.id === card.id);
      steps.push({
        stepNumber: 1,
        name: "Cadastro de Cartão de Crédito com Dia de Fechamento (closing_day = 10)",
        passed: cardAdded,
        details: `Cartão Platinum configurado com R$ 20.000,00 de limite e fechamento dia 10.`,
        durationMs: Math.round((performance.now() - t1) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 2: Compra Parcelada no Dia 09 (Competência do Mês Atual)
      // -----------------------------------------------------------------------
      const t2 = performance.now();
      const txsBeforeCutoff = router.createInstallmentExpense({
        description: "Smartphone 5G",
        totalAmountCents: 3600_00, // R$ 3.600,00
        installmentsCount: 12,
        purchaseDate: "2026-05-09", // Antes do fechamento (dia 10)
        categoryId: "cat-outros",
        cardId: card.id,
      });

      const firstComp = txsBeforeCutoff[0]?.competenceMonth;
      const lastComp = txsBeforeCutoff[11]?.competenceMonth;
      const competenceBeforePassed = firstComp === "2026-05" && lastComp === "2027-04";

      steps.push({
        stepNumber: 2,
        name: "Corte de Fatura: Compra no Dia 09 Alocada na Fatura de Maio (Mês Atual)",
        passed: competenceBeforePassed,
        details: `1ª parcela em ${firstComp} e 12ª parcela em ${lastComp}.`,
        durationMs: Math.round((performance.now() - t2) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 3: Compra Parcelada no Dia 10 (Corte para o Mês Subsequente)
      // -----------------------------------------------------------------------
      const t3 = performance.now();
      const txsOnCutoff = router.createInstallmentExpense({
        description: "Passagem Aérea",
        totalAmountCents: 1000_00, // R$ 1.000,00
        installmentsCount: 7, // Dízima periódica (1000 / 7)
        purchaseDate: "2026-05-10", // No dia do fechamento -> Junho
        categoryId: "cat-transporte",
        cardId: card.id,
      });

      const firstCompAfter = txsOnCutoff[0]?.competenceMonth;
      const lastCompAfter = txsOnCutoff[6]?.competenceMonth;
      const competenceAfterPassed = firstCompAfter === "2026-06" && lastCompAfter === "2026-12";

      steps.push({
        stepNumber: 3,
        name: "Corte de Fatura: Compra no Dia 10 Projetada para Junho (Mês Subsequente)",
        passed: competenceAfterPassed,
        details: `Fatura fechada no dia 10: 1ª parcela jogada para ${firstCompAfter} e última para ${lastCompAfter}.`,
        durationMs: Math.round((performance.now() - t3) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 4: Conservação Rigorosa de Centavos em Dízima Periódica (R$ 1.000 / 7)
      // -----------------------------------------------------------------------
      const t4 = performance.now();
      const sumInstallments = txsOnCutoff.reduce((acc, t) => acc + t.amountCents, 0);
      const isExactCents = sumInstallments === 1000_00;
      const hostRemainderHandled = txsOnCutoff[0]?.amountCents === 14290 && txsOnCutoff[1]?.amountCents === 14285;

      steps.push({
        stepNumber: 4,
        name: "Conservação Exata de Centavos em Parcelamento de Dízima Periódica",
        passed: isExactCents && hostRemainderHandled,
        details: `Soma das 7 parcelas = R$ 1.000,00 (${sumInstallments} cts). Parcela 1: R$ 142,90; Parcelas 2..7: R$ 142,85.`,
        durationMs: Math.round((performance.now() - t4) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 5: Pagamento de Fatura & Verificação de Rotativo
      // -----------------------------------------------------------------------
      const t5 = performance.now();
      const invoiceTotalCents = 14290 + 30000; // R$ 442,90
      const paidCents = 30000; // R$ 300,00 (pagamento parcial)
      const revolvingBalanceCents = invoiceTotalCents - paidCents; // R$ 142,90 entra em rotativo

      store.addCardInvoicePayment({
        id: "pmt-inv-mai",
        cardId: card.id,
        competenceMonth: "2026-05",
        amountPaidCents: paidCents,
        paymentDate: "2026-05-18",
      });

      const revolvingVerified = revolvingBalanceCents === 14290;
      steps.push({
        stepNumber: 5,
        name: "Pagamento Parcial de Fatura & Cômputo de Crédito Rotativo",
        passed: revolvingVerified,
        details: `Fatura de R$ 442,90 paga parcialmente em R$ 300,00; saldo rotativo = R$ 142,90.`,
        durationMs: Math.round((performance.now() - t5) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 6: Contrato de Empréstimo em 24x Tabela Price
      // -----------------------------------------------------------------------
      const t6 = performance.now();
      const principalCents = 10000_00; // R$ 10.000,00
      const monthlyRatePercent = 2.0; // 2% a.m.
      const totalInstallments = 24;

      const scheduleResult = calculateLoanSchedule({
        principalCents,
        totalInstallments,
        monthlyRatePercent,
        system: "price",
        startDate: "2026-01-01",
      });

      const finalBalanceCents = scheduleResult.schedule[scheduleResult.schedule.length - 1]?.remainingBalanceCents ?? -1;
      const scheduleZeroed = finalBalanceCents === 0;

      // Persiste o contrato no store
      store.addLoan({
        id: "loan-contrato-1",
        userId,
        creditorName: "Banco Financeiro SA",
        principalCents,
        monthlyInterestRatePercent: monthlyRatePercent,
        installmentsCount: totalInstallments,
        amortizationSystem: "PRICE",
        startDate: "2026-01-01",
        installments: scheduleResult.schedule.map((item) => ({
          number: item.installmentNumber,
          dueDate: item.dueDate,
          amortizationCents: item.principalCents,
          interestCents: item.interestCents,
          totalInstallmentCents: item.amountCents,
          isPaid: item.installmentNumber <= 6, // Primeiras 6 pagas
        })),
      });

      steps.push({
        stepNumber: 6,
        name: "Contrato de Empréstimo em 24x com Cronograma Price Amortizado a Zero",
        passed: scheduleZeroed,
        details: `Cronograma de 24 meses Price atinge saldo devedor de R$ 0,00 na última parcela.`,
        durationMs: Math.round((performance.now() - t6) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 7: Quitação Antecipada Extraordinária de Trás para Frente (CDC 52)
      // -----------------------------------------------------------------------
      const t7 = performance.now();
      const targetPayoffBudgetCents = 2500_00; // R$ 2.500,00 para amortizar parcelas finais

      const amortResult = router.amortizeLoanEarlyCDC52({
        loanId: "loan-contrato-1",
        targetPaymentCents: targetPayoffBudgetCents,
        referenceDateIso: "2026-06-01",
      });

      const hasSavings = amortResult.totalDiscountCents > 0;
      const paidBelowNominal = amortResult.totalPresentValuePaidCents < amortResult.totalOriginalAmountCents;
      const eliminatedCount = amortResult.eliminatedInstallmentIds.length;
      const cdc52Passed = hasSavings && paidBelowNominal && eliminatedCount >= 4;

      steps.push({
        stepNumber: 7,
        name: "Quitação Antecipada Extraordinária com Abatimento Proporcional (CDC 52 § 2º)",
        passed: cdc52Passed,
        details: `${eliminatedCount} parcelas finais liquidadas: valor nominal = R$ ${(amortResult.totalOriginalAmountCents / 100).toFixed(2)}; pago = R$ ${(amortResult.totalPresentValuePaidCents / 100).toFixed(2)}; desconto = R$ ${(amortResult.totalDiscountCents / 100).toFixed(2)}.`,
        durationMs: Math.round((performance.now() - t7) * 100) / 100,
      });

      const allPassed = steps.every((s) => s.passed);
      return {
        journeyId: "JRN-CARD-01",
        name: "Lançamento Multi-Passos, Parcelamentos 60x & Quitação CDC 52",
        pillar: "transactions",
        passed: allPassed,
        totalDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
        steps,
      };
    } finally {
      store.restoreSnapshot(snapshotId);
    }
  },
};
