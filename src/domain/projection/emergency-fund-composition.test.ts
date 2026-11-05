import { describe, expect, it } from "vitest";
import {
  detectSuggestedReserveAssets,
  resolveEmergencyFundComposition,
  type PortfolioPositionRowLike,
} from "./emergency-fund";
import type { EmergencyFundConfig } from "@/types";

describe("resolveEmergencyFundComposition — Composição da Reserva de Emergência", () => {
  const MOCK_ROWS: PortfolioPositionRowLike[] = [
    {
      assetId: "asset-selic",
      ticker: "Tesouro Selic 2029",
      assetClass: "Tesouro Direto",
      quantity: 10,
      valueBRL: 14500,
      netValueBRL: 14200,
      isCash: false,
    },
    {
      assetId: "asset-cdb",
      ticker: "CDB 100% CDI Inter",
      assetClass: "Renda Fixa",
      quantity: 1,
      valueBRL: 5000,
      netValueBRL: 4900,
      isCash: false,
    },
    {
      assetId: "asset-ipca",
      ticker: "Tesouro IPCA+ 2045",
      assetClass: "Tesouro Direto",
      quantity: 5,
      valueBRL: 8000,
      netValueBRL: 7800,
      isCash: false,
    },
    {
      assetId: "asset-petr4",
      ticker: "PETR4",
      assetClass: "Ações",
      quantity: 100,
      valueBRL: 3800,
      isCash: false,
    },
    {
      assetId: "asset-caixa",
      ticker: "CAIXA",
      assetClass: "Caixa",
      quantity: 1000,
      valueBRL: 1000,
      isCash: true,
    },
    {
      assetId: "asset-matured",
      ticker: "CDB Banco Maxima Vencido",
      assetClass: "Renda Fixa",
      quantity: 1,
      valueBRL: 2000,
      isMatured: true,
      maturityDate: "2026-01-01",
    },
    {
      assetId: "asset-zero",
      ticker: "CDB Zerado",
      assetClass: "Renda Fixa",
      quantity: 0,
      valueBRL: 0,
    },
  ];

  it("modo auto_cash padrão: inclui saldo em conta e apenas ativos de caixa", () => {
    const res = resolveEmergencyFundComposition({
      realCashCents: 50000, // R$ 500,00
      portfolioRows: MOCK_ROWS,
    });

    // Conta (50000) + CAIXA (1000 * 100 = 100000)
    expect(res.cashInAccountsCents).toBe(50000);
    expect(res.portfolioReserveCents).toBe(100000);
    expect(res.totalReserveCents).toBe(150000); // R$ 1.500,00
    expect(res.breakdown).toHaveLength(2);
    expect(res.warnings).toHaveLength(0);
  });

  it("modo selected_assets: inclui somente os ativos selecionados a dedo pelo usuário", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: true,
      selectionMode: "selected_assets",
      selectedAssetIds: ["asset-selic", "asset-cdb"],
      selectedClasses: [],
      useNetValue: true,
      targetMonths: 6,
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 10000, // R$ 100,00
      portfolioRows: MOCK_ROWS,
    });

    // Saldo em conta (R$ 100) + Selic líquido (R$ 14.200) + CDB líquido (R$ 4.900)
    expect(res.cashInAccountsCents).toBe(10000);
    expect(res.portfolioReserveCents).toBe(1420000 + 490000); // R$ 19.100,00
    expect(res.totalReserveCents).toBe(1920000); // R$ 19.200,00
    expect(res.breakdown).toHaveLength(3);
  });

  it("respeita useNetValue = false (utiliza valor bruto)", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: false,
      selectionMode: "selected_assets",
      selectedAssetIds: ["asset-selic"],
      selectedClasses: [],
      useNetValue: false,
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 10000,
      portfolioRows: MOCK_ROWS,
    });

    expect(res.cashInAccountsCents).toBe(0);
    expect(res.portfolioReserveCents).toBe(1450000); // R$ 14.500 bruto
    expect(res.totalReserveCents).toBe(1450000);
  });

  it("modo selected_classes: inclui todos os ativos da classe 'Tesouro Direto'", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: false,
      selectionMode: "selected_classes",
      selectedAssetIds: [],
      selectedClasses: ["Tesouro Direto"],
      useNetValue: true,
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 0,
      portfolioRows: MOCK_ROWS,
    });

    // asset-selic (1420000) + asset-ipca (780000)
    expect(res.portfolioReserveCents).toBe(1420000 + 780000);
    expect(res.breakdown).toHaveLength(2);

    // Deve emitir aviso de marcação a mercado para o Tesouro IPCA
    const markedWarning = res.warnings.find((w) => w.id === "marked-asset-ipca");
    expect(markedWarning).toBeDefined();
  });

  it("emite aviso de volatilidade quando ação ou fii for selecionado", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: false,
      selectionMode: "selected_assets",
      selectedAssetIds: ["asset-petr4"],
      selectedClasses: [],
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 0,
      portfolioRows: MOCK_ROWS,
    });

    const volatileWarning = res.warnings.find((w) => w.id === "volatile-asset-petr4");
    expect(volatileWarning).toBeDefined();
    expect(volatileWarning?.severity).toBe("warning");
  });

  it("emite aviso de título vencido quando ativo na reserva estiver vencido", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: false,
      selectionMode: "selected_assets",
      selectedAssetIds: ["asset-matured"],
      selectedClasses: [],
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 0,
      portfolioRows: MOCK_ROWS,
    });

    const maturedWarning = res.warnings.find((w) => w.id === "matured-asset-matured");
    expect(maturedWarning).toBeDefined();
    expect(maturedWarning?.severity).toBe("warning");
  });

  it("detectSuggestedReserveAssets identifica ativos típicos de reserva de emergência", () => {
    const suggested = detectSuggestedReserveAssets(MOCK_ROWS);
    // Deve sugerir Selic, CDB (que contém CDI) e CAIXA
    expect(suggested).toContain("asset-selic");
    expect(suggested).toContain("asset-cdb");
    expect(suggested).toContain("asset-caixa");
    // Não deve sugerir ações ou IPCA longo
    expect(suggested).not.toContain("asset-petr4");
    expect(suggested).not.toContain("asset-ipca");
    // Não deve sugerir ativos zerados
    expect(suggested).not.toContain("asset-zero");
  });

  it("calcula targetMonthsProgressPercent com base no custo mensal", () => {
    const config: EmergencyFundConfig = {
      includeCheckingAccounts: true,
      selectionMode: "selected_assets",
      selectedAssetIds: ["asset-selic"], // 14.200
      selectedClasses: [],
      targetMonths: 6,
    };

    const res = resolveEmergencyFundComposition({
      config,
      realCashCents: 80000, // R$ 800 -> Total R$ 15.000
      portfolioRows: MOCK_ROWS,
      monthlyExpensesCents: 300000, // R$ 3.000/mês -> Meta 6m = R$ 18.000
    });

    expect(res.targetMonthsCents).toBe(1800000);
    // 15.000 / 18.000 = 83.33% -> 83%
    expect(res.targetMonthsProgressPercent).toBe(83);
  });
});
