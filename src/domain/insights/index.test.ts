import { describe, expect, it } from "vitest";
import { applyFeedback, classifySubscription, confidenceScore, criticalAlerts, detectRecurrences, historyBonus, incomeConcentration, isSignificantTrend, savingsHealth, varianceOf, weekendSpendingRatio } from "./index";
import type { CriticalAlertInput } from "./alerts";

describe("criticalAlerts (§3.7.1 — prioridade)", () => {
  const base: CriticalAlertInput = {
    balanceCents: 100000,
    incomeCents: 500000,
    paceRatio: 1,
    overspentBudgets: 0,
    burnRatePercent: 60,
    projectedDeficit: false,
    savingsRatePercent: 20,
  };

  it("saldo negativo é o alerta prioritário (1)", () => {
    const alerts = criticalAlerts({ ...base, balanceCents: -100 });
    expect(alerts[0]?.id).toBe("saldo_negativo");
    expect(alerts[0]?.priority).toBe(1);
  });

  it("ritmo > 5% acima do esperado (2)", () => {
    const alerts = criticalAlerts({ ...base, paceRatio: 1.06 });
    expect(alerts.some((a) => a.id === "ritmo_gastos")).toBe(true);
    expect(alerts.find((a) => a.id === "ritmo_gastos")?.priority).toBe(2);
  });

  it("limites estourados (3) e burn rate > 85% (4)", () => {
    const alerts = criticalAlerts({ ...base, overspentBudgets: 2, burnRatePercent: 90 });
    expect(alerts.find((a) => a.id === "limites_estourados")?.priority).toBe(3);
    expect(alerts.find((a) => a.id === "burn_rate")?.priority).toBe(4);
    expect(alerts.find((a) => a.id === "limites_estourados")?.description).toContain("2 categorias");
  });

  it("déficit projetado (5) e elogio por poupança ≥ 20% (6)", () => {
    const alerts = criticalAlerts({ ...base, projectedDeficit: true });
    expect(alerts.find((a) => a.id === "deficit_projetado")?.priority).toBe(5);
    expect(alerts.find((a) => a.id === "poupanca_saudavel")?.priority).toBe(6);
    expect(alerts.find((a) => a.id === "poupanca_saudavel")?.severity).toBe("praise");
  });

  it("ordena por prioridade e emite apenas os verdadeiros", () => {
    const alerts = criticalAlerts({ ...base, paceRatio: 1.06 });
    const priorities = alerts.map((a) => a.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(alerts.some((a) => a.id === "burn_rate")).toBe(false);
  });
});

describe("assinaturas (§3.7.2 — 3 sinais + tiers)", () => {
  it("reconhece nome conhecido e categoria de assinatura", () => {
    expect(classifySubscription({ name: "Netflix", categoryIcon: "assinaturas", monthlyValuesCents: [3990, 3990, 3990] })).toMatchObject({
      confidence: 0.98,
      tier: "can_cut",
      savingsIfCutCents: 3990,
    });
  });

  it("2 sinais → confiança 0.80; 1 sinal → 0.60", () => {
    expect(classifySubscription({ name: "Netflix", categoryIcon: null, monthlyValuesCents: [3990, 4000] })?.confidence).toBe(0.8);
    // Nome conhecido sozinho (valor instável) → 1 sinal → 0.60.
    expect(classifySubscription({ name: "Spotify", categoryIcon: null, monthlyValuesCents: [1990, 3000] })?.confidence).toBe(0.6);
  });

  it("sem nenhum sinal → null (não é assinatura)", () => {
    expect(classifySubscription({ name: "Aluguel", categoryIcon: "moradia", monthlyValuesCents: [200000] })).toBeNull();
    // Prevenção de falsos positivos com chaves curtas:
    expect(classifySubscription({ name: "Maxxi Atacado", categoryIcon: null, monthlyValuesCents: [15000, 15000] })).toBeNull();
    expect(classifySubscription({ name: "Biscoito Bauducco", categoryIcon: null, monthlyValuesCents: [1500, 1500] })).toBeNull();
    expect(classifySubscription({ name: "Estimativa", categoryIcon: null, monthlyValuesCents: [2000, 2000] })).toBeNull();
  });

  it("reconhece serviços nacionais expandidos (smartfit, semparar, unimed)", () => {
    expect(classifySubscription({ name: "Smart Fit Mensalidade", categoryIcon: null, monthlyValuesCents: [11990, 11990] })).toMatchObject({
      tier: "discretionary",
    });
    expect(classifySubscription({ name: "Sem Parar", categoryIcon: null, monthlyValuesCents: [3500, 3500] })).toMatchObject({
      tier: "discretionary",
    });
    expect(classifySubscription({ name: "Unimed Plano", categoryIcon: null, monthlyValuesCents: [45000, 45000] })).toMatchObject({
      tier: "essential",
    });
  });

  it("serviços essenciais nunca são cortáveis", () => {
    expect(classifySubscription({ name: "Internet fibra", categoryIcon: "internet", monthlyValuesCents: [9990, 9990] })?.tier).toBe("essential");
  });

  it("valor estável respeita a tolerância de ±5%", () => {
    expect(classifySubscription({ name: "Spotify", categoryIcon: null, monthlyValuesCents: [1990, 2000, 2050] })?.confidence).toBe(0.8);
    // Valor fora da tolerância derruba o sinal de estabilidade (só resta o nome → 0.60).
    expect(classifySubscription({ name: "Spotify", categoryIcon: null, monthlyValuesCents: [1990, 3000] })?.signs.stableValue).toBe(false);
  });
});

describe("confiança (§3.7.4 — bônus e penalidade)", () => {
  it("bônus não-linear por meses de histórico (2m:+0.05, 5m:+0.28)", () => {
    expect(historyBonus(1)).toBe(0);
    expect(historyBonus(2)).toBe(0.05);
    expect(historyBonus(5)).toBe(0.28);
    expect(historyBonus(12)).toBe(0.28); // estaciona
  });

  it("penalidade de variância (0.3× subscription, 0.8× recurring)", () => {
    const sub = confidenceScore({ base: 0.7, monthsHistory: 3, kind: "subscription", variance: 0.1 });
    const rec = confidenceScore({ base: 0.7, monthsHistory: 3, kind: "recurring", variance: 0.1 });
    expect(sub).toBeCloseTo(0.82 - 0.03);
    expect(rec).toBeCloseTo(0.82 - 0.08);
  });

  it("limita a [0, 1]", () => {
    expect(confidenceScore({ base: 1, monthsHistory: 5, kind: "subscription", variance: 0 })).toBe(1);
    expect(confidenceScore({ base: 0, monthsHistory: 1, kind: "recurring", variance: 1 })).toBe(0);
  });

  it("varianceOf normaliza a dispersão (0–1)", () => {
    expect(varianceOf([1000, 1000, 1000])).toBe(0);
    expect(varianceOf([1000, 2000])).toBeCloseTo(1 / 3);
    expect(varianceOf([])).toBe(0);
  });
});

describe("recorrências (§3.7.3 — 3 níveis)", () => {
  const expense = (overrides: Partial<{ id: string; description: string | null; month: string; valueCents: number; categoryId: string; categoryIcon: string | null; installmentGroupId: string | null }>) => ({
    id: overrides.id ?? "x",
    description: overrides.description ?? null,
    month: overrides.month ?? "2026-08",
    valueCents: overrides.valueCents ?? 1000,
    categoryId: overrides.categoryId ?? "cat",
    categoryIcon: overrides.categoryIcon ?? null,
    installmentGroupId: overrides.installmentGroupId ?? null,
  });

  it("detecta subscription (nome conhecido + valor estável)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "a1", description: "Netflix", month: "2026-06", valueCents: 3990 }),
      expense({ id: "a2", description: "Netflix", month: "2026-07", valueCents: 3990 }),
      expense({ id: "a3", description: "Netflix", month: "2026-08", valueCents: 3990 }),
    ]);
    const sub = occurrences.find((o) => o.level === "subscription");
    expect(sub).toBeDefined();
    expect(sub?.averageCents).toBe(3990);
    expect(sub?.months).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(sub?.tier).toBe("can_cut");
  });

  it("agrega despesas múltiplas no mesmo mês corretamente", () => {
    // 2 compras de R$ 20 em Junho (R$ 40) e 3 compras de R$ 20 em Julho (R$ 60 no mês).
    // A média mensal real deve ser (40 + 60) / 2 = R$ 50 (5000 centavos).
    const occurrences = detectRecurrences([
      expense({ id: "u1", description: "Uber Viagem", month: "2026-06", valueCents: 2000 }),
      expense({ id: "u2", description: "Uber Viagem", month: "2026-06", valueCents: 2000 }),
      expense({ id: "u3", description: "Uber Viagem", month: "2026-07", valueCents: 2000 }),
      expense({ id: "u4", description: "Uber Viagem", month: "2026-07", valueCents: 2000 }),
      expense({ id: "u5", description: "Uber Viagem", month: "2026-07", valueCents: 2000 }),
    ]);
    const rec = occurrences.find((o) => o.name === "Uber Viagem");
    expect(rec).toBeDefined();
    expect(rec?.averageCents).toBe(5000);
    expect(rec?.duplicateChargesThisMonth).toBe(3);
  });

  it("detecta reajuste de preço (aumento >= 10% vs histórico)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "r1", description: "Spotify", month: "2026-06", valueCents: 1990 }),
      expense({ id: "r2", description: "Spotify", month: "2026-07", valueCents: 1990 }),
      expense({ id: "r3", description: "Spotify", month: "2026-08", valueCents: 2790 }), // +40%
    ]);
    const sub = occurrences.find((o) => o.name === "Spotify");
    expect(sub?.priceAdjustment).toBeDefined();
    expect(sub?.priceAdjustment?.percentIncrease).toBe(40);
    expect(sub?.priceAdjustment?.oldCents).toBe(1990);
    expect(sub?.priceAdjustment?.newCents).toBe(2790);
  });

  it("detecta recurring (mesma descrição, valor ±50%)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "b1", description: "Condominio", month: "2026-07", valueCents: 8000 }),
      expense({ id: "b2", description: "Condominio", month: "2026-08", valueCents: 10000 }), // +25%
    ]);
    const rec = occurrences.find((o) => o.level === "recurring");
    expect(rec).toBeDefined();
    expect(rec?.averageCents).toBe(9000);
  });

  it("mantém serviço conhecido com REAJUSTE grande (variância > ±50%) como assinatura", () => {
    const occurrences = detectRecurrences([
      expense({ id: "c1", description: "Netflix", month: "2026-06", valueCents: 2190 }),
      expense({ id: "c2", description: "Netflix", month: "2026-07", valueCents: 5590 }),
    ]);
    const sub = occurrences.find((o) => o.level === "subscription");
    expect(sub).toBeDefined();
    expect(sub?.name).toBe("Netflix");
    expect(sub?.averageCents).toBe((2190 + 5590) / 2);
    expect(sub!.confidence).toBeLessThan(0.98);
    expect(sub!.confidence).toBeGreaterThan(0);
  });

  it("detecta recurring com fatura VARIÁVEL (tolerância relativa à mediana)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "d1", description: "Água", month: "2026-06", valueCents: 8000 }),
      expense({ id: "d2", description: "Água", month: "2026-07", valueCents: 13000 }),
      expense({ id: "d3", description: "Água", month: "2026-08", valueCents: 9500 }),
    ]);
    const rec = occurrences.find((o) => o.level === "recurring");
    expect(rec).toBeDefined();
    expect(rec?.name).toBe("Água");
  });

  it("novos serviços do catálogo são reconhecidos (globoplay, crunchyroll, alura)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "e1", description: "Globoplay", month: "2026-07", valueCents: 2990 }),
      expense({ id: "e2", description: "Globoplay", month: "2026-08", valueCents: 2990 }),
      expense({ id: "f1", description: "Crunchyroll", month: "2026-07", valueCents: 1990 }),
      expense({ id: "f2", description: "Crunchyroll", month: "2026-08", valueCents: 1990 }),
      expense({ id: "g1", description: "Alura", month: "2026-07", valueCents: 7500 }),
      expense({ id: "g2", description: "Alura", month: "2026-08", valueCents: 7500 }),
    ]);
    const names = occurrences.filter((o) => o.level === "subscription").map((o) => o.name);
    expect(names).toEqual(expect.arrayContaining(["Globoplay", "Crunchyroll", "Alura"]));
  });

  it("filtra parcelas (parcelamento não é recorrência)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "p1", description: "iPhone 12x", month: "2026-06", valueCents: 50000, installmentGroupId: "g1" }),
      expense({ id: "p2", description: "iPhone 12x", month: "2026-07", valueCents: 50000, installmentGroupId: "g1" }),
      expense({ id: "p3", description: "iPhone 12x", month: "2026-08", valueCents: 50000, installmentGroupId: "g1" }),
    ]);
    expect(occurrences).toHaveLength(0);
  });

  it("exclui categorias agregadoras do nível similar", () => {
    const occurrences = detectRecurrences([
      expense({ id: "s1", description: "Mercado", month: "2026-07", valueCents: 20000, categoryId: "mercado", categoryIcon: "mercado" }),
      expense({ id: "s2", description: "Mercado", month: "2026-08", valueCents: 21000, categoryId: "mercado", categoryIcon: "mercado" }),
    ]);
    expect(occurrences.some((o) => o.level === "similar")).toBe(false);
  });

  it("detecta similar pela categoria com total ±30%", () => {
    const occurrences = detectRecurrences([
      expense({ id: "t1", description: "Cinema", month: "2026-07", valueCents: 4000, categoryId: "lazer", categoryIcon: "lazer" }),
      expense({ id: "t2", description: "Show", month: "2026-08", valueCents: 5000, categoryId: "lazer", categoryIcon: "lazer" }),
    ]);
    const sim = occurrences.find((o) => o.level === "similar");
    expect(sim).toBeDefined();
    expect(sim?.averageCents).toBe(4500);
  });
});


