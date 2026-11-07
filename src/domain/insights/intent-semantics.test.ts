import { describe, expect, it } from "vitest";
import {
  extractHabitClusterKey,
  inferIntentFromDescription,
} from "./intent-semantics";
import type { ExpenseLike } from "./recurrences";

describe("intent-semantics", () => {
  describe("inferIntentFromDescription", () => {
    it("identifica trajetos variáveis como intenção de mobilidade", () => {
      expect(inferIntentFromDescription("Ida para Caju", "transporte")).toBe("mobility:commute");
      expect(inferIntentFromDescription("Ida para Glória", "transporte")).toBe("mobility:commute");
      expect(inferIntentFromDescription("Volta da Unic", "transporte")).toBe("mobility:commute");
      expect(inferIntentFromDescription("Corrida Uber Centro", "transporte")).toBe("mobility:commute");
      expect(inferIntentFromDescription("99 corrida trabalho", "transporte")).toBe("mobility:commute");
    });

    it("identifica refeições de rotina com estabelecimentos ou nomes diferentes", () => {
      expect(inferIntentFromDescription("Almoço PF", "alimentacao")).toBe("food:daily_meals");
      expect(inferIntentFromDescription("Almoço restaurante Maria", "alimentacao")).toBe("food:daily_meals");
      expect(inferIntentFromDescription("Subway almoço", "alimentacao")).toBe("food:daily_meals");
      expect(inferIntentFromDescription("Giraffas almoço executivo", "alimentacao")).toBe("food:daily_meals");
    });

    it("identifica delivery com prioridade", () => {
      expect(inferIntentFromDescription("iFood pedido jantar", "alimentacao")).toBe("food:delivery");
      expect(inferIntentFromDescription("Rappi compras almoço", "alimentacao")).toBe("food:delivery");
    });

    it("identifica cafés e lanches de conveniência", () => {
      expect(inferIntentFromDescription("Café expresso", "alimentacao")).toBe("food:coffee_snacks");
      expect(inferIntentFromDescription("Pão de queijo lanche", "alimentacao")).toBe("food:coffee_snacks");
      expect(inferIntentFromDescription("Pastel na padaria", "alimentacao")).toBe("food:coffee_snacks");
    });

    it("identifica abastecimento doméstico e feira", () => {
      expect(inferIntentFromDescription("Feira de domingo", "mercado")).toBe("pantry:groceries");
      expect(inferIntentFromDescription("Supermercado Compre Bem", "mercado")).toBe("pantry:groceries");
      expect(inferIntentFromDescription("Açougue carnes", "mercado")).toBe("pantry:groceries");
    });

    it("identifica farmácia", () => {
      expect(inferIntentFromDescription("Drogasil remédio", "farmacia")).toBe("health:pharmacy");
      expect(inferIntentFromDescription("Farmácia curativo", "saude")).toBe("health:pharmacy");
    });

    it("identifica cuidados pessoais e serviços frequentes", () => {
      expect(inferIntentFromDescription("Diarista faxina casa")).toBe("personal_care:routine");
      expect(inferIntentFromDescription("Terapia semanal Ana")).toBe("personal_care:routine");
      expect(inferIntentFromDescription("Corte cabelo barbearia")).toBe("personal_care:routine");
    });
  });

  describe("extractHabitClusterKey", () => {
    it("unifica trajetos diferentes sob a mesma chave de cluster de mobilidade", () => {
      const exp1: ExpenseLike = {
        id: "1",
        description: "Ida para Caju",
        month: "2026-11",
        valueCents: 2500,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      };

      const exp2: ExpenseLike = {
        id: "2",
        description: "Ida para Glória",
        month: "2026-11",
        valueCents: 3000,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      };

      const exp3: ExpenseLike = {
        id: "3",
        description: "Volta da Unic",
        month: "2026-11",
        valueCents: 2200,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      };

      const res1 = extractHabitClusterKey(exp1);
      const res2 = extractHabitClusterKey(exp2);
      const res3 = extractHabitClusterKey(exp3);

      expect(res1.clusterKey).toBe("habit:cat_transporte:mobility:commute");
      expect(res2.clusterKey).toBe("habit:cat_transporte:mobility:commute");
      expect(res3.clusterKey).toBe("habit:cat_transporte:mobility:commute");
      expect(res1.canonicalLabel).toBe("Deslocamentos e transporte");
      expect(res1.isSubscription).toBe(false);
    });

    it("preserva assinaturas reais conhecidas no trilho estrito", () => {
      const expNetflix: ExpenseLike = {
        id: "4",
        description: "Netflix Mensal",
        month: "2026-11",
        valueCents: 5590,
        categoryId: "cat_lazer",
        categoryIcon: "streaming",
      };

      const res = extractHabitClusterKey(expNetflix);
      expect(res.isSubscription).toBe(true);
      expect(res.clusterKey).toBe("subscription:netflix");
      expect(res.matchedServiceName).toBe("netflix");
    });
  });
});
