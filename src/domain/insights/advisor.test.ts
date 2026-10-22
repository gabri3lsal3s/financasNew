import { describe, expect, it } from "vitest";
import {
  filterAndRankAdvisorInsights,
  generateSmartAdvisorInsights,
  type SmartAdvisorInsight,
} from "./advisor";
import type { RecurrenceOccurrence, RecurringIncomeOccurrence } from "./recurrences";

function makeOccurrence(overrides: Partial<RecurrenceOccurrence> = {}): RecurrenceOccurrence {
  return {
    key: "netflix",
    name: "Netflix",
    level: "subscription",
    tier: "can_cut",
    segment: "streaming",
    typicalDayOfMonth: 15,
    months: ["2026-07", "2026-08", "2026-09", "2026-10"],
    confidence: 0.9,
    averageCents: 5590,
    missingThisMonth: false,
    ...overrides,
  };
}

function makeIncome(overrides: Partial<RecurringIncomeOccurrence> = {}): RecurringIncomeOccurrence {
  return {
    key: "salario-empresa",
    name: "Empresa XPTO",
    profile: "fixed",
    suggestedAction: "one_touch_confirm",
    typicalDayOfMonth: 5,
    months: ["2026-07", "2026-08", "2026-09", "2026-10"],
    confidence: 0.95,
    averageCents: 750000,
    lastValueCents: 750000,
    missingThisMonth: false,
    daysUntilExpected: 0,
    valueVariationRatio: 0,
    categoryId: "cat-salario",
    expectedDate: "2026-10-05",
    ...overrides,
  };
}

