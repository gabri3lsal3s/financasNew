import { describe, expect, it } from "vitest";
import { calculateMonthlyDarf } from "./tax";
import { computeMonthlyDarfReport } from "./darf-reconstitution";
import { calculateReconciledAssetPosition, sellAssetPosition } from "./operations";
import { parseFixedIncomeSellNotes, buildFixedIncomeSellNotes } from "./fixed-income-redemption-preview";
import { calculateTwrSeries } from "./twr";
import { buildPortfolioCashFlows } from "./irr";
import { projectPatrimony } from "./projection";
import { buildCompetenceSummaries, divideIntoInstallments } from "@/domain/cards";
import { calculateBillRefinancePlan } from "@/domain/cards/refinancing";
import { breakdownCycleObligations } from "@/domain/cash/cycle-obligations";
import { calculateRealCashBalance } from "@/domain/cash/cash-ledger";
import { computeConsolidatedBalanceSheet } from "@/domain/reports/consolidated-balance";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("Onda 1 — Vetores Financeiros Críticos (T, I, C, F, R)", () => {
  it("T01: compensa lucro e prejuízo da mesma classe dentro do próprio mês antes da alíquota", () => {
    const res = calculateMonthlyDarf({
      month: "2026-03",
      sales: [
        { ticker: "HGLG11", assetClass: "fiis", currency: "BRL", saleAmountCents: 110000, costAmountCents: 100000, profitCents: 100000 },
        { ticker: "XPML11", assetClass: "fiis", currency: "BRL", saleAmountCents: 20000, costAmountCents: 100000, profitCents: -80000 },
      ],
    });
    expect(res.fiiTaxableProfitCents).toBe(20000);
    expect(res.fiiTaxDueCents).toBe(4000);
    expect(res.remainingAccumulatedLossCents.fiiCents).toBe(0);
  });

  it("T02: reconstituição DARF usa desembolso real (total) incluindo custos operacionais", () => {
    const asset = {
      id: "a1",
      user_id: "u1",
      ticker: "HGLG11",
      asset_class: "fiis",
      currency: "BRL",
      quantity: 0,
      average_price: 0,
    } as PortfolioAsset;
    const txs = [
      { id: "t1", asset_id: "a1", type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1010 },
      { id: "t2", asset_id: "a1", type: "sell", date: "2026-02-10", quantity: 10, price: 110, total: 1100 },
    ] as PortfolioTransaction[];

    const report = computeMonthlyDarfReport({ month: "2026-02", assets: [asset], transactions: txs });
    expect(report.darf.fiiGrossProfitCents).toBe(9000);
    expect(report.darf.fiiTaxDueCents).toBe(1800);
  });

  it("T03: classe explícita ETF vence heurística de sufixo 11 (15% em vez de 20%)", () => {
    const res = calculateMonthlyDarf({
      month: "2026-03",
      sales: [
        { ticker: "ZZZZ11", assetClass: "etf", currency: "BRL", saleAmountCents: 110000, costAmountCents: 100000, profitCents: 100000 },
      ],
    });
    expect(res.etfTaxDueCents).toBe(15000);
    expect(res.fiiTaxDueCents).toBe(0);
  });

  it("T04: venda USD converte custo e alienação para BRL pelo câmbio histórico", () => {
    const asset = {
      id: "usd1",
      user_id: "u1",
      ticker: "AAPL",
      asset_class: "acoes_eua",
      currency: "USD",
      quantity: 0,
      average_price: 0,
    } as PortfolioAsset;
    const txs = [
      { id: "t1", asset_id: "usd1", type: "buy", date: "2026-01-10", quantity: 10, price: 10, total: 100, fx_rate: 5, total_cost_brl: 500 },
      { id: "t2", asset_id: "usd1", type: "sell", date: "2026-02-10", quantity: 10, price: 10, total: 100, fx_rate: 6, total_cost_brl: 500 },
    ] as PortfolioTransaction[];

    const report = computeMonthlyDarfReport({ month: "2026-02", assets: [asset], transactions: txs });
    expect(report.darf.foreignSalesVolumeCents).toBe(60000);
    expect(report.darf.foreignGrossProfitCents).toBe(10000);
  });

  it("I02: excluir venda retroativa reprocessa o ledger cronologicamente", () => {
    const remaining = [
      { id: "b1", date: "2026-01-01", type: "buy" as const, quantity: 10, price: 10, total: 100 },
      { id: "b2", date: "2026-03-01", type: "buy" as const, quantity: 10, price: 30, total: 300 },
    ];
    const res = calculateReconciledAssetPosition({
      currentQuantity: 10,
      currentAveragePrice: 30,
      assetClass: "acoes",
      currency: "BRL",
      isCash: false,
      isTotalValue: false,
      removedTransaction: { type: "sell", quantity: 10, price: 15, total: 150 },
      remainingTransactions: remaining,
    });
    expect(res.newQuantity).toBe(20);
    expect(res.newTotalCost).toBe(400);
    expect(res.newAveragePrice).toBe(20);
  });

  it("I05 e I06: conserva centavos inteiros na venda parcial e não zera saldo em 0.9999", () => {
    const partial = sellAssetPosition({
      currentQuantity: 2,
      currentAveragePrice: 1.125,
      currentTotalCost: 2.25,
      sellQuantity: 1,
      sellPrice: 2,
      assetClass: "acoes",
    });
    expect(partial.costOfSoldQuantity + partial.remainingTotalCost).toBeCloseTo(2.25, 2);

    const fiPartial = sellAssetPosition({
      currentQuantity: 1,
      currentAveragePrice: 900000,
      currentTotalCost: 900000,
      currentGrossBalance: 1000000,
      sellQuantity: 1,
      sellPrice: 999900,
      assetClass: "renda_fixa",
      isTotalValue: true,
    });
    expect(fiPartial.remainingQuantity).toBe(1);
    expect(fiPartial.remainingTotalCost).toBeGreaterThan(0);
  });

  it("I08: parser de notas de Renda Fixa aceita lucro negativo em ambos formatos", () => {
    const built = buildFixedIncomeSellNotes({
      appliedCost: 1000,
      realizedProfit: -10,
      taxAmount: 0,
      taxRatePct: 0,
      netCredit: 990,
    });
    const parsedBuilt = parseFixedIncomeSellNotes(built);
    const parsedAlt = parseFixedIncomeSellNotes(
      "Resgate Renda Fixa | Custo baixado: R$ 1000.00 | Lucro Realizado: R$ -10.00 | IRRF: -R$ 0.00 (0.0%) | Líquido: R$ 990.00",
    );
    expect(parsedBuilt?.realizedProfit).toBe(-10);
    expect(parsedAlt?.realizedProfit).toBe(-10);
  });

  it("C04, C05 e C09: timezone local em paid_at, fim exclusivo do mês e caixa negativo preservado", () => {
    const cash = calculateRealCashBalance({
      incomes: [],
      expenses: [],
      cardPayments: [],
      debts: [
        { id: "d1", name: "Conta", type: "payable", amount: 100, paid_at: "2026-03-10T22:30:00-03:00" },
      ],
      contributions: [],
      referenceDate: "2026-03-10",
    });
    expect(cash.currentBalanceCents).toBe(-10000);

    const oblig = breakdownCycleObligations({
      cards: [],
      cardExpenses: [],
      cardPayments: [],
      debts: [
        { id: "d2", name: "Aluguel Abr", type: "payable", amount: 500, due_date: "2026-04-01", paid_at: null },
      ],
      referenceDate: "2026-03-15",
    });
    expect(oblig.payableDebtsCents).toBe(0);

    const balance = computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: 1000,
      investmentsTotalCostBRL: 1000,
      cashBalanceBRL: -200,
      debts: [],
      monthlyIncomesBRL: 0,
      monthlyExpensesBRL: 0,
      monthlyContributionsBRL: 0,
    });
    expect(balance.netWorthBRL).toBe(800);
  });

  it("F01, F03 e F04: parcelamento 30/01 em 3x, refinanciamento sem juros e ponderação em centavos", () => {
    const inst = divideIntoInstallments({
      totalCents: 30000,
      count: 3,
      startDate: "2026-01-30",
      closingDay: 31,
    });
    expect(inst.map((i) => i.billCompetence)).toEqual(["2026-01", "2026-02", "2026-03"]);

    const refi = calculateBillRefinancePlan({
      remainingBalanceCents: 10000,
      installmentsCount: 3,
      monthlyInterestRatePercent: 0,
      firstCompetenceMonth: "2026-03",
    });
    expect(refi.totalWithInterestCents).toBe(10000);
    expect(refi.installments.reduce((acc, i) => acc + i.amountCents, 0)).toBe(10000);

    const summaries = buildCompetenceSummaries(
      [
        {
          bill_competence: "2026-03",
          value: 0.29,
          report_weight: 0.5,
        },
      ],
      [],
    );
    expect(summaries[0]?.previstoPonderadoCents).toBe(15);
  });

  it("R01, R03 e R11: TWR preserva fluxo 0, XIRR filtra após corte e projeção real reconcilia", () => {
    const twr = calculateTwrSeries([
      { month: "2026-01", totalValueBRL: 1000, totalCostBRL: 1000, netExternalCashFlowBRL: 0 },
      { month: "2026-02", totalValueBRL: 1000, totalCostBRL: 1200, netExternalCashFlowBRL: 0 },
    ]);
    expect(twr.accumulatedRatePct).toBe(0);

    const flows = buildPortfolioCashFlows({
      contributions: [
        { date: "2026-01-01", amount: 100 },
        { date: "2026-12-01", amount: 500 },
      ],
      currentPortfolioValueBRL: 110,
      today: "2026-06-01",
    });
    expect(flows.every((f) => f.date <= "2026-06-01")).toBe(true);

    const proj = projectPatrimony({
      initialCents: 100000,
      monthlyContributionCents: 10000,
      annualRatePercent: 10,
      years: 5,
      basis: "real",
      inflationPercent: 4,
    });
    const last = proj.years[proj.years.length - 1]!;
    expect(last.contributedCents + last.totalInterestCents).toBe(last.balanceCents);
  });
});
