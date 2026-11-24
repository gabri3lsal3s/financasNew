import { describe, expect, it } from "vitest";
import {
  filterCardsByViewScope,
  filterCategoriesForScope,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
  isScopedRoute,
} from "./scope-filter";

describe("scope-filter (Matriz de Visibilidade PF x PJ)", () => {
  const sampleExpenses = [
    { id: "e-pf", scope: "personal" as const, is_internal_transfer: false },
    { id: "e-pj", scope: "business" as const, is_internal_transfer: false },
    { id: "e-prolabore", scope: "business" as const, is_internal_transfer: true },
    { id: "e-aporte", scope: "personal" as const, is_internal_transfer: true },
    { id: "e-legacy", scope: undefined, is_internal_transfer: undefined },
  ];

  const sampleIncomes = [
    { id: "i-pf", scope: "personal" as const, is_internal_transfer: false },
    { id: "i-pj", scope: "business" as const, is_internal_transfer: false },
    { id: "i-prolabore", scope: "personal" as const, is_internal_transfer: true },
    { id: "i-aporte", scope: "business" as const, is_internal_transfer: true },
  ];

  it("exclui transferências internas na visão consolidada 'all' mantendo zero dupla contagem", () => {
    expect(filterExpensesByViewScope(sampleExpenses, "all").map((e) => e.id)).toEqual([
      "e-pf",
      "e-pj",
      "e-legacy",
    ]);
    expect(filterIncomesByViewScope(sampleIncomes, "all").map((i) => i.id)).toEqual([
      "i-pf",
      "i-pj",
    ]);
  });

  it("inclui apenas lançamentos pessoais na visão 'personal' (incluindo entradas de pró-labore e saídas de aporte PF)", () => {
    expect(filterExpensesByViewScope(sampleExpenses, "personal").map((e) => e.id)).toEqual([
      "e-pf",
      "e-aporte",
      "e-legacy",
    ]);
    expect(filterIncomesByViewScope(sampleIncomes, "personal").map((i) => i.id)).toEqual([
      "i-pf",
      "i-prolabore",
    ]);
  });

  it("separa modo 'dre' vs 'cashflow' na visão 'business'", () => {
    expect(filterExpensesByViewScope(sampleExpenses, "business", { mode: "dre" }).map((e) => e.id)).toEqual([
      "e-pj",
    ]);
    expect(filterIncomesByViewScope(sampleIncomes, "business", { mode: "dre" }).map((i) => i.id)).toEqual([
      "i-pj",
    ]);

    expect(filterExpensesByViewScope(sampleExpenses, "business", { mode: "cashflow" }).map((e) => e.id)).toEqual([
      "e-pj",
      "e-prolabore",
    ]);
    expect(filterIncomesByViewScope(sampleIncomes, "business", { mode: "cashflow" }).map((i) => i.id)).toEqual([
      "i-pj",
      "i-aporte",
    ]);
  });

  it("filtra cartões (incluindo mistos) e dívidas por escopo", () => {
    const cards = [
      { id: "c-pf", scope: "personal" as const },
      { id: "c-pj", scope: "business" as const },
      { id: "c-mix", scope: "mixed" as const },
    ];
    expect(filterCardsByViewScope(cards, "all")).toHaveLength(3);
    expect(filterCardsByViewScope(cards, "personal").map((c) => c.id)).toEqual(["c-pf", "c-mix"]);
    expect(filterCardsByViewScope(cards, "business").map((c) => c.id)).toEqual(["c-pj", "c-mix"]);

    const debts = [
      { id: "d1", scope: "personal" as const },
      { id: "d2", scope: "business" as const },
    ];
    expect(filterDebtsByViewScope(debts, "business").map((d) => d.id)).toEqual(["d2"]);
  });

  it("filtra categorias por escopo com fallback seguro se não houver compatíveis", () => {
    const cats = [
      { id: "1", scope: "personal" as const },
      { id: "2", scope: "business" as const },
      { id: "3", scope: "both" as const },
    ];
    expect(filterCategoriesForScope(cats, "business").map((c) => c.id)).toEqual(["2", "3"]);
    expect(filterCategoriesForScope(cats, "business", true)).toHaveLength(3);

    const onlyPersonal = [{ id: "1", scope: "personal" as const }];
    expect(filterCategoriesForScope(onlyPersonal, "business").map((c) => c.id)).toEqual(["1"]);
  });

  it("identifica corretamente rotas com escopo vs sem escopo", () => {
    expect(isScopedRoute("/")).toBe(true);
    expect(isScopedRoute("/transacoes")).toBe(true);
    expect(isScopedRoute("/cartoes")).toBe(true);
    expect(isScopedRoute("/negocio")).toBe(false);
    expect(isScopedRoute("/investments")).toBe(false);
    expect(isScopedRoute("/configuracoes")).toBe(false);
    expect(isScopedRoute("/familia")).toBe(false);
  });
});
