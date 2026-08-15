import { describe, expect, it } from "vitest";
import {
  buildHabitualEntries,
  jaccardTokens,
  normalizeText,
  predictFromHistory,
  recencyFactor,
  tokenize,
  type PredictionEntry,
} from "./index";

const TODAY = "2026-08-15";

const history: PredictionEntry[] = [
  {
    id: "1",
    kind: "expense",
    description: "Supermercado Pão de Açúcar",
    categoryId: "c-mercado",
    categoryName: "Mercado",
    paymentMethod: "credit_card",
    cardId: "card-nubank",
    receiveType: null,
    value: 320,
    date: "2026-08-10",
  },
  {
    id: "2",
    kind: "expense",
    description: "Mercado Extra",
    categoryId: "c-mercado",
    categoryName: "Mercado",
    paymentMethod: "credit_card",
    cardId: "card-nubank",
    receiveType: null,
    value: 150,
    date: "2026-07-12",
  },
  {
    id: "3",
    kind: "expense",
    description: "Uber para o trabalho",
    categoryId: "c-transporte",
    categoryName: "Transporte",
    paymentMethod: "pix",
    cardId: null,
    receiveType: null,
    value: 24,
    date: "2026-08-14",
  },
  {
    id: "4",
    kind: "income",
    description: "Salário",
    categoryId: "c-salario",
    categoryName: "Salário",
    paymentMethod: null,
    cardId: null,
    receiveType: "pix",
    value: 5000,
    date: "2026-08-05",
  },
  {
    id: "5",
    kind: "income",
    description: "Freela site",
    categoryId: "c-freela",
    categoryName: "Freelance",
    paymentMethod: null,
    cardId: null,
    receiveType: "transfer",
    value: 1200,
    date: "2026-08-01",
  },
  {
    id: "6",
    kind: "expense",
    description: "Padaria da esquina",
    categoryId: "c-alimentacao",
    categoryName: "Alimentação",
    paymentMethod: "cash",
    cardId: null,
    receiveType: null,
    value: 18,
    date: "2026-08-15",
  },
];

describe("predictions — motor preditivo de entrada (F21)", () => {
  it("normalizeText remove acentos e minúsculas", () => {
    expect(normalizeText("  Supermercado Pão de Açúcar ")).toBe("supermercado pao de acucar");
  });

  it("tokenize ignora pontuação e tokens de 1 char", () => {
    expect(tokenize("Mercado Extra 24h")).toEqual(["mercado", "extra", "24h"]);
    expect(tokenize("a e o")).toEqual([]);
  });

  it("jaccardTokens calcula a similaridade corretamente", () => {
    expect(jaccardTokens(["mercado"], ["mercado"])).toBe(1);
    expect(jaccardTokens(["mercado", "pao"], ["mercado"])).toBe(0.5);
    expect(jaccardTokens(["mercado"], ["uber"])).toBe(0);
    expect(jaccardTokens([], ["mercado"])).toBe(0);
  });

  it("recencyFactor pondera datas recentes (1 hoje, ~0 além da janela)", () => {
    expect(recencyFactor("2026-08-15", TODAY)).toBe(1);
    expect(recencyFactor("2026-08-01", TODAY)).toBeCloseTo(1 - 14 / 90);
    expect(recencyFactor("2026-01-01", TODAY)).toBe(0);
    expect(recencyFactor("2026-09-01", TODAY)).toBe(1); // futura
  });

  it("prediz categoria/forma/cartão por descrição similar (Mercado)", () => {
    const suggestions = predictFromHistory(history, "mercado pao de acucar", "expense", TODAY);
    expect(suggestions.length).toBeGreaterThan(0);
    const top = suggestions[0];
    expect(top?.categoryId).toBe("c-mercado");
    expect(top?.categoryName).toBe("Mercado");
    expect(top?.paymentMethod).toBe("credit_card");
    expect(top?.cardId).toBe("card-nubank");
  });

  it("prediz transporte para descrição diferente do grupo dominante", () => {
    const suggestions = predictFromHistory(history, "uber", "expense", TODAY);
    expect(suggestions[0]?.categoryId).toBe("c-transporte");
    expect(suggestions[0]?.paymentMethod).toBe("pix");
  });

  it("predição separa despesas de receitas (Salário)", () => {
    const expenseHits = predictFromHistory(history, "salario", "expense", TODAY);
    const incomeHits = predictFromHistory(history, "salario", "income", TODAY);
    expect(expenseHits.length).toBe(0);
    expect(incomeHits[0]?.categoryId).toBe("c-salario");
    expect(incomeHits[0]?.receiveType).toBe("pix");
  });

  it("valor sugerido é a média ponderada por recência", () => {
    const suggestions = predictFromHistory(history, "mercado", "expense", TODAY);
    const top = suggestions[0];
    expect(top?.value).toBeGreaterThan(0);
    // Recência: 320 (10/08, recente) pesa mais que 150 (12/07) → a média
    // ponderada fica entre 235 (média simples) e 320 (valor mais recente).
    expect(top?.value).toBeGreaterThan(235);
    expect(top?.value).toBeLessThan(320);
  });

  it("query vazia ou sem tokens não gera sugestões", () => {
    expect(predictFromHistory(history, "", "expense", TODAY)).toEqual([]);
    expect(predictFromHistory(history, "a", "expense", TODAY)).toEqual([]);
    expect(predictFromHistory([], "mercado", "expense", TODAY)).toEqual([]);
  });

  it("buildHabitualEntries deriva favoritos por frequência (top 5)", () => {
    const repeated: PredictionEntry[] = [
      ...history,
      { ...history[0]!, id: "7", date: "2026-06-10" },
      { ...history[0]!, id: "8", date: "2026-05-10" },
    ];
    const habits = buildHabitualEntries(repeated, "expense", 5);
    expect(habits[0]?.description).toBe("Supermercado Pão de Açúcar");
    expect(habits[0]?.frequency).toBe(3);
    expect(habits[0]?.categoryId).toBe("c-mercado");
  });

  it("buildHabitualEntries ignora lançamentos sem descrição", () => {
    const noDescription: PredictionEntry[] = [
      { ...history[0]!, id: "n1", description: "" },
      { ...history[0]!, id: "n2", description: "  " },
    ];
    expect(buildHabitualEntries(noDescription, "expense")).toEqual([]);
  });
});
