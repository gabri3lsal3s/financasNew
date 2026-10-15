import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDemoData, isDemoItem, loadDemoData, DEMO_TAG } from "./demo-data";

const fromMock = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: fromMock,
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-123"),
}));

describe("demo-data service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDemoItem", () => {
    it("identifica corretamente itens com a tag de demonstração", () => {
      expect(isDemoItem(`${DEMO_TAG} Supermercado`)).toBe(true);
      expect(isDemoItem(`Supermercado ${DEMO_TAG}`)).toBe(true);
      expect(isDemoItem("Supermercado Pão de Açúcar")).toBe(false);
      expect(isDemoItem("")).toBe(false);
      expect(isDemoItem(null)).toBe(false);
      expect(isDemoItem(undefined)).toBe(false);
    });
  });

  describe("loadDemoData", () => {
    it("insere categorias, cartão, receitas, despesas, orçamentos e ativo de teste", async () => {
      const selectMock = vi.fn();
      const insertMock = vi.fn();
      const upsertMock = vi.fn();

      fromMock.mockImplementation((table: string) => {
        if (table === "categories") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: "cat-1", name: "Alimentação", type: "expense" },
                { id: "cat-2", name: "Moradia", type: "expense" },
                { id: "cat-3", name: "Transporte", type: "expense" },
                { id: "cat-4", name: "Lazer", type: "expense" },
                { id: "cat-5", name: "Salário", type: "income" },
              ],
              error: null,
            }),
          };
        }
        if (table === "credit_cards") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "card-demo-1", name: `${DEMO_TAG} Cartão Platinum` },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "incomes" || table === "expenses" || table === "portfolio_assets" || table === "portfolio_contributions") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "budgets") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: selectMock, insert: insertMock, upsert: upsertMock };
      });

      const summary = await loadDemoData();
      expect(summary.cards).toBe(1);
      expect(summary.incomes).toBe(2);
      expect(summary.expenses).toBeGreaterThan(5);
      expect(summary.budgets).toBe(2);
      expect(summary.assets).toBe(1);
    });
  });

  describe("clearDemoData", () => {
    it("remove cirurgicamente apenas os itens marcados com a tag de demonstração", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "expenses") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "e1" }, { id: "e2" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "incomes") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "i1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "credit_cards") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "c1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "portfolio_assets") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "a1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "portfolio_contributions") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { delete: vi.fn() };
      });

      const summary = await clearDemoData();
      expect(summary.expenses).toBe(2);
      expect(summary.incomes).toBe(1);
      expect(summary.cards).toBe(1);
      expect(summary.assets).toBe(1);
    });
  });
});