describe("generateSmartAdvisorInsights", () => {
  it("gera insight de prioridade 1 (Crítica) para cobrança duplicada no mês", () => {
    const occ = makeOccurrence({
      key: "gympass",
      name: "Gympass",
      duplicateChargesThisMonth: 2,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(1);
    expect(insights[0]?.category).toBe("critical");
    expect(insights[0]?.title).toBe("Cobrança duplicada detectada");
    expect(insights[0]?.primaryAction?.kind).toBe("cut_subscription");
  });

  it("gera insight de prioridade 1 (Crítica) para conta essencial esquecida no mês", () => {
    const occ = makeOccurrence({
      key: "energia",
      name: "Energia Elétrica",
      tier: "essential",
      missingThisMonth: true,
      typicalDayOfMonth: 10,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(1);
    expect(insights[0]?.category).toBe("critical");
    expect(insights[0]?.title).toBe("Conta pendente no mês");
  });

  it("gera insight de prioridade 2 (Entrada) para salário CLT pronto para confirmação em 1 toque", () => {
    const inc = makeIncome({
      profile: "fixed",
      daysUntilExpected: 1,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      incomes: [inc],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(2);
    expect(insights[0]?.category).toBe("income");
    expect(insights[0]?.title).toBe("Confirmar recebimento");
    expect(insights[0]?.primaryAction?.kind).toBe("confirm_income");
  });

  it("gera insight de prioridade 2 (Entrada) para freelancer/cliente frequente", () => {
    const inc = makeIncome({
      profile: "frequent_client",
      daysUntilExpected: -1,
      missingThisMonth: true,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      incomes: [inc],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(2);
    expect(insights[0]?.category).toBe("income");
    expect(insights[0]?.title).toBe("Renda habitual prevista");
    expect(insights[0]?.primaryAction?.kind).toBe("open_income");
  });

  it("gera insight de prioridade 3 (Economia) para reajuste de preço e oportunidade de corte", () => {
    const occWithAdjustment = makeOccurrence({
      key: "adobe",
      name: "Adobe CC",
      priceAdjustment: {
        kind: "inflationary",
        percentIncrease: 20,
        oldCents: 10000,
        newCents: 12000,
        isInflationary: true,
        isPlanChange: false,
        label: "Reajuste inflacionário",
      },
    });

    const occVampire = makeOccurrence({
      key: "streaming-antigo",
      name: "Streaming Antigo",
      tier: "can_cut",
      averageCents: 4990,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occWithAdjustment, occVampire],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(2);
    expect(insights[0]?.priority).toBe(3);
    expect(insights[0]?.title).toContain("Reajuste em Adobe CC");
    expect(insights[1]?.priority).toBe(3);
    expect(insights[1]?.title).toBe("Oportunidade de economia");
  });

  it("não gera insight de economia se a ocorrência estiver ignorada no feedback", () => {
    const occ = makeOccurrence({
      key: "adobe",
      name: "Adobe CC",
      tier: "can_cut",
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      feedbackMap: { adobe: "ignore" },
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(0);
  });

  it("gera insight de prioridade 4 (Calibração) para despesa recorrente sem feedback prévio", () => {
    const occ = makeOccurrence({
      key: "academia",
      name: "Academia Bairro",
      level: "recurring",
      tier: "discretionary",
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      feedbackMap: {},
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(4);
    expect(insights[0]?.category).toBe("calibration");
    expect(insights[0]?.title).toBe("Calibração de gastos fixos");
    expect(insights[0]?.primaryAction?.kind).toBe("confirm_recurrence");
    expect(insights[0]?.secondaryAction?.kind).toBe("ignore_recurrence");
  });

  it("não gera calibração se a despesa já possuir feedback ou já estiver coberta por prioridade superior", () => {
    const occConfirmed = makeOccurrence({
      key: "academia",
      name: "Academia Bairro",
      level: "recurring",
      tier: "essential",
    });
    const occWithDup = makeOccurrence({
      key: "spotify",
      name: "Spotify",
      level: "recurring",
      tier: "essential",
      duplicateChargesThisMonth: 2,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occConfirmed, occWithDup],
      feedbackMap: { academia: "confirm" },
      todayISO: "2026-10-22",
    });

    // Deve ter apenas a cobrança duplicada (Prioridade 1), sem calibração duplicada
    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(1);
    expect(insights[0]?.themeKey).toBe("dup:spotify");
  });
});

describe("filterAndRankAdvisorInsights", () => {
  const insightCrit: SmartAdvisorInsight = {
    id: "dup:netflix",
    themeKey: "dup:netflix",
    priority: 1,
    category: "critical",
    title: "Cobrança duplicada",
    description: "2 cobranças no mês",
    iconName: "alert-triangle",
    metadata: { valueCents: 5590 },
  };

  const insightIncome: SmartAdvisorInsight = {
    id: "income:salario",
    themeKey: "income:salario",
    priority: 2,
    category: "income",
    title: "Confirmar salário",
    description: "Salário previsto",
    iconName: "arrow-down-left",
    metadata: { valueCents: 750000 },
  };

  const insightSavings: SmartAdvisorInsight = {
    id: "savings:vampire",
    themeKey: "savings:vampire",
    priority: 3,
    category: "savings",
    title: "Gasto vampiro",
    description: "Economia anual",
    iconName: "trending-down",
    metadata: { annualSavingsCents: 60000 },
  };

  const insightCalib: SmartAdvisorInsight = {
    id: "calib:padaria",
    themeKey: "calib:padaria",
    priority: 4,
    category: "calibration",
    title: "Calibrar padaria",
    description: "Gasto fixo?",
    iconName: "help-circle",
    metadata: { valueCents: 2000 },
  };

  it("retorna null quando a lista de candidatos for vazia", () => {
    const result = filterAndRankAdvisorInsights([]);
    expect(result).toBeNull();
  });

  it("respeita o limite estrito de 1 insight por dia (retorna null se dispensado hoje)", () => {
    const result = filterAndRankAdvisorInsights([insightCrit, insightIncome], {
      currentDayISO: "2026-10-22",
      lastDismissedDay: "2026-10-22",
    });

    expect(result).toBeNull();
  });

  it("exibe insight se a dispensa anterior tiver ocorrido em outro dia", () => {
    const result = filterAndRankAdvisorInsights([insightIncome], {
      currentDayISO: "2026-10-22",
      lastDismissedDay: "2026-10-21",
    });

    expect(result).toEqual(insightIncome);
  });

  it("filtra tema em cooldown de 30 dias", () => {
    const nowMs = 1700000000000;
    const result = filterAndRankAdvisorInsights([insightCrit, insightIncome], {
      dismissals: {
        "dup:netflix": nowMs + 100000, // em cooldown
      },
      nowMs,
    });

    // Como o crítico está em cooldown, o próximo elegível (Income) é retornado
    expect(result).toEqual(insightIncome);
  });

  it("ordena estritamente pela Matriz de Prioridade (1 -> 2 -> 3 -> 4)", () => {
    const result = filterAndRankAdvisorInsights([
      insightCalib,
      insightSavings,
      insightIncome,
      insightCrit,
    ]);

    expect(result?.priority).toBe(1);
    expect(result?.id).toBe("dup:netflix");
  });

  it("desempata pelo maior valor financeiro envolvido na mesma prioridade", () => {
    const critA: SmartAdvisorInsight = {
      ...insightCrit,
      id: "dup:spotify",
      metadata: { valueCents: 2190 },
    };
    const critB: SmartAdvisorInsight = {
      ...insightCrit,
      id: "dup:celular",
      metadata: { valueCents: 8990 },
    };

    const result = filterAndRankAdvisorInsights([critA, critB]);
    expect(result?.id).toBe("dup:celular");
  });

  it("retorna null se todos os candidatos estiverem em cooldown", () => {
    const nowMs = 1700000000000;
    const result = filterAndRankAdvisorInsights([insightCrit], {
      dismissals: {
        "dup:netflix": nowMs + 50000,
      },
      nowMs,
    });

    expect(result).toBeNull();
  });
});
