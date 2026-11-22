import { describe, expect, it } from "vitest";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import {
  resolveSmartAdvisorActionRoute,
  resolveSmartAdvisorPresentation,
} from "./smart-advisor-routing";

describe("smart-advisor-routing", () => {
  it("apresenta badge 'Meta de Receita' com variante warning para insights do tipo income_goal", () => {
    const insight: SmartAdvisorInsight = {
      id: "income_goal:goal-1",
      themeKey: "income_goal:goal-1",
      priority: 2,
      category: "income",
      title: "Meta de receita abaixo do ritmo",
      description: "Realizado R$ 0,00 de R$ 1.000,00 (0% da meta).",
      iconName: "arrow-down-left",
    };

    const presentation = resolveSmartAdvisorPresentation(insight);
    expect(presentation.badgeLabel).toBe("Meta de Receita");
    expect(presentation.badgeVariant).toBe("warning");
    expect(presentation.iconKind).toBe("income");
  });

  it("apresenta badge 'Entrada Prevista' com variante positive para rendas recorrentes habituais", () => {
    const insight: SmartAdvisorInsight = {
      id: "income:salario",
      themeKey: "income:salario",
      priority: 2,
      category: "income",
      title: "Confirmar recebimento",
      description: "Renda de ACME Corp prevista.",
      iconName: "arrow-down-left",
    };

    const presentation = resolveSmartAdvisorPresentation(insight);
    expect(presentation.badgeLabel).toBe("Entrada Prevista");
    expect(presentation.badgeVariant).toBe("positive");
    expect(presentation.iconKind).toBe("income");
  });

  it("redireciona para /orcamentos?tab=goals com categoria quando open_income_goals possui categoryId", () => {
    const insight: SmartAdvisorInsight = {
      id: "income_goal:g1",
      themeKey: "income_goal:g1",
      priority: 2,
      category: "income",
      title: "Meta de receita abaixo do ritmo",
      description: "...",
      iconName: "arrow-down-left",
      primaryAction: {
        label: "Ver orçamentos",
        kind: "open_income_goals",
        payload: {
          categoryId: "cat-salario",
        },
      },
    };

    const route = resolveSmartAdvisorActionRoute(insight, "");
    expect(route).toBe("/orcamentos?tab=goals&categoria=cat-salario");
  });

  it("apresenta badge 'Compromisso Anual' com variante warning para compromissos sazonais e anuais", () => {
    const insight: SmartAdvisorInsight = {
      id: "annual:ipva",
      themeKey: "annual:ipva",
      priority: 1,
      category: "critical",
      title: "Compromisso anual previsto",
      description: "No ano passado você pagou IPVA em Janeiro.",
      iconName: "alert-triangle",
    };

    const presentation = resolveSmartAdvisorPresentation(insight);
    expect(presentation.badgeLabel).toBe("Compromisso Anual");
    expect(presentation.badgeVariant).toBe("warning");
    expect(presentation.iconKind).toBe("critical");
  });

  it("redireciona para /orcamentos?tab=goals sem query extra quando payload não possui categoryId", () => {
    const insight: SmartAdvisorInsight = {
      id: "income_goal:g1",
      themeKey: "income_goal:g1",
      priority: 2,
      category: "income",
      title: "Meta de receita abaixo do ritmo",
      description: "...",
      iconName: "arrow-down-left",
      primaryAction: {
        label: "Ver orçamentos",
        kind: "open_income_goals",
      },
    };

    const route = resolveSmartAdvisorActionRoute(insight, "");
    expect(route).toBe("/orcamentos?tab=goals");
  });

  it("redireciona household:ceiling_exceeded e household:settlement_pending para /familia (nunca nova despesa/receita)", () => {
    const ceiling: SmartAdvisorInsight = {
      id: "household:ceiling_exceeded",
      themeKey: "household:ceiling_exceeded",
      priority: 1,
      category: "critical",
      title: "Teto familiar estourado",
      description: "Acima do teto",
      iconName: "alert-triangle",
      primaryAction: { label: "Ver gastos", kind: "navigate_family" },
      metadata: { valueCents: 550000 },
    };
    const settlement: SmartAdvisorInsight = {
      id: "household:settlement_pending",
      themeKey: "household:settlement_pending",
      priority: 2,
      category: "income",
      title: "Acerto familiar pendente",
      description: "Compensação pendente",
      iconName: "arrow-down-left",
      primaryAction: { label: "Ver acerto", kind: "open_family_settlement" },
      metadata: { valueCents: 45000 },
    };

    expect(resolveSmartAdvisorActionRoute(ceiling, "")).toBe("/familia");
    expect(resolveSmartAdvisorActionRoute(settlement, "")).toBe("/familia");
    expect(resolveSmartAdvisorPresentation(ceiling).badgeLabel).toBe("Teto Familiar");
    expect(resolveSmartAdvisorPresentation(settlement).badgeLabel).toBe("A Receber · Família");
  });
});
