import { describe, expect, it } from "vitest";
import {
  allocationByClass,
  allocationGap,
  applyOperation,
  computeLedger,
  convertToBRL,
  portfolioMonthlySeries,
  positionPnl,
  valuePosition,
  type LedgerTransaction,
} from "./index";

const tx = (overrides: Partial<LedgerTransaction> & Pick<LedgerTransaction, "type" | "date">): LedgerTransaction => ({
  id: "t",
  quantity: 0,
  price: 0,
  total: 0,
  ...overrides,
});

describe("computeLedger (§3.11.2 — reconciliação)", () => {
  it("compra simples: quantidade, custo total e custo médio", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
    ]);
    expect(result.quantity).toBe(10);
    expect(result.totalCost).toBe(1000);
    expect(result.averageCost).toBe(100);
    expect(result.cash).toBe(-1000); // compra debita do caixa derivado
  });

  it("duas compras → custo médio ponderado", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
      tx({ type: "buy", date: "2026-02-10", quantity: 10, price: 120, total: 1200 }),
    ]);
    expect(result.quantity).toBe(20);
    expect(result.totalCost).toBe(2200);
    expect(result.averageCost).toBe(110);
    expect(result.cash).toBe(-2200);
  });

  it("venda reduz proporcionalmente o custo (custo médio preservado)", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
      tx({ type: "buy", date: "2026-02-10", quantity: 10, price: 120, total: 1200 }),
      tx({ type: "sell", date: "2026-03-10", quantity: 5, price: 130, total: 650 }),
    ]);
    // Vendeu 5 × custo médio 110 = 550 de custo; restam 15 × 110 = 1650.
    expect(result.quantity).toBe(15);
    expect(result.totalCost).toBe(1650);
    expect(result.averageCost).toBe(110);
    expect(result.cash).toBe(-2200 + 650); // venda credita
  });

  it("proventos não alteram custo nem posição", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
      tx({ type: "dividend", date: "2026-04-10", quantity: 0, price: 0, total: 150 }),
      tx({ type: "jcp", date: "2026-05-10", quantity: 0, price: 0, total: 20 }),
    ]);
    expect(result.quantity).toBe(10);
    expect(result.totalCost).toBe(1000);
    expect(result.averageCost).toBe(100);
    expect(result.dividends).toBe(170); // acumula separadamente
    expect(result.cash).toBe(-1000 + 170); // proventos creditam no caixa
  });

  it("split soma cotas preservando custo total", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
      tx({ type: "split", date: "2026-06-01", quantity: 2, price: 50, total: 0 }),
    ]);
    expect(result.quantity).toBe(20); // 10 × 2
    expect(result.totalCost).toBe(1000);
    expect(result.averageCost).toBe(50);
    expect(result.cash).toBe(-1000); // split não movimenta caixa
  });

  it("reverse split subtrai cotas preservando custo total", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 20, price: 50, total: 1000 }),
      tx({ type: "reverse_split", date: "2026-06-01", quantity: 2, price: 100, total: 0 }),
    ]);
    expect(result.quantity).toBe(10); // 20 ÷ 2
    expect(result.totalCost).toBe(1000);
    expect(result.averageCost).toBe(100);
  });

  it("subscrição debita do caixa e soma à posição", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 5, price: 100, total: 500 }),
      tx({ type: "subscription", date: "2026-07-01", quantity: 3, price: 90, total: 270 }),
    ]);
    expect(result.quantity).toBe(8);
    expect(result.totalCost).toBe(770);
    expect(result.cash).toBe(-770);
  });

  it("ordena por data mesmo com entrada fora de ordem", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-02-10", quantity: 10, price: 120, total: 1200 }),
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
    ]);
    expect(result.averageCost).toBe(110); // compras fora de ordem → mesmo resultado
    expect(result.quantity).toBe(20);
  });

  it("venda maior que a posição não gera quantidade negativa", () => {
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 5, price: 100, total: 500 }),
      tx({ type: "sell", date: "2026-03-10", quantity: 10, price: 110, total: 1100 }),
    ]);
    expect(result.quantity).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.averageCost).toBe(0);
  });

  it("ledger vazio → posição zerada", () => {
    expect(computeLedger([])).toEqual({ quantity: 0, averageCost: 0, totalCost: 0, dividends: 0, cash: 0 });
  });
});