describe("aprendizado (§3.7.4 — ignorar/confirmar/restaurar)", () => {
  const occurrences = [
    { key: "a", name: "Netflix" },
    { key: "b", name: "Academia" },
  ];

  it("ignorada deixa de contar; confirmada é marcada", () => {
    const result = applyFeedback(occurrences, { a: "ignore", b: "confirm" });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe("b");
    expect(result[0]?.confirmed).toBe(true);
  });

  it("sem feedback, nada é filtrado", () => {
    expect(applyFeedback(occurrences, {})).toHaveLength(2);
  });
});

describe("diagnósticos (§3.7.6)", () => {
  it("saúde da poupança por faixa", () => {
    expect(savingsHealth(-5)).toBe("critico");
    expect(savingsHealth(5)).toBe("baixo");
    expect(savingsHealth(15)).toBe("moderado");
    expect(savingsHealth(25)).toBe("saudavel");
    expect(savingsHealth(35)).toBe("forte");
  });

  it("concentração de renda: alerta quando 1 fonte > 60%", () => {
    expect(incomeConcentration([700000, 300000]).alert).toBe(true);
    expect(incomeConcentration([700000, 300000]).topSharePercent).toBe(70);
    expect(incomeConcentration([500000, 500000]).alert).toBe(false);
  });

  it("ratio de fim de semana > 1.5 alerta", () => {
    expect(weekendSpendingRatio(10000, 16000) > 1.5).toBe(true);
    expect(weekendSpendingRatio(10000, 10000)).toBe(1);
    // Sem gasto em dia útil → incomparável (Infinity); sem gastos → 0.
    expect(weekendSpendingRatio(0, 5000)).toBe(Number.POSITIVE_INFINITY);
    expect(weekendSpendingRatio(0, 0)).toBe(0);
  });

  it("tendência significativa acima de 15%", () => {
    expect(isSignificantTrend(120000, 100000)).toBe(true);
    expect(isSignificantTrend(110000, 100000)).toBe(false);
  });
});
