import { describe, expect, it } from "vitest";
import {
  bestDividendMonth,
  calculatePortfolioAverageYoC,
  calculateTotalCostBRL,
  dividendExtractForMonth,
  dividendsByYear,
  dividendsInMonth,
  isDividendType,
  resolveDividendDate,
  resolveDividendNote,
  topDividendPayer,
} from "./dividends";



const txs = [
  { assetId: "a1", type: "dividend", date: "2026-08-10", total: 100 },
  { assetId: "a2", type: "jcp", date: "2026-08-15", total: 75.5 },
  { assetId: "a3", type: "fii_yield", date: "2026-08-20", total: 50.25 },
  { assetId: "a1", type: "dividend", date: "2026-09-05", total: 40 },
  { assetId: "a1", type: "buy", date: "2026-08-12", total: 1000 }, // não é provento
  { assetId: "a2", type: "sell", date: "2026-08-18", total: 500 }, // não é provento
];

describe("dividends — motor puro de proventos (F18)", () => {
  it("isDividendType reconhece apenas dividend/jcp/fii_yield", () => {
    expect(isDividendType("dividend")).toBe(true);
    expect(isDividendType("jcp")).toBe(true);
    expect(isDividendType("fii_yield")).toBe(true);
    expect(isDividendType("buy")).toBe(false);
    expect(isDividendType("sell")).toBe(false);
    expect(isDividendType("split")).toBe(false);
  });

  it("dividendsInMonth soma apenas proventos do mês (reconciliação F17)", () => {
    expect(dividendsInMonth(txs, "2026-08")).toBe(225.75);
    expect(dividendsInMonth(txs, "2026-09")).toBe(40);
    expect(dividendsInMonth(txs, "2026-01")).toBe(0);
  });

  it("dividendExtractForMonth lista proventos do mês com ticker, ordenados por data desc", () => {
    const tickers = new Map([
      ["a1", "PETR4"],
      ["a2", "ITUB4"],
      ["a3", "MXRF11"],
    ]);
    const entries = dividendExtractForMonth(txs, tickers, "2026-08");
    expect(entries).toHaveLength(3);
    // Mais recente primeiro (20/08 → 15/08 → 10/08).
    expect(entries[0]).toMatchObject({ ticker: "MXRF11", total: 50.25 });
    expect(entries[1]).toMatchObject({ ticker: "ITUB4", total: 75.5 });
    expect(entries[2]).toMatchObject({ ticker: "PETR4", total: 100 });
    // Reconciliação: soma do extrato = total do mês.
    const sum = entries.reduce((acc, entry) => acc + entry.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(225.75);
  });

  it("dividendExtractForMonth ignora não-proventos e outros meses", () => {
    const entries = dividendExtractForMonth(txs, new Map([["a1", "PETR4"]]), "2026-08");
    // buy/sell do mês não entram; apenas os 3 proventos.
    expect(entries.some((entry) => entry.ticker === "—" && entry.type === "buy")).toBe(false);
    expect(entries).toHaveLength(3);
  });

  it("ticker desconhecido recebe placeholder —", () => {
    const entries = dividendExtractForMonth(txs, new Map(), "2026-08");
    expect(entries.every((entry) => entry.ticker === "—")).toBe(true);
  });

  it("dividendsByYear devolve os 12 meses do ano com totais (zero quando vazio)", () => {
    const yearly = dividendsByYear(txs, "2026");
    expect(yearly).toHaveLength(12);
    expect(yearly[0]).toEqual({ month: "2026-01", total: 0 });
    expect(yearly[7]).toEqual({ month: "2026-08", total: 225.75 });
    expect(yearly[8]).toEqual({ month: "2026-09", total: 40 });
    // Soma do ano.
    const sum = yearly.reduce((acc, entry) => acc + entry.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(265.75);
  });

  it("dividendsByYear filtra por ano (não mistura meses de outros anos)", () => {
    const txsWithOtherYear = [
      ...txs,
      { assetId: "a1", type: "dividend", date: "2025-12-20", total: 999 },
    ];
    const yearly = dividendsByYear(txsWithOtherYear, "2026");
    const sum = yearly.reduce((acc, entry) => acc + entry.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(265.75);
  });

  describe("resolveDividendDate", () => {
    it("mantém a data exata quando o modo é daily", () => {
      expect(resolveDividendDate("daily", "2026-08-15")).toBe("2026-08-15");
    });

    it("converte competência YYYY-MM para o primeiro dia YYYY-MM-01 no modo monthly", () => {
      expect(resolveDividendDate("monthly", "2026-08")).toBe("2026-08-01");
    });

    it("respeita data já completa se passada no modo monthly", () => {
      expect(resolveDividendDate("monthly", "2026-08-20")).toBe("2026-08-01");
    });
  });

  describe("resolveDividendNote", () => {
    it("inclui tag [MENSAL] no modo monthly", () => {
      const note = resolveDividendNote("monthly", "Rendimento do mês", "dividend");
      expect(note).toContain("[MENSAL]");
      expect(note).toContain("Rendimento do mês");
    });

    it("formata tipo em maiúsculo quando nota de usuário está vazia", () => {
      expect(resolveDividendNote("daily", "", "dividend")).toBe("DIVIDEND");
      expect(resolveDividendNote("monthly", "", "fii_yield")).toBe("[MENSAL] FII_YIELD");
    });
  });

  describe("topDividendPayer", () => {
    it("returns null for empty items", () => {
      expect(topDividendPayer([])).toBeNull();
    });

    it("identifies top payer aggregating items with the same ticker", () => {
      const items = [
        { ticker: "PETR4", amount: 100 },
        { ticker: "ITUB4", amount: 150 },
        { ticker: "PETR4", amount: 80 },
      ];
      expect(topDividendPayer(items)).toEqual({
        ticker: "PETR4",
        amount: 180,
      });
    });
  });

  describe("bestDividendMonth", () => {
    it("returns null for empty or all-zero series", () => {
      expect(bestDividendMonth([])).toBeNull();
      expect(bestDividendMonth([{ month: "2026-01", total: 0 }])).toBeNull();
    });

    it("returns month with highest total", () => {
      const series = [
        { month: "2026-01", total: 100 },
        { month: "2026-02", total: 450 },
        { month: "2026-03", total: 200 },
      ];
      expect(bestDividendMonth(series)).toEqual({ month: "2026-02", total: 450 });
    });
  });

  describe("calculatePortfolioAverageYoC", () => {
    it("returns 0 for empty or invalid yoc list", () => {
      expect(calculatePortfolioAverageYoC([])).toBe(0);
      expect(calculatePortfolioAverageYoC([0, -1])).toBe(0);
    });

    it("calculates average of valid positive YoC values rounded to 1 decimal place", () => {
      expect(calculatePortfolioAverageYoC([8.5, 9.2, 10.1])).toBe(9.3);
    });
  });

  describe("calculateTotalCostBRL", () => {
    it("returns 0 for empty asset list", () => {
      expect(calculateTotalCostBRL([])).toBe(0);
    });

    it("calculates total cost accurately", () => {
      const assets = [
        { quantity: 10, average_price: 25.5 },
        { quantity: 100, average_price: 10.2 },
      ];
      // 10 * 25.5 = 255; 100 * 10.2 = 1020; sum = 1275
      expect(calculateTotalCostBRL(assets)).toBe(1275);
    });
  });
});


