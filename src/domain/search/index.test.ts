import { describe, expect, it } from "vitest";
import {
  matchScore,
  monthsBetween,
  normalizeSearch,
  numericMatchScore,
  recencyBonus,
  scoreSearchEntry,
  searchGlobal,
  type SearchEntry,
} from "./index";

const TODAY = "2026-08-14";

const entry = (overrides: Partial<SearchEntry> & Pick<SearchEntry, "id" | "type" | "label">): SearchEntry => ({
  text: [],
  link: { path: "/transacoes" },
  ...overrides,
});

describe("domain/search (§3.9 — normalização e scoring)", () => {
  it("normalizeSearch remove acentos e minúsculas", () => {
    expect(normalizeSearch("Ação Ênfase Çafé")).toBe("acao enfase cafe");
    expect(normalizeSearch("  PETR4  ")).toBe("petr4");
  });

  it("matchScore: igual 100 / prefixo 85 / contém 60", () => {
    expect(matchScore("mercado", "mercado")).toBe(100);
    expect(matchScore("merc", "mercado")).toBe(85);
    expect(matchScore("cado", "mercado")).toBe(60);
    expect(matchScore("xyz", "mercado")).toBe(0);
  });

  it("numericMatchScore: dígitos da query batem com o valor (30)", () => {
    expect(numericMatchScore("1500", 150000)).toBe(30); // R$ 1.500,00
    expect(numericMatchScore("150", 150000)).toBe(30); // "1500".includes("150") ✓
  });

  it("numericMatchScore: sem dígitos suficientes ou sem match → 0", () => {
    expect(numericMatchScore("ab", 150000)).toBe(0);
    expect(numericMatchScore("9999", 150000)).toBe(0);
    expect(numericMatchScore("1", 150000)).toBe(0); // menos de 2 dígitos
    expect(numericMatchScore("100", 150000)).toBe(0); // "1500" não contém "100"
  });
});

describe("domain/search (§3.9 — recência)", () => {
  it("bônus logarítmico por faixa de meses", () => {
    expect(recencyBonus(0)).toBe(25);
    expect(recencyBonus(1)).toBe(20);
    expect(recencyBonus(2)).toBe(20);
    expect(recencyBonus(3)).toBe(15);
    expect(recencyBonus(4)).toBe(15);
    expect(recencyBonus(5)).toBe(10);
    expect(recencyBonus(7)).toBe(5);
    expect(recencyBonus(12)).toBe(5);
    expect(recencyBonus(13)).toBe(0);
  });

  it("monthsBetween conta meses completos, nunca negativo", () => {
    expect(monthsBetween("2026-08-01", TODAY)).toBe(0);
    expect(monthsBetween("2026-06-10", TODAY)).toBe(2);
    expect(monthsBetween("2026-01-05", TODAY)).toBe(7);
    expect(monthsBetween("2025-01-05", TODAY)).toBe(19);
    expect(monthsBetween("2027-01-01", TODAY)).toBe(0); // futuro → 0
  });

  it("scoreSearchEntry soma texto + numérico + status + recência", () => {
    const e = entry({
      id: "d1",
      type: "debt",
      label: "Cartão Nubank",
      text: ["cartao nubank", "a pagar"],
      amountCents: 150000,
      date: "2026-08-10",
      statusWords: ["vencida"],
      link: { path: "/dividas", params: { q: "d1" } },
    });
    // Igual no texto + recência (numérico/status não se aplicam a esta query).
    expect(scoreSearchEntry("Cartão Nubank", e, TODAY)).toBe(100 + 25);
    expect(scoreSearchEntry("1500", e, TODAY)).toBe(30 + 25); // numérico + recência
    expect(scoreSearchEntry("vencida", e, TODAY)).toBe(40 + 25); // status + recência (sem texto)
    expect(scoreSearchEntry("x", e, TODAY)).toBe(0); // query < 2 caracteres
  });
});

