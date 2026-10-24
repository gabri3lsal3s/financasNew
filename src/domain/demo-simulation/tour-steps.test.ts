import { describe, expect, it } from "vitest";
import { getTourSteps, TOUR_STEPS } from "./tour-steps";

describe("tour-steps — Definição das Trilhas e Seletores Semânticos de Foco", () => {
  it("contém as trilhas finances e investments", () => {
    expect(TOUR_STEPS.finances).toBeDefined();
    expect(TOUR_STEPS.investments).toBeDefined();
    expect(TOUR_STEPS.finances.length).toBe(4);
    expect(TOUR_STEPS.investments.length).toBe(3);
  });

  it("retorna array vazio quando passada uma trilha desconhecida", () => {
    // @ts-expect-error teste com valor inválido
    expect(getTourSteps("unknown")).toEqual([]);
  });

  describe("trilha finances", () => {
    const steps = getTourSteps("finances");

    it("possui ordem sequencial estrita de 1 a 4", () => {
      steps.forEach((step, idx) => {
        expect(step.order).toBe(idx + 1);
        expect(step.track).toBe("finances");
      });
    });

    it("todos os passos definem targetRoute e targetSelector válidos", () => {
      for (const step of steps) {
        expect(step.targetRoute).toMatch(/^\//);
        expect(step.targetSelector).toBeDefined();
        expect(step.targetSelector).toMatch(/^\[data-tour="[\w-]+"]$/);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      }
    });

    it("mapeia os seletores corretos para cada etapa de finanças", () => {
      expect(steps[0]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[1]?.targetSelector).toBe('[data-tour="transactions-content"]');
      expect(steps[2]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[3]?.targetSelector).toBe('[data-tour="budgets-content"]');
    });
  });

  describe("trilha investments", () => {
    const steps = getTourSteps("investments");

    it("possui ordem sequencial estrita de 1 a 3", () => {
      steps.forEach((step, idx) => {
        expect(step.order).toBe(idx + 1);
        expect(step.track).toBe("investments");
      });
    });

    it("todos os passos definem targetRoute e targetSelector válidos", () => {
      for (const step of steps) {
        expect(step.targetRoute).toMatch(/^\/investimentos/);
        expect(step.targetSelector).toBeDefined();
        expect(step.targetSelector).toMatch(/^\[data-tour="[\w-]+"]$/);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      }
    });

    it("mapeia os seletores corretos para cada etapa de investimentos", () => {
      expect(steps[0]?.targetSelector).toBe('[data-tour="investments-summary"]');
      expect(steps[1]?.targetSelector).toBe('[data-tour="investments-targets"]');
      expect(steps[2]?.targetSelector).toBe('[data-tour="investments-rebalance"]');
    });
  });
});
