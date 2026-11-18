import { describe, expect, it, vi } from "vitest";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import { navigateAdvisorAlert } from "./navigate-advisor-alert";

function makeInsight(overrides: Partial<SmartAdvisorInsight>): SmartAdvisorInsight {
  return {
    id: "id-1",
    themeKey: "theme:1",
    priority: 1,
    category: "critical",
    title: "Alerta",
    description: "Descrição",
    iconName: "alert-triangle",
    ...overrides,
  };
}

describe("navigateAdvisorAlert", () => {
  it("direciona aportes para /investments com valor quando informado", () => {
    const navigate = vi.fn();
    navigateAdvisorAlert(
      makeInsight({
        themeKey: "aporte:mensal",
        primaryAction: { label: "Aportar", kind: "navigate_aporte", payload: { valorCents: 150000 } },
      }),
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith("/investments?tab=aporte&valor=150000");
  });

  it("direciona hábitos de categoria para /orcamentos?tab=limits", () => {
    const navigate = vi.fn();
    navigateAdvisorAlert(
      makeInsight({
        themeKey: "habit:lazer",
        primaryAction: { label: "Definir", kind: "set_category_budget", payload: { categoryId: "cat-9" } },
      }),
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith("/orcamentos?tab=limits&categoria=cat-9&definirLimite=1");
  });

  it("direciona alertas de recorrência/duplicidade para /insights?aba=recurrences", () => {
    const navigate = vi.fn();
    navigateAdvisorAlert(
      makeInsight({
        id: "dup:netflix",
        themeKey: "dup:netflix",
      }),
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith("/insights?aba=recurrences&item=netflix");
  });

  it("direciona alertas de despesa preservando forma de pagamento e cartão", () => {
    const navigate = vi.fn();
    navigateAdvisorAlert(
      makeInsight({
        id: "due_today:internet",
        themeKey: "due_today:internet",
        title: "Internet Fibra",
        primaryAction: {
          label: "Registrar",
          kind: "register_expense",
          payload: {
            name: "Internet Fibra",
            valueCents: 12000,
            categoryId: "cat-1",
            date: "2026-11-10",
            forma: "credit_card",
            cardId: "card-7",
          },
        },
      }),
      navigate,
      "",
    );
    const url = navigate.mock.calls[0]?.[0] as string;
    expect(url).toContain("novo=despesa");
    expect(url).toContain("forma=credit_card");
    expect(url).toContain("cartao=card-7");
  });
});
