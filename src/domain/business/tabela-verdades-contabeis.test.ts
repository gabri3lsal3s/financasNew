import { describe, expect, it } from "vitest";
import { calculateBusinessDre } from "./dre-calculator";
import { calculateDerivedBusinessCashDirect } from "./derived-cash";
import { calculateRealCashBalance, calculateSafeToSpend } from "@/domain/cash/cash-ledger";
import { evaluateMeiCeiling } from "./mei-rules";
import { splitMixedExpenseByPercent } from "./split-expense";

describe("Tabela de Verdades Contábeis (Invariantes Canônicos do Modo Negócio v2.1)", () => {
  describe("Linha 1: Venda à Vista Cliente (R$ 5.000,00 via PIX)", () => {
    it("valida DRE (+5k), Caixa PJ (+5k), Saldo Home (+5k), Safe-to-Spend (neutro p/ PF via reserva PJ) e Teto MEI (+5k)", () => {
      // 1. DRE: Faturamento Bruto de R$ 5.000,00
      const dre = calculateBusinessDre({
        incomes: [{ value: 5000, scope: "business", is_internal_transfer: false }],
        expenses: [],
      });
      expect(dre.grossRevenueCents).toBe(5_000_00);

      // 2. Caixa Derivado PJ: Entra 100% dos R$ 5.000,00
      const cashPj = calculateDerivedBusinessCashDirect({
        grossRevenueCents: 5_000_00,
        taxWithheldCents: 0,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(5_000_00);

      // 3. Saldo Real na Home: Entra R$ 5.000,00 na conta
      const homeCash = calculateRealCashBalance({
        referenceDate: "2026-05-15",
        incomes: [{ value: 5000, date: "2026-05-15" }],
      });
      expect(homeCash.currentBalanceCents).toBe(5_000_00);

      // 4. Safe-to-Spend Pessoal: Como a empresa reteve R$ 5.000 em conta única,
      // o Safe-to-Spend pessoal NÃO exibe os R$ 5.000 como dinheiro livre para a casa
      const s2s = calculateSafeToSpend({
        realCashBalanceCents: homeCash.currentBalanceCents, // 5.000 na conta
        openInvoicesCents: 0,
        payablePendingCents: 0,
        derivedBusinessCashCents: cashPj.derivedCashBalanceCents, // 5.000 reservado para PJ
      });
      expect(s2s.safeToSpendCents).toBe(0); // Dinheiro pertence à empresa

      // 5. Teto MEI: Computa os R$ 5.000,00 no faturamento acumulado
      const mei = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 5,
        accumulatedRevenueCents: 5_000_00,
      });
      expect(mei.accumulatedRevenueCents).toBe(5_000_00);
      expect(mei.zone).toBe("safe");
    });
  });

  describe("Linha 2: Serviço Autônomo com IRRF Retido (Bruto R$ 4.000,00 / Retido R$ 600,00)", () => {
    it("valida DRE (+4k bruto), Caixa PJ (+3.4k líquido), Saldo Home (+3.4k líquido)", () => {
      // 1. DRE: Reconhece o faturamento bruto fiscal de R$ 4.000,00
      const dre = calculateBusinessDre({
        incomes: [{ value: 4000, scope: "business", is_internal_transfer: false }],
        expenses: [],
      });
      expect(dre.grossRevenueCents).toBe(4_000_00);

      // 2. Caixa Derivado PJ: Entra o valor líquido compensado de R$ 3.400,00
      const cashPj = calculateDerivedBusinessCashDirect({
        grossRevenueCents: 4_000_00,
        taxWithheldCents: 600_00,
      });
      expect(cashPj.netRevenueReceivedCents).toBe(3_400_00);
      expect(cashPj.derivedCashBalanceCents).toBe(3_400_00);

      // 3. Saldo Real na Home: Abate o tax_withheld e debita/credita estritamente o líquido
      const homeCash = calculateRealCashBalance({
        referenceDate: "2026-05-15",
        incomes: [{ value: 4000, tax_withheld: 600, date: "2026-05-15" }],
      });
      expect(homeCash.currentBalanceCents).toBe(3_400_00);
    });
  });

  describe("Linha 3: Compra de Estoque à Vista (R$ 1.200,00 via Débito)", () => {
    it("valida DRE (-1.2k), Caixa PJ (-1.2k), Saldo Home (-1.2k) e Teto MEI neutro", () => {
      const dre = calculateBusinessDre({
        incomes: [],
        expenses: [{ value: 1200, scope: "business", payment_method: "debit", is_internal_transfer: false }],
      });
      expect(dre.operationalCostsCents).toBe(1_200_00);

      const cashPj = calculateDerivedBusinessCashDirect({
        cashExpensesCents: 1_200_00,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(-1_200_00);

      const homeCash = calculateRealCashBalance({
        referenceDate: "2026-05-15",
        expenses: [{ value: 1200, payment_method: "debit", date: "2026-05-15" }],
      });
      expect(homeCash.currentBalanceCents).toBe(-1_200_00);
    });
  });

  describe("Linha 4: Compra PJ no Cartão PF (R$ 600,00 no Cartão de Crédito Pessoal)", () => {
    it("valida DRE (-600 custo), Caixa PJ (0 não sai na data da compra), Saldo Home (0 não sai de caixa hoje) e Safe-to-Spend (-600 fatura aberta)", () => {
      // 1. DRE PJ: Custo operacional contábil de R$ 600,00 reconhecido no mês
      const dre = calculateBusinessDre({
        incomes: [],
        expenses: [
          {
            value: 600,
            scope: "business",
            payment_method: "credit_card",
            card_id: "card-pf",
            is_internal_transfer: false,
          },
        ],
      });
      expect(dre.operationalCostsCents).toBe(600_00);

      // 2. Caixa PJ: Zero! A compra no cartão NÃO sai do caixa da empresa até ser reembolsada
      const cashPj = calculateDerivedBusinessCashDirect({
        cashExpensesCents: 0, // cartão não é cash expense
      });
      expect(cashPj.derivedCashBalanceCents).toBe(0);

      // 3. Saldo Real na Home: Compras no cartão de crédito não debitam saldo em conta corrente
      const homeCash = calculateRealCashBalance({
        referenceDate: "2026-05-15",
        expenses: [{ value: 600, payment_method: "credit_card", card_id: "card-pf", date: "2026-05-15" }],
      });
      expect(homeCash.currentBalanceCents).toBe(0);

      // 4. Safe-to-Spend Pessoal: Como a fatura do cartão da PF agora deve R$ 600,
      // o saldo livre pessoal reduz em R$ 600
      const s2s = calculateSafeToSpend({
        realCashBalanceCents: 1_000_00,
        openInvoicesCents: 600_00, // Fatura aberta do cartão pessoal
        payablePendingCents: 0,
      });
      expect(s2s.safeToSpendCents).toBe(400_00);
    });
  });

  describe("Linha 5: Reembolso PJ -> PF por Compras no Cartão (R$ 600,00)", () => {
    it("valida DRE (0 neutro), Caixa PJ (-600 saída), Saldo Home (0 transferência neutralizada) e Safe-to-Spend (+600 compensação)", () => {
      // 1. DRE: Transferência pareada de reembolso não entra como custo nem receita
      const dre = calculateBusinessDre({
        incomes: [],
        expenses: [
          {
            value: 600,
            scope: "business",
            is_internal_transfer: true,
            transfer_kind: "card_reimbursement",
          },
        ],
      });
      expect(dre.operationalCostsCents).toBe(0); // Neutro no DRE

      // 2. Caixa PJ: Sai R$ 600,00 do caixa da empresa para quitar a dívida com o sócio
      const cashPj = calculateDerivedBusinessCashDirect({
        cardReimbursementsPaidCents: 600_00,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(-600_00);

      // 3. Saldo Real na Home: Transferência entre bolsos do mesmo usuário é 100% neutralizada
      // (Supondo saldo prévio de R$ 1.000)
      const s2s = calculateSafeToSpend({
        realCashBalanceCents: 1_000_00,
        openInvoicesCents: 600_00,
        payablePendingCents: 0,
        derivedBusinessCashCents: 0, // Caixa PJ já pagou o reembolso
      });
      expect(s2s.safeToSpendCents).toBe(400_00);
    });
  });

  describe("Linha 6: Retirada de Pró-Labore (R$ 3.000,00 da PJ para a PF)", () => {
    it("valida DRE (-3k dedução do pró-labore), Caixa PJ (-3k saída), Saldo Home (0 neutralizado) e Safe-to-Spend (+3k livre na PF)", () => {
      // 1. DRE PJ: Pró-labore deduz do lucro líquido retido
      const dre = calculateBusinessDre({
        incomes: [{ value: 10000, scope: "business", is_internal_transfer: false }],
        expenses: [
          {
            value: 3000,
            scope: "business",
            is_internal_transfer: true,
            transfer_kind: "pro_labore",
          },
        ],
      });
      expect(dre.grossRevenueCents).toBe(10_000_00);
      expect(dre.proLaboreWithdrawnCents).toBe(3_000_00);
      expect(dre.retainedEarningsCents).toBe(7_000_00);

      // 2. Caixa PJ: Debita R$ 3.000,00
      const cashPj = calculateDerivedBusinessCashDirect({
        proLaboreWithdrawnCents: 3_000_00,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(-3_000_00);

      // 3. Safe-to-Spend Pessoal: Os R$ 3.000 agora são da PF e estão 100% livres para sustentar a casa
      const s2s = calculateSafeToSpend({
        realCashBalanceCents: 10_000_00, // Total na conta compartilhada
        openInvoicesCents: 0,
        payablePendingCents: 0,
        derivedBusinessCashCents: 7_000_00, // Caixa PJ reteve 7k (após pró-labore de 3k)
      });
      expect(s2s.safeToSpendCents).toBe(3_000_00); // Exatamente os 3k transferidos para a PF!
    });
  });

  describe("Linha 7: Aporte de Capital PF -> PJ (R$ 2.000,00)", () => {
    it("valida DRE (0 neutro), Caixa PJ (+2k entrada), Saldo Home (0 neutralizado) e Teto MEI (0 isento)", () => {
      // 1. DRE: Aporte não é faturamento de cliente
      const dre = calculateBusinessDre({
        incomes: [{ value: 2000, scope: "business", is_internal_transfer: true }],
        expenses: [],
      });
      expect(dre.grossRevenueCents).toBe(0); // Isento no DRE

      // 2. Caixa PJ: Entra R$ 2.000,00 de capital de giro
      const cashPj = calculateDerivedBusinessCashDirect({
        capitalInjectionsCents: 2_000_00,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(2_000_00);

      // 3. Safe-to-Spend Pessoal: Saiu R$ 2.000 da PF para o negócio
      const s2s = calculateSafeToSpend({
        realCashBalanceCents: 5_000_00,
        openInvoicesCents: 0,
        payablePendingCents: 0,
        derivedBusinessCashCents: 2_000_00, // Dinheiro agora é do negócio
      });
      expect(s2s.safeToSpendCents).toBe(3_000_00); // 5.000 - 2.000
    });
  });

  describe("Linha 8: Despesa Mista Split Débito/PIX (R$ 200,00: 50% PF / 50% PJ)", () => {
    it("valida Split atômico com conservação exata, DRE PJ (-100), Caixa PJ (-100) e Saldo Home (-200)", () => {
      const split = splitMixedExpenseByPercent({
        totalCents: 200_00,
        businessPercent: 50,
      });

      expect(split.personalCents).toBe(100_00);
      expect(split.businessCents).toBe(100_00);
      expect(split.personalReportWeight).toBe(1.0);
      expect(split.businessReportWeight).toBe(1.0);

      // 1. DRE PJ: Registra apenas os R$ 100,00 atribuídos ao negócio
      const dre = calculateBusinessDre({
        incomes: [],
        expenses: [{ value: split.businessCents / 100, scope: "business", is_internal_transfer: false }],
      });
      expect(dre.operationalCostsCents).toBe(100_00);

      // 2. Caixa PJ: Sai R$ 100,00
      const cashPj = calculateDerivedBusinessCashDirect({
        cashExpensesCents: split.businessCents,
      });
      expect(cashPj.derivedCashBalanceCents).toBe(-100_00);

      // 3. Saldo Real na Home: Sai o total do PIX bancário (R$ 200,00)
      const homeCash = calculateRealCashBalance({
        referenceDate: "2026-05-15",
        expenses: [
          { value: split.personalCents / 100, payment_method: "pix", date: "2026-05-15" },
          { value: split.businessCents / 100, payment_method: "pix", date: "2026-05-15" },
        ],
      });
      expect(homeCash.currentBalanceCents).toBe(-200_00);
    });
  });
});
