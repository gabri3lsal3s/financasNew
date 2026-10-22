import { describe, expect, it } from "vitest";
import {
  applyFeedback,
  calculateRecurringTotals,
  calculateWeekdayWeekendDailyAverages,
  classifyPriceAdjustment,
  classifySubscription,
  confidenceScore,
  criticalAlerts,
  detectDuplicateChargesInMonth,
  detectIncomeRecurrences,
  detectRecurrences,
  essentialSpendingRatio,
  evaluateBudgetImpact,
  formatBRL,
  historyBonus,
  incomeConcentration,
  isSignificantTrend,
  partitionFeedback,
  savingsHealth,
  varianceOf,
  weekendSpendingRatio,
  type ExpenseLike,
  type IncomeLike,
} from "./index";

import type { CriticalAlertInput } from "./alerts";

const expense = (
  overrides: Partial<{
    id: string;
    description: string | null;
    date: string;
    time?: string;
    month: string;
    valueCents: number;
    categoryId: string;
    categoryName: string | null;
    categoryIcon: string | null;
    installmentGroupId: string | null;
  }>,
): ExpenseLike => ({
  id: overrides.id ?? "x",
  description: overrides.description ?? null,
  date: overrides.date,
  time: overrides.time,
  month: overrides.month ?? "2026-08",
  valueCents: overrides.valueCents ?? 1000,
  categoryId: overrides.categoryId ?? "cat",
  categoryName: overrides.categoryName ?? null,
  categoryIcon: overrides.categoryIcon ?? null,
  installmentGroupId: overrides.installmentGroupId ?? null,
});

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

  it("reconhece categoria de assinatura personalizada mesmo com ícone nulo", () => {
    expect(
      classifySubscription({
        name: "Minha Assinatura Xpto",
        categoryName: "Mensalidades e Serviços",
        categoryIcon: null,
        monthlyValuesCents: [5000, 5000],
      }),
    ).toMatchObject({
      confidence: 0.8,
      tier: "discretionary",
    });
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
    // Compras corriqueiras de Uber em momentos distintos não disparam falso alerta de duplicidade (Fase 4, Tarefa 4.3)
    expect(rec?.duplicateChargesThisMonth).toBeUndefined();
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

  it("não gera ocorrências do nível similar e não agrupa despesas com nomes distintos na mesma categoria", () => {
    const occurrences = detectRecurrences([
      expense({ id: "t1", description: "Cinema", month: "2026-07", valueCents: 4000, categoryId: "lazer", categoryIcon: "lazer" }),
      expense({ id: "t2", description: "Show", month: "2026-08", valueCents: 5000, categoryId: "lazer", categoryIcon: "lazer" }),
    ]);
    expect(occurrences).toHaveLength(0);
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

  it("partitionFeedback separa ativas e ignoradas para a UI", () => {
    const { active, ignored } = partitionFeedback(occurrences, { a: "ignore", b: "confirm" });
    expect(active).toHaveLength(1);
    expect(active[0]?.name).toBe("Academia");
    expect(active[0]?.confirmed).toBe(true);
    expect(ignored).toHaveLength(1);
    expect(ignored[0]?.name).toBe("Netflix");
    expect(ignored[0]?.ignored).toBe(true);
  });
});

describe("previsão de datas e segmentação de serviços", () => {
  it("calcula dia típico e estima próximo vencimento", () => {
    const occurrences = detectRecurrences(
      [
        expense({ id: "n1", description: "Netflix", date: "2026-06-12", month: "2026-06", valueCents: 3990 }),
        expense({ id: "n2", description: "Netflix", date: "2026-07-12", month: "2026-07", valueCents: 3990 }),
      ],
      { todayISO: "2026-08-08" },
    );
    const sub = occurrences.find((o) => o.name === "Netflix");
    expect(sub).toBeDefined();
    expect(sub?.segment).toBe("streaming");
    expect(sub?.typicalDayOfMonth).toBe(12);
    expect(sub?.nextDueDate).toBe("2026-08-12");
    expect(sub?.daysUntilNextDue).toBe(4);
    expect(sub?.missingThisMonth).toBe(false);
  });

  it("detecta assinatura ausente/pendente no mês quando o dia típico já passou", () => {
    const occurrences = detectRecurrences(
      [
        expense({ id: "s1", description: "Spotify", date: "2026-06-05", month: "2026-06", valueCents: 2190 }),
        expense({ id: "s2", description: "Spotify", date: "2026-07-05", month: "2026-07", valueCents: 2190 }),
      ],
      { todayISO: "2026-08-15" },
    );
    const sub = occurrences.find((o) => o.name === "Spotify");
    expect(sub).toBeDefined();
    expect(sub?.typicalDayOfMonth).toBe(5);
    expect(sub?.missingThisMonth).toBe(true);
  });

  it("classifica segmentos corretamente (fitness, cloud_ai, telecom, mobility, health)", () => {
    const occurrences = detectRecurrences([
      expense({ id: "f1", description: "Smart Fit", date: "2026-07-10", month: "2026-07", valueCents: 11990 }),
      expense({ id: "f2", description: "Smart Fit", date: "2026-08-10", month: "2026-08", valueCents: 11990 }),
      expense({ id: "c1", description: "ChatGPT Plus", date: "2026-07-20", month: "2026-07", valueCents: 10000 }),
      expense({ id: "c2", description: "ChatGPT Plus", date: "2026-08-20", month: "2026-08", valueCents: 10000 }),
      expense({ id: "t1", description: "Vivo Fibra", date: "2026-07-15", month: "2026-07", valueCents: 12000 }),
      expense({ id: "t2", description: "Vivo Fibra", date: "2026-08-15", month: "2026-08", valueCents: 12000 }),
      expense({ id: "m1", description: "Sem Parar", date: "2026-07-01", month: "2026-07", valueCents: 3500 }),
      expense({ id: "m2", description: "Sem Parar", date: "2026-08-01", month: "2026-08", valueCents: 3500 }),
      expense({ id: "h1", description: "Unimed", date: "2026-07-25", month: "2026-07", valueCents: 45000 }),
      expense({ id: "h2", description: "Unimed", date: "2026-08-25", month: "2026-08", valueCents: 45000 }),
    ]);

    expect(occurrences.find((o) => o.name === "Smart Fit")?.segment).toBe("fitness");
    expect(occurrences.find((o) => o.name === "ChatGPT Plus")?.segment).toBe("cloud_ai");
    expect(occurrences.find((o) => o.name === "Vivo Fibra")?.segment).toBe("telecom");
    expect(occurrences.find((o) => o.name === "Sem Parar")?.segment).toBe("mobility");
    expect(occurrences.find((o) => o.name === "Unimed")?.segment).toBe("health");
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

  it("concentração de renda: alerta quando 1 fonte > 60%, exceto se for fonte salarial única/declarada", () => {
    expect(incomeConcentration([700000, 300000]).alert).toBe(true);
    expect(incomeConcentration([700000, 300000]).topSharePercent).toBe(70);
    expect(incomeConcentration([500000, 500000]).alert).toBe(false);
    // Fonte única salarial estável não dispara alerta falso
    expect(incomeConcentration([500000], { isSingleSalarySource: true }).alert).toBe(false);
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

  it("calcula médias diárias de dia útil e fim de semana com dias reais decorridos", () => {
    const totals = [
      { ponderadoCents: 5000 },
      { ponderadoCents: 5000 },
      { ponderadoCents: 5000 },
      { ponderadoCents: 5000 },
      { ponderadoCents: 5000 },
      { ponderadoCents: 10000 },
      { ponderadoCents: 10000 },
    ];
    // Default 5 dias úteis e 2 fins de semana
    const { weekdayDailyCents, weekendDailyCents } = calculateWeekdayWeekendDailyAverages(totals);
    expect(weekdayDailyCents).toBe(5000);
    expect(weekendDailyCents).toBe(10000);

    // Com 10 dias úteis e 4 de fins de semana decorridos
    const calibrated = calculateWeekdayWeekendDailyAverages(totals, {
      elapsedWeekdaysCount: 10,
      elapsedWeekendDaysCount: 4,
    });
    expect(calibrated.weekdayDailyCents).toBe(2500); // 25.000 / 10
    expect(calibrated.weekendDailyCents).toBe(5000);  // 20.000 / 4
  });

  it("calcula comprometimento de gastos essenciais (Regra 50/30/20)", () => {
    // 50% ou menos -> adequado
    const r1 = essentialSpendingRatio(50_000, 100_000);
    expect(r1.ratioPercent).toBe(50);
    expect(r1.status).toBe("adequado");

    // Entre 50% e 70% -> moderado
    const r2 = essentialSpendingRatio(65_000, 100_000);
    expect(r2.ratioPercent).toBe(65);
    expect(r2.status).toBe("moderado");

    // Acima de 70% -> elevado
    const r3 = essentialSpendingRatio(80_000, 100_000);
    expect(r3.ratioPercent).toBe(80);
    expect(r3.status).toBe("elevado");

    // Despesas zeradas -> seguro
    expect(essentialSpendingRatio(0, 0).ratioPercent).toBe(0);
    expect(essentialSpendingRatio(0, 0).status).toBe("adequado");
  });
});

describe("calculateRecurringTotals", () => {
  it("calcula totais recorrentes e economia de cortes exclusivamente para subscription e recurring (expurga similar)", () => {
    const active = [
      { averageCents: 5000, tier: "can_cut" as const, savingsIfCutCents: 3000, level: "subscription" },
      { averageCents: 4000, tier: "discretionary" as const, level: "recurring" },
      { averageCents: 2000, tier: "can_cut" as const, level: "subscription" }, // sem savingsIfCutCents, defaults to averageCents
      { averageCents: 9000, tier: "can_cut" as const, savingsIfCutCents: 9000, level: "similar" }, // deve ser ignorado
    ];

    const result = calculateRecurringTotals(active);
    expect(result.totalRecurringCents).toBe(11000);
    expect(result.totalAnnualRecurringCents).toBe(132000);
    expect(result.canCutRecurringCents).toBe(5000); // 3000 + 2000 (ignora os 9000 do similar)
    expect(result.canCutAnnualCents).toBe(60000);
  });
});

describe("motor bidirecional e regras de anomalias (Fase 4, Tarefa 4.4)", () => {
  describe("detectIncomeRecurrences via barrel de insights", () => {
    it("detecta salário CLT estável com perfil fixed e sugestão one_touch_confirm", () => {
      const incomes: IncomeLike[] = [
        { id: "i1", description: "Salário Empresa X", month: "2026-07", date: "2026-07-05", valueCents: 450000, categoryId: "sal" },
        { id: "i2", description: "Salário Empresa X", month: "2026-08", date: "2026-08-05", valueCents: 450000, categoryId: "sal" },
        { id: "i3", description: "Salário Empresa X", month: "2026-09", date: "2026-09-05", valueCents: 450000, categoryId: "sal" },
      ];

      const detected = detectIncomeRecurrences(incomes, { todayISO: "2026-09-20" });
      expect(detected).toHaveLength(1);
      const sal = detected[0]!;
      expect(sal.profile).toBe("fixed");
      expect(sal.suggestedAction).toBe("one_touch_confirm");
      expect(sal.averageCents).toBe(450000);
      expect(sal.lastValueCents).toBe(450000);
    });

    it("detecta cliente frequente com perfil frequent_client e sugestão open_value_input", () => {
      const incomes: IncomeLike[] = [
        { id: "i1", description: "Freelance Design", month: "2026-07", date: "2026-07-15", valueCents: 150000, categoryId: "free" },
        { id: "i2", description: "Freelance Design", month: "2026-08", date: "2026-08-18", valueCents: 350000, categoryId: "free" },
        { id: "i3", description: "Freelance Design", month: "2026-09", date: "2026-09-12", valueCents: 200000, categoryId: "free" },
      ];

      const detected = detectIncomeRecurrences(incomes);
      expect(detected).toHaveLength(1);
      const free = detected[0]!;
      expect(free.profile).toBe("frequent_client");
      expect(free.suggestedAction).toBe("open_value_input");
    });
  });

  describe("evaluateBudgetImpact e formatBRL via barrel de insights", () => {
    it("avalia impacto orçamentário anual de assinatura", () => {
      const impact = evaluateBudgetImpact({ name: "Assinatura Clube", averageCents: 9000 }, 1000000, 30000);
      expect(impact.annualCostCents).toBe(108000);
      expect(impact.annualCostFormatted).toBe("R$ 1.080,00");
      expect(impact.annualCostMessage).toBe("Essa assinatura custa R$ 1.080,00 por ano");
      expect(impact.highCategoryBudgetImpact).toBe(true);
      expect(impact.hasHighBudgetImpact).toBe(true);
      expect(formatBRL(108000)).toBe("R$ 1.080,00");
    });
  });

  describe("classifyPriceAdjustment e detectDuplicateChargesInMonth via barrel de insights", () => {
    it("classifica reajuste inflacionário e mudança de plano", () => {
      const inf = classifyPriceAdjustment(10000, 12000);
      expect(inf?.kind).toBe("inflationary");
      expect(inf?.isInflationary).toBe(true);

      const plan = classifyPriceAdjustment(10000, 16000);
      expect(plan?.kind).toBe("plan_change");
      expect(plan?.isPlanChange).toBe(true);
    });

    it("discrimina duplicidade estrita entre assinaturas e gastos comuns", () => {
      // Assinatura de valor fixo cobrada 2x
      const subCharges: ExpenseLike[] = [
        expense({ id: "s1", date: "2026-08-05", valueCents: 3990 }),
        expense({ id: "s2", date: "2026-08-20", valueCents: 3990 }),
      ];
      expect(detectDuplicateChargesInMonth(subCharges, true)).toBe(2);

      // Compras comuns em dias diferentes (não duplicadas)
      const commonChargesDiffDays: ExpenseLike[] = [
        expense({ id: "c1", date: "2026-08-05", valueCents: 2000 }),
        expense({ id: "c2", date: "2026-08-20", valueCents: 2000 }),
      ];
      expect(detectDuplicateChargesInMonth(commonChargesDiffDays, false)).toBeUndefined();

      // Compras comuns no mesmo dia e minuto (duplicadas)
      const commonChargesSameMinute: ExpenseLike[] = [
        expense({ id: "c3", date: "2026-08-10", time: "14:30", valueCents: 2500 }),
        expense({ id: "c4", date: "2026-08-10", time: "14:30", valueCents: 2500 }),
      ];
      expect(detectDuplicateChargesInMonth(commonChargesSameMinute, false)).toBe(2);
    });
  });
});

