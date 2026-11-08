import { describe, expect, it } from "vitest";
import {
  canCreateActiveGoal,
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "./goal-composition";

describe("canCreateActiveGoal", () => {
  it("permite criar se houver menos de 5 metas ativas", () => {
    expect(canCreateActiveGoal(0)).toBe(true);
    expect(canCreateActiveGoal(1)).toBe(true);
    expect(canCreateActiveGoal(4)).toBe(true);
  });

  it("bloqueia criação ao atingir o teto de 5 metas ativas", () => {
    expect(canCreateActiveGoal(5)).toBe(false);
    expect(canCreateActiveGoal(6)).toBe(false);
  });
});

describe("resolveGoalComposition", () => {
  const sampleAccounts: AccountCompositionItem[] = [
    { id: "acc-1", name: "Nubank", balanceCents: 500000, pendingObligationsCents: 100000 }, // Saldo livre: 400.000
    { id: "acc-2", name: "Itaú", balanceCents: 300000, pendingObligationsCents: 0 }, // Saldo livre: 300.000
  ];

  const sampleAssets: PortfolioAssetCompositionItem[] = [
    {
      id: "asset-1",
      ticker: "LFT 2029",
      assetClass: "Tesouro Direto",
      quantity: 10,
      valueCents: 1500000,
      totalCostCents: 1400000, // Rendimento: 100.000
    },
    {
      id: "asset-2",
      ticker: "PETR4",
      assetClass: "Ações",
      quantity: 100,
      valueCents: 400000,
      totalCostCents: 350000, // Rendimento: 50.000
    },
  ];

  it("retorna zeros quando não há configuração", () => {
    const res = resolveGoalComposition({
      config: null,
      targetCents: 1000000,
    });
    expect(res.currentCents).toBe(0);
    expect(res.progressPercent).toBe(0);
    expect(res.isReached).toBe(false);
  });

  it("calcula corretamente modalidade apenas contas correntes com dedução de pendências", () => {
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: true,
        includeInvestments: false,
        investmentMode: "selected_assets",
      },
      targetCents: 1000000, // R$ 10.000,00
      accounts: sampleAccounts,
    });

    // 400.000 (Nubank) + 300.000 (Itaú) = 700.000
    expect(res.checkingAccountsCents).toBe(700000);
    expect(res.investmentsCents).toBe(0);
    expect(res.currentCents).toBe(700000);
    expect(res.progressPercent).toBe(70);
    expect(res.isReached).toBe(false);
    expect(res.totalDesembolsadoCents).toBe(700000);
    expect(res.totalRendimentosCents).toBe(0);
  });

  it("filtra contas específicas se accountIds estiver configurado", () => {
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: true,
        accountIds: ["acc-1"],
        includeInvestments: false,
        investmentMode: "selected_assets",
      },
      targetCents: 500000,
      accounts: sampleAccounts,
    });

    // Apenas acc-1 = 400.000
    expect(res.checkingAccountsCents).toBe(400000);
    expect(res.currentCents).toBe(400000);
    expect(res.progressPercent).toBe(80);
  });

  it("calcula modalidade apenas investimentos por ativos selecionados com rendimento", () => {
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: false,
        includeInvestments: true,
        investmentMode: "selected_assets",
        assetIds: ["asset-1"],
      },
      targetCents: 2000000, // R$ 20.000,00
      assets: sampleAssets,
    });

    // Apenas asset-1: valueCents = 1.500.000, totalCostCents = 1.400.000
    expect(res.investmentsCents).toBe(1500000);
    expect(res.checkingAccountsCents).toBe(0);
    expect(res.currentCents).toBe(1500000);
    expect(res.totalDesembolsadoCents).toBe(1400000);
    expect(res.totalRendimentosCents).toBe(100000);
    expect(res.progressPercent).toBe(75);
    expect(res.isReached).toBe(false);
  });

  it("calcula modalidade híbrida (contas + investimentos)", () => {
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: true,
        includeInvestments: true,
        investmentMode: "entire_portfolio",
      },
      targetCents: 2500000, // R$ 25.000,00
      accounts: sampleAccounts,
      assets: sampleAssets,
    });

    // Contas: 700.000
    // Investimentos: 1.500.000 + 400.000 = 1.900.000
    // Total bruto: 2.600.000 (atingiu a meta!)
    expect(res.checkingAccountsCents).toBe(700000);
    expect(res.investmentsCents).toBe(1900000);
    expect(res.grossAvailableCents).toBe(2600000);
    expect(res.currentCents).toBe(2600000);
    expect(res.progressPercent).toBe(104);
    expect(res.isReached).toBe(true);

    // Desembolsado: 700.000 (contas) + 1.400.000 + 350.000 = 2.450.000
    expect(res.totalDesembolsadoCents).toBe(2450000);
    // Rendimentos: 2.600.000 - 2.450.000 = 150.000
    expect(res.totalRendimentosCents).toBe(150000);
  });

  it("aplica teto anti-double counting (allocationCapCents)", () => {
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: true,
        includeInvestments: true,
        investmentMode: "entire_portfolio",
        allocationCapCents: 1000000, // Teto de R$ 10.000,00
      },
      targetCents: 2000000,
      accounts: sampleAccounts, // 700.000
      assets: sampleAssets, // 1.900.000
    });

    // Total disponível seria 2.600.000, mas teto limita a 1.000.000
    expect(res.grossAvailableCents).toBe(2600000);
    expect(res.currentCents).toBe(1000000);
    expect(res.isCapApplied).toBe(true);
    expect(res.progressPercent).toBe(50);
    expect(res.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("prevenir dupla contagem")]),
    );
  });

  it("mantém congelada meta conquistada se isCompletedLocked estiver ativo", () => {
    // Simulando mercado em queda após meta já ter sido atingida anteriormente
    const res = resolveGoalComposition({
      config: {
        includeCheckingAccounts: false,
        includeInvestments: true,
        investmentMode: "selected_assets",
        assetIds: ["asset-2"], // 400.000
        isCompletedLocked: true,
      },
      targetCents: 500000, // Meta era 500.000
      assets: sampleAssets,
      previouslyLockedAsCompleted: true,
    });

    expect(res.currentCents).toBe(500000); // Não recuou para 400.000
    expect(res.isReached).toBe(true);
    expect(res.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Meta congelada")]),
    );
  });
});
