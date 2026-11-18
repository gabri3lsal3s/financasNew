import { describe, expect, it } from "vitest";
import {
  calculatePositionRowYoC,
  filterPositionRows,
  formatFixedIncomeRateLabel,
  getAllocationStatusBadgeMeta,
  getScoreBadgeMeta,
  groupPositionsByClass,
  groupPositionsBySector,
  isPositionRowClosed,
  paginatePositionRows,
  resolveHighlightedGroupKey,
  sortPositionRows,
  type PositionGroupableRow,
} from "./position-grouping";

const makeRow = (overrides: Partial<PositionGroupableRow> = {}): PositionGroupableRow => ({
  assetId: "a1",
  ticker: "PETR4",
  assetClass: "Ações",
  sector: "Petróleo",
  currency: "BRL",
  quantity: 10,
  averageCost: 30,
  totalCost: 300,
  totalCostBRL: 300,
  priceBRL: 40,
  valueBRL: 400,
  pct: 40,
  unrealizedPnl: 100,
  unrealizedPct: 33.33,
  isCash: false,
  ...overrides,
});

describe("position-grouping", () => {
  it("identifica posições encerradas apenas quando quantidade, valor e custo estão zerados", () => {
    expect(isPositionRowClosed(makeRow())).toBe(false);
    expect(
      isPositionRowClosed(
        makeRow({ quantity: 0, valueBRL: 0, totalCostBRL: 0, totalCost: 0, averageCost: 0 }),
      ),
    ).toBe(true);
    expect(
      isPositionRowClosed(
        makeRow({ quantity: 0, valueBRL: 0, totalCostBRL: 100, totalCost: 100, averageCost: 10 }),
      ),
    ).toBe(false);
  });

  it("filtra por busca (ticker, classe ou setor) e classe selecionada", () => {
    const list = [
      makeRow({ assetId: "1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo" }),
      makeRow({ assetId: "2", ticker: "MXRF11", assetClass: "FIIs", sector: "Papel" }),
    ];

    expect(filterPositionRows(list, { search: "petr", selectedClass: null })).toHaveLength(1);
    expect(filterPositionRows(list, { search: "papel", selectedClass: null })).toHaveLength(1);
    expect(filterPositionRows(list, { search: "", selectedClass: "FIIs" })).toHaveLength(1);
    expect(filterPositionRows(list, { search: "petr", selectedClass: "FIIs" })).toHaveLength(0);
  });

  it("ordena linhas por diferentes chaves e direções de forma determinística", () => {
    const a = makeRow({ assetId: "1", ticker: "VALE3", valueBRL: 1000, unrealizedPct: 5 });
    const b = makeRow({ assetId: "2", ticker: "BBAS3", valueBRL: 3000, unrealizedPct: 15 });

    expect(sortPositionRows([a, b], { key: "ticker", direction: "asc" }).map((r) => r.ticker)).toEqual([
      "BBAS3",
      "VALE3",
    ]);
    expect(sortPositionRows([a, b], { key: "value", direction: "desc" }).map((r) => r.ticker)).toEqual([
      "BBAS3",
      "VALE3",
    ]);
    expect(sortPositionRows([a, b], { key: "unrealizedPct", direction: "asc" }).map((r) => r.ticker)).toEqual([
      "VALE3",
      "BBAS3",
    ]);
  });

  it("agrupa por classe e setor respeitando ordenação ativa", () => {
    const rows = [
      makeRow({ assetId: "1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo", valueBRL: 500 }),
      makeRow({ assetId: "2", ticker: "MXRF11", assetClass: "FIIs", sector: "Papel", valueBRL: 2000 }),
    ];

    const byClass = groupPositionsByClass(rows, { key: "value", direction: "desc" });
    expect(byClass.map((g) => g.className)).toEqual(["FIIs", "Ações"]);

    const bySector = groupPositionsBySector(rows, { key: "ticker", direction: "asc" });
    expect(bySector.map((g) => g.sectorName)).toEqual(["Papel", "Petróleo"]);
  });

  it("resolve grupo a expandir automaticamente para ativo destacado", () => {
    const rows = [makeRow({ assetId: "a1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo" })];
    expect(resolveHighlightedGroupKey(rows, "a1", "class")).toBe("Ações");
    expect(resolveHighlightedGroupKey(rows, "a1", "sector")).toBe("Ações__Petróleo");
    expect(resolveHighlightedGroupKey(rows, "missing", "class")).toBeNull();
  });

  it("pagina corretamente e lida com pageSize=Infinity", () => {
    const rows = Array.from({ length: 12 }, (_, idx) => makeRow({ assetId: String(idx) }));
    const p1 = paginatePositionRows(rows, 2, 5);
    expect(p1.items).toHaveLength(5);
    expect(p1.currentPage).toBe(2);
    expect(p1.totalPages).toBe(3);
    expect(p1.startIndex).toBe(6);
    expect(p1.endIndex).toBe(10);

    const all = paginatePositionRows(rows, 1, Infinity);
    expect(all.items).toHaveLength(12);
    expect(all.totalPages).toBe(1);
  });

  it("formata metadados de renda fixa, nota, status e YoC nativo", () => {
    expect(
      formatFixedIncomeRateLabel({
        isMatured: false,
        fixedIncomeMetadata: { rate_type: "cdi", rate_value: 110, base_date: "2026-01-01" },
      }),
    ).toBe("110% CDI");
    expect(formatFixedIncomeRateLabel({ isMatured: true, fixedIncomeMetadata: null })).toBe("Vencido");

    expect(getScoreBadgeMeta(null)).toEqual({ label: "Sem nota", variant: "muted" });
    expect(getScoreBadgeMeta(8)).toEqual({ label: "Nota 8", variant: "positive" });
    expect(getAllocationStatusBadgeMeta("quarantine")).toEqual({
      label: "Quarentena",
      variant: "warning",
    });

    expect(
      calculatePositionRowYoC(
        makeRow({
          currency: "USD",
          totalCost: 1000,
          totalCostBRL: 5000,
          dividends: 500,
          dividendsNative: 100,
        }),
      ),
    ).toBe(10);
  });
});