describe("valor e gap de alocação (§3.11.2)", () => {
  it("valuePosition = quantidade × preço", () => {
    expect(valuePosition({ quantity: 10 }, 120.5)).toBe(1205);
  });

  it("allocationGap calcula pctAtual, gapPct e gap financeiro", () => {
    const gap = allocationGap(20_000, 30, 100_000);
    expect(gap.pctAtual).toBe(20);
    expect(gap.gapPct).toBe(10);
    expect(gap.gapFinanceiroCents).toBe(10_000);
  });

  it("allocationGap com patrimônio zero → pctAtual 0", () => {
    expect(allocationGap(0, 30, 0)).toEqual({ pctAtual: 0, gapPct: 30, gapFinanceiroCents: 0 });
  });

  it("convertToBRL: USD usa a cotação com fallback 5,25; BRL passa direto", () => {
    expect(convertToBRL(100, "BRL")).toBe(100);
    expect(convertToBRL(100, "USD")).toBe(525);
    expect(convertToBRL(100, "USD", 5.5)).toBe(550);
  });
});

describe("applyOperation (unitário)", () => {
  it("dividend/jcp/fii_yield somam proventos e preservam posição", () => {
    const base = { quantity: 10, averageCost: 100, totalCost: 1000, dividends: 0 };
    const result = applyOperation(base, { type: "fii_yield", quantity: 0, price: 0, total: 42 });
    expect(result).toEqual({ quantity: 10, averageCost: 100, totalCost: 1000, dividends: 42 });
  });
});

describe("positionPnl — rentabilidade não realizada (F14, DoD)", () => {
  it("compra 10 × R$ 100 → preço R$ 120 ⇒ +R$ 200 / +20%", () => {
    // DoD F14: reconciliação manual — custo 1.000, valor 1.200.
    const pnl = positionPnl(1200, 1000);
    expect(pnl.unrealizedPnl).toBe(200);
    expect(pnl.unrealizedPct).toBe(20);
  });

  it("preço abaixo do custo ⇒ prejuízo negativo (valor − custo)", () => {
    const pnl = positionPnl(900, 1000);
    expect(pnl.unrealizedPnl).toBe(-100);
    expect(pnl.unrealizedPct).toBe(-10);
  });

  it("sem custo (caixa/reserva 1:1) ⇒ percentual null", () => {
    const pnl = positionPnl(500, 0);
    expect(pnl.unrealizedPnl).toBe(500);
    expect(pnl.unrealizedPct).toBeNull();
  });

  it("arredonda o PnL para 2 casas e o percentual para 2 casas", () => {
    const pnl = positionPnl(1000.05, 999.99);
    expect(pnl.unrealizedPnl).toBe(0.06);
    expect(pnl.unrealizedPct).toBe(0.01); // 0,06 ÷ 999,99 × 100 ≈ 0,006% → 0,01%
  });
});