describe("domain/search (§3.9 — limites e ordenação)", () => {
  const expenses: SearchEntry[] = [
    entry({ id: "e1", type: "expense", label: "Mercado Extra", text: ["mercado extra"], amountCents: 25000, date: "2026-08-01", link: { path: "/transacoes", params: { month: "2026-08", q: "e1" } } }),
    entry({ id: "e2", type: "expense", label: "Mercado Pão de Açúcar", text: ["mercado pao de acucar"], amountCents: 9000, date: "2026-07-01", link: { path: "/transacoes", params: { month: "2026-07", q: "e2" } } }),
    entry({ id: "e3", type: "expense", label: "Mercadinho", text: ["mercadinho"], amountCents: 4000, date: "2026-01-10", link: { path: "/transacoes", params: { month: "2026-01", q: "e3" } } }),
    entry({ id: "e4", type: "expense", label: "Mercado Central", text: ["mercado central"], amountCents: 12000, date: "2026-08-03", link: { path: "/transacoes", params: { month: "2026-08", q: "e4" } } }),
    entry({ id: "e5", type: "expense", label: "Mercado Municipal", text: ["mercado municipal"], amountCents: 3000, date: "2026-08-05", link: { path: "/transacoes", params: { month: "2026-08", q: "e5" } } }),
    entry({ id: "e6", type: "expense", label: "Mercado Bom Preço", text: ["mercado bom preco"], amountCents: 2000, date: "2026-08-07", link: { path: "/transacoes", params: { month: "2026-08", q: "e6" } } }),
    entry({ id: "i1", type: "income", label: "Salário", text: ["salario"], date: "2026-08-05", link: { path: "/transacoes", params: { month: "2026-08", q: "i1" } } }),
    entry({ id: "c1", type: "card", label: "Cartão Nubank", text: ["cartao nubank"], link: { path: "/cartoes", params: { card: "c1" } } }),
  ];

  it("query com 1 caractere → nenhum resultado", () => {
    expect(searchGlobal("m", expenses, TODAY)).toHaveLength(0);
  });

  it("ordena por score desc com bônus de recência", () => {
    const recent = entry({
      id: "r1",
      type: "expense",
      label: "Academia",
      text: ["academia"],
      date: "2026-08-01",
      link: { path: "/transacoes", params: { month: "2026-08", q: "r1" } },
    });
    const old = entry({
      id: "r2",
      type: "expense",
      label: "Academia Antiga",
      text: ["academia antiga"],
      date: "2026-01-10",
      link: { path: "/transacoes", params: { month: "2026-01", q: "r2" } },
    });
    const results = searchGlobal("academia", [old, recent], TODAY);
    // Igual 100 + recência 25 = 125 > prefixo 85 + recência 10 = 95.
    expect(results[0]?.entry.id).toBe("r1");
    expect(results[1]?.entry.id).toBe("r2");
    // Score decrescente.
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("limita a 5 por tipo e 12 no total", () => {
    const results = searchGlobal("mercado", expenses, TODAY);
    // 6 despesas com "mercado", mas máx. 5 por tipo; e3 ("mercadinho") não casa.
    const ids = results.map((r) => r.entry.id).sort();
    expect(ids).toEqual(["e1", "e2", "e4", "e5", "e6"]);
    expect(results).toHaveLength(5);
  });

  it("limites customizados são respeitados", () => {
    const results = searchGlobal("mercado", expenses, TODAY, { maxPerType: 2, maxTotal: 3 });
    // Só despesas casam com "mercado" → o limite por tipo (2) prevalece.
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.entry.type === "expense")).toBe(true);
  });

  it("match numérico encontra lançamento pelo valor", () => {
    const results = searchGlobal("250", expenses, TODAY);
    expect(results.some((r) => r.entry.id === "e1")).toBe(true);
  });

  it("status de dívida (vencida) retorna a dívida mesmo sem texto", () => {
    const overdue = entry({
      id: "d9",
      type: "debt",
      label: "Boleto escola",
      text: ["boleto escola"],
      date: "2026-07-20",
      statusWords: ["vencida"],
      link: { path: "/dividas", params: { q: "d9" } },
    });
    const results = searchGlobal("vencida", [...expenses, overdue], TODAY);
    expect(results[0]?.entry.id).toBe("d9");
  });

  it("carrega o deep-link do registro", () => {
    const results = searchGlobal("mercado extra", expenses, TODAY);
    expect(results[0]?.entry.link).toEqual({ path: "/transacoes", params: { month: "2026-08", q: "e1" } });
  });
});