describe("portfolioMonthlySeries — série mensal derivada (F14)", () => {
  const buy = (overrides: Partial<LedgerTransaction> & Pick<LedgerTransaction, "type" | "date">): LedgerTransaction =>
    tx({ ...overrides, quantity: overrides.quantity ?? 10, price: overrides.price ?? 100, total: overrides.total ?? 1000 });

  it("valora cada mês com o ledger acumulado até o fim do mês (preço atual)", () => {
    const transactionsByAsset = new Map([
      ["a1", [buy({ type: "buy", date: "2026-01-15", quantity: 10, price: 100, total: 1000 })]],
    ]);
    const assets = [{ assetId: "a1", isCash: false, priceBRL: 120 }];
    const series = portfolioMonthlySeries(transactionsByAsset, assets, ["2026-01", "2026-02", "2026-03"]);
    // Jan: 10 × 120 = 1.200 · Fev/Mar: mesma posição (sem novas transações) → 1.200.
    expect(series).toEqual([
      { month: "2026-01", valueBRL: 1200 },
      { month: "2026-02", valueBRL: 1200 },
      { month: "2026-03", valueBRL: 1200 },
    ]);
  });

  it("mês sem transações ainda vale a posição acumulada anterior", () => {
    const transactionsByAsset = new Map([
      ["a1", [buy({ type: "buy", date: "2026-01-15" })]],
      ["c1", [{ ...tx({ type: "buy", date: "2026-01-05" }), quantity: 500, price: 1, total: 500 }]],
    ]);
    const assets = [
      { assetId: "a1", isCash: false, priceBRL: 120 },
      { assetId: "c1", isCash: true, priceBRL: 1 },
    ];
    const series = portfolioMonthlySeries(transactionsByAsset, assets, ["2026-01", "2026-02"]);
    // Jan: ativo 10×120=1.200 + caixa 500×1=500 ⇒ 1.700. Fev: idem.
    expect(series).toEqual([
      { month: "2026-01", valueBRL: 1700 },
      { month: "2026-02", valueBRL: 1700 },
    ]);
  });

  it("compra posterior aumenta a posição apenas no mês dela", () => {
    const transactionsByAsset = new Map([
      ["a1", [buy({ type: "buy", date: "2026-01-15", quantity: 10 }), buy({ type: "buy", date: "2026-03-10", quantity: 10 })]],
    ]);
    const assets = [{ assetId: "a1", isCash: false, priceBRL: 120 }];
    const series = portfolioMonthlySeries(transactionsByAsset, assets, ["2026-01", "2026-02", "2026-03"]);
    expect(series).toEqual([
      { month: "2026-01", valueBRL: 1200 },
      { month: "2026-02", valueBRL: 1200 },
      { month: "2026-03", valueBRL: 2400 },
    ]);
  });

  it("carteira sem transações → zero em todos os meses", () => {
    const series = portfolioMonthlySeries(new Map(), [{ assetId: "a1", isCash: false, priceBRL: 120 }], ["2026-01", "2026-02"]);
    expect(series).toEqual([
      { month: "2026-01", valueBRL: 0 },
      { month: "2026-02", valueBRL: 0 },
    ]);
  });
});

describe("allocationByClass — alocação por classe de ativo (§F16)", () => {
  it("agrupa por classe somando o valor de mercado e calcula o peso", () => {
    const slices = allocationByClass([
      { assetClass: "Ações", valueBRL: 6000 },
      { assetClass: "Ações", valueBRL: 2000 },
      { assetClass: "FIIs", valueBRL: 2000 },
    ]);
    expect(slices).toEqual([
      { className: "Ações", valueBRL: 8000, pct: 80 },
      { className: "FIIs", valueBRL: 2000, pct: 20 },
    ]);
  });

  it("ordena por valor decrescente (leitura do anel)", () => {
    const slices = allocationByClass([
      { assetClass: "Renda Fixa", valueBRL: 500 },
      { assetClass: "Cripto", valueBRL: 3000 },
      { assetClass: "Caixa", valueBRL: 1200 },
    ]);
    expect(slices.map((s) => s.className)).toEqual(["Cripto", "Caixa", "Renda Fixa"]);
  });

  it("classe nula ou vazia vira 'Sem classe'", () => {
    const slices = allocationByClass([
      { assetClass: null, valueBRL: 1000 },
      { assetClass: "  ", valueBRL: 500 },
      { assetClass: "Ações", valueBRL: 2500 },
    ]);
    expect(slices).toEqual([
      { className: "Ações", valueBRL: 2500, pct: 62.5 },
      { className: "Sem classe", valueBRL: 1500, pct: 37.5 },
    ]);
  });

  it("carteira vazia → lista vazia", () => {
    expect(allocationByClass([])).toEqual([]);
  });
});
