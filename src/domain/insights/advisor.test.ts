import { describe, expect, it } from "vitest";
import {
  filterAndRankAdvisorInsights,
  filterAndRankAllAdvisorInsights,
  generateSmartAdvisorInsights,
  type SmartAdvisorInsight,
} from "./advisor";
import type { ExpenseLike, RecurrenceOccurrence, RecurringIncomeOccurrence } from "./recurrences";

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
    expect(insights[0]?.priority).toBe(2);
    expect(insights[0]?.category).toBe("critical");
    expect(insights[0]?.title).toBe("Conta pendente no mês");
    expect(insights[0]?.primaryAction?.kind).toBe("register_expense");
    expect(insights[0]?.primaryAction?.payload).toEqual(
      expect.objectContaining({
        name: "Energia Elétrica",
        valueCents: 5590,
        date: "2026-10-10",
      }),
    );
  });

  it("gera insight com confirmação expressa (confirm_expense) para assinatura/compromisso fixo altamente previsível (F27)", () => {
    const occ = makeOccurrence({
      key: "netflix",
      name: "Netflix",
      tier: "can_cut",
      segment: "streaming",
      missingThisMonth: true,
      typicalDayOfMonth: 12,
      categoryId: "cat-streaming",
      cardId: "card-nubank",
      averageCents: 5590,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.primaryAction?.kind).toBe("confirm_expense");
    expect(insights[0]?.primaryAction?.label).toBe("Confirmar pagamento");
    expect(insights[0]?.primaryAction?.payload).toEqual(
      expect.objectContaining({
        name: "Netflix",
        valueCents: 5590,
        categoryId: "cat-streaming",
        cardId: "card-nubank",
        date: "2026-10-12",
      }),
    );
  });

  it("enriquece insight com contexto de fatura e limite restante do cartão de crédito (F28)", () => {
    const occ = makeOccurrence({
      key: "netflix",
      name: "Netflix",
      tier: "can_cut",
      segment: "streaming",
      missingThisMonth: true,
      typicalDayOfMonth: 12,
      categoryId: "cat-streaming",
      cardId: "card-nubank",
      averageCents: 5590,
    });

    const card = {
      id: "card-nubank",
      name: "Nubank Roxinho",
      closing_day: 27, // Hoje é 22 -> fecha em 5 dias
      credit_limit: 5000, // R$ 5.000,00
      availableLimitCents: 150000, // R$ 1.500,00 disponível
    };

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
      cards: [card],
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.cardContext).toBeDefined();
    expect(insights[0]?.cardContext).toEqual(
      expect.objectContaining({
        cardId: "card-nubank",
        cardName: "Nubank Roxinho",
        availableLimitCents: 150000,
        totalLimitCents: 500000,
        daysUntilClosing: 5,
        closingLabel: "Fecha em 5 dias",
        isSeverelyCompromised: false,
        exceedsAvailableLimit: false,
      }),
    );
  });

  it("sinaliza comprometimento severo (>= 90% do limite) com destaque preventivo (F28)", () => {
    const occ = makeOccurrence({
      key: "spotify",
      name: "Spotify",
      tier: "can_cut",
      segment: "streaming",
      missingThisMonth: true,
      categoryId: "cat-streaming",
      cardId: "card-itau",
      averageCents: 3490,
    });

    const card = {
      id: "card-itau",
      name: "Itaú Click",
      closing_day: 25,
      credit_limit: 1000, // R$ 1.000
      availableLimitCents: 8000, // R$ 80 restantes (92% usado >= 90%)
    };

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
      cards: [card],
    });

    expect(insights[0]?.cardContext?.isSeverelyCompromised).toBe(true);
    expect(insights[0]?.cardContext?.exceedsAvailableLimit).toBe(false);
    expect(insights[0]?.cardContext?.orientationMessage).toContain("90% do limite comprometido");
  });

  it("sinaliza risco crítico de recusa quando o valor da conta supera o limite disponível (F28)", () => {
    const occ = makeOccurrence({
      key: "academia-vip",
      name: "Academia VIP",
      tier: "can_cut",
      segment: "fitness",
      missingThisMonth: true,
      categoryId: "cat-fitness",
      cardId: "card-c6",
      averageCents: 25000, // R$ 250,00
    });

    const card = {
      id: "card-c6",
      name: "C6 Carbon",
      closing_day: 28,
      credit_limit: 2000,
      availableLimitCents: 10000, // R$ 100,00 disponível (despesa de 250 > 100)
    };

    const insights = generateSmartAdvisorInsights({
      occurrences: [occ],
      todayISO: "2026-10-22",
      cards: [card],
    });

    expect(insights[0]?.cardContext?.exceedsAvailableLimit).toBe(true);
    expect(insights[0]?.cardContext?.isSeverelyCompromised).toBe(true);
    expect(insights[0]?.cardContext?.orientationMessage).toContain("Risco de recusa");
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

  it("gera alerta discreto quando a renda passou da data habitual sem entrada no mês (Eixo 2)", () => {
    const inc = makeIncome({
      name: "Salário Empresa X",
      profile: "fixed",
      typicalDayOfMonth: 5,
      missingThisMonth: true,
      daysUntilExpected: -3,
    });

    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      incomes: [inc],
      todayISO: "2026-10-08",
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]?.priority).toBe(2);
    expect(insights[0]?.category).toBe("income");
    expect(insights[0]?.description).toBe(
      "Renda de Salário Empresa X prevista para o dia 5 ainda não foi identificada no mês.",
    );
    expect(insights[0]?.primaryAction?.kind).toBe("confirm_income");
  });

  it("gera oportunidade de 1 clique para aporte e rebalanceamento quando há poupança no mês (Eixo 3)", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-22",
      savingsSurplusCents: 85000, // R$ 850,00
      plannedAporteCents: 50000, // R$ 500,00
      currentMonthAportesCents: 0,
    });

    const aporteInsight = insights.find((i) => i.id === "aporte:rebalance");
    expect(aporteInsight).toBeDefined();
    expect(aporteInsight?.priority).toBe(3);
    expect(aporteInsight?.category).toBe("savings");
    expect(aporteInsight?.title).toBe("Aporte para rebalanceamento");
    expect(aporteInsight?.description).toBe(
      "Você poupou R$ 850,00 neste mês. Deseja realizar o aporte planejado para rebalancear sua carteira?",
    );
    expect(aporteInsight?.primaryAction?.kind).toBe("navigate_aporte");
    expect(aporteInsight?.primaryAction?.payload).toEqual({ valorCents: 50000 });
  });

  it("não sugere aporte se já tiver sido realizado o valor planejado no mês", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-22",
      savingsSurplusCents: 85000,
      plannedAporteCents: 50000,
      currentMonthAportesCents: 50000,
    });

    const aporteInsight = insights.find((i) => i.id === "aporte:rebalance");
    expect(aporteInsight).toBeUndefined();
  });

  it("não sugere aporte quando as obrigações do ciclo superam a sobra operacional (cenário do dia 7)", () => {
    // Renda R$ 3.244,24 - Despesas pagas R$ 469,69 = sobra de R$ 2.774,55
    // Mas faturas a pagar = R$ 2.959,81
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-07",
      savingsSurplusCents: 277455,
      committedObligationsCents: 295981,
      safeToSpendCents: 71534,
    });

    const aporteInsight = insights.find((i) => i.id === "aporte:rebalance");
    expect(aporteInsight).toBeUndefined();
  });

  it("limita o aporte sugerido ao Saldo Livre Real e adapta a descrição para obrigações do ciclo", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-07",
      savingsSurplusCents: 200000, // R$ 2.000,00 de sobra
      committedObligationsCents: 50000, // R$ 500,00 de obrigações -> sobra líquida = R$ 1.500,00
      safeToSpendCents: 71534, // Saldo Livre Real de R$ 715,34
    });

    const aporteInsight = insights.find((i) => i.id === "aporte:rebalance");
    expect(aporteInsight).toBeDefined();
    expect(aporteInsight?.description).toContain("Você possui R$ 715,34 de saldo livre real após cobrir as obrigações do ciclo.");
    expect(aporteInsight?.primaryAction?.payload).toEqual({ valorCents: 71534 });
  });

  it("não sugere aporte quando o Saldo Livre Real em conta é zero ou negativo", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-07",
      savingsSurplusCents: 150000,
      safeToSpendCents: -50000, // conta no vermelho
    });

    const aporteInsight = insights.find((i) => i.id === "aporte:rebalance");
    expect(aporteInsight).toBeUndefined();
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

  it("respeita o limite de dispensa diária para itens regulares (retorna null se dispensado hoje)", () => {
    const result = filterAndRankAdvisorInsights([insightSavings, insightIncome], {
      currentDayISO: "2026-10-22",
      lastDismissedDay: "2026-10-22",
    });

    expect(result).toBeNull();
  });

  it("permite que insight crítico de prioridade 1 apareça mesmo se o dia estiver silenciado para itens regulares", () => {
    const result = filterAndRankAdvisorInsights([insightCrit, insightIncome], {
      currentDayISO: "2026-10-22",
      lastDismissedDay: "2026-10-22",
    });

    expect(result).toEqual(insightCrit);
  });

  it("retorna lista completa ordenada de todos os insights elegíveis em filterAndRankAllAdvisorInsights", () => {
    const all = filterAndRankAllAdvisorInsights([
      insightCalib,
      insightSavings,
      insightIncome,
      insightCrit,
    ]);

    expect(all).toHaveLength(4);
    expect(all.map((i) => i.priority)).toEqual([1, 2, 3, 4]);
    expect(all[0]?.id).toBe("dup:netflix");
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

  it("gera insight de prioridade 1 (Crítica) para compromisso anual previsto com até 30 dias de antecedência", () => {
    const expenses = [
      {
        id: "exp-ipva-2025",
        description: "IPVA SP",
        date: "2025-01-20",
        month: "2025-01",
        valueCents: 185000,
        categoryId: "cat-impostos",
      },
    ];

    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-01-05", // faltam 15 dias para 2026-01-20
      allExpenses: expenses,
    });

    const annualInsight = insights.find((i) => i.id === "annual:ipva");
    expect(annualInsight).toBeDefined();
    expect(annualInsight?.priority).toBe(3);
    expect(annualInsight?.category).toBe("savings");
    expect(annualInsight?.title).toBe("Compromisso anual previsto");
    expect(annualInsight?.description).toBe(
      "No ano passado você pagou R$ 1.850,00 de IPVA em Janeiro. Deseja provisionar este valor?",
    );
    expect(annualInsight?.primaryAction?.label).toBe("Provisionar pagamento");
  });

  it("gera insight de prioridade 3 (Economia/Conscientização) para compromisso semanal", () => {
    const expenses = [
      { id: "t1", description: "Terapia", date: "2026-09-01", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" },
      { id: "t2", description: "Terapia", date: "2026-09-08", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" },
      { id: "t3", description: "Terapia", date: "2026-09-15", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" },
      { id: "t4", description: "Terapia", date: "2026-09-22", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" },
    ];

    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-09-25",
      allExpenses: expenses,
    });

    const weeklyInsight = insights.find((i) => i.id === "weekly:terapia");
    expect(weeklyInsight).toBeDefined();
    expect(weeklyInsight?.priority).toBe(3);
    expect(weeklyInsight?.category).toBe("savings");
    expect(weeklyInsight?.title).toBe("Compromisso semanal: Terapia");
    expect(weeklyInsight?.description).toContain("600,00 por mês");
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

  it("gera insight de prioridade 1 (Crítica) para teto familiar estourado", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-15",
      household: {
        family: { id: "fam-1", name: "Família Silva", owner_id: "user-1", monthly_budget_cents: 500000, split_rule: "equal" },
        month: "2026-10",
        monthly_ceiling_cents: 500000,
        total_spent_cents: 550000,
        total_income_cents: 800000,
        remaining_cents: -50000,
        spent_percentage: 110,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: null,
        has_post_settlement_expenses: false,
      },
    });

    const ceilingInsight = insights.find((i) => i.id === "household:ceiling_exceeded");
    expect(ceilingInsight).toBeDefined();
    expect(ceilingInsight?.priority).toBe(1);
    expect(ceilingInsight?.category).toBe("critical");
    expect(ceilingInsight?.primaryAction?.kind).toBe("navigate_family");
  });

  it("gera insight de prioridade 2 (Entrada) para acerto Pix familiar pendente", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-28",
      currentUserId: "user-1",
      household: {
        family: { id: "fam-1", name: "Família Silva", owner_id: "user-1", monthly_budget_cents: 500000, split_rule: "equal" },
        month: "2026-10",
        monthly_ceiling_cents: 500000,
        total_spent_cents: 300000,
        total_income_cents: 800000,
        remaining_cents: 200000,
        spent_percentage: 60,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: {
          id: "set-1",
          month: "2026-10",
          payer_id: "user-2",
          payer_name: "Mariana",
          receiver_id: "user-1",
          receiver_name: "Gabriel",
          amount_cents: 45000,
          settled_at: "2026-10-28",
          payment_method: "pix",
          notes: null,
          created_at: "2026-10-28",
        },
        has_post_settlement_expenses: false,
      },
    });

    const setInsight = insights.find((i) => i.id === "household:settlement_pending");
    expect(setInsight).toBeDefined();
    expect(setInsight?.priority).toBe(2);
    expect(setInsight?.category).toBe("income");
    expect(setInsight?.description).toContain("450,00 a receber de Mariana");
    expect(setInsight?.primaryAction?.kind).toBe("open_family_settlement");
  });

  it("classifica acerto familiar pendente como critical/alert-triangle (nunca income) quando usuário é pagador", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-28",
      currentUserId: "user-2",
      household: {
        family: { id: "fam-1", name: "Família Silva", owner_id: "user-1", monthly_budget_cents: 500000, split_rule: "equal" },
        month: "2026-10",
        monthly_ceiling_cents: 500000,
        total_spent_cents: 300000,
        total_income_cents: 800000,
        remaining_cents: 200000,
        spent_percentage: 60,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: {
          id: "set-1",
          month: "2026-10",
          payer_id: "user-2",
          payer_name: "Mariana",
          receiver_id: "user-1",
          receiver_name: "Gabriel",
          amount_cents: 45000,
          settled_at: "2026-10-28",
          payment_method: "pix",
          notes: null,
          created_at: "2026-10-28",
        },
        has_post_settlement_expenses: false,
      },
    });

    const setInsight = insights.find((i) => i.id === "household:settlement_pending");
    expect(setInsight).toBeDefined();
    expect(setInsight?.priority).toBe(2);
    expect(setInsight?.category).toBe("critical");
    expect(setInsight?.iconName).toBe("alert-triangle");
    expect(setInsight?.description).toContain("450,00 pendente para Gabriel");
  });

  it("gera insight de prioridade 2 (Entrada) para meta de receita em atraso no fim do mês", () => {
    const realizedMap = new Map([["cat-pj", 100000]]);
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-25",
      incomeGoals: [
        { id: "g1", user_id: "u1", category_id: "cat-pj", month: "2026-10", expected: 3000 },
      ],
      realizedIncomeByCategory: realizedMap,
    });

    const goalInsight = insights.find((i) => i.id === "income_goal:g1");
    expect(goalInsight).toBeDefined();
    expect(goalInsight?.priority).toBe(2);
    expect(goalInsight?.category).toBe("income");
    expect(goalInsight?.title).toBe("Meta de receita abaixo do ritmo");
  });

  it("não gera insight para meta de receita pertencente a outro mês (isolamento estrito de competência)", () => {
    const realizedMap = new Map([["cat-pj", 0]]);
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-20",
      incomeGoals: [
        { id: "g1", user_id: "u1", category_id: "cat-pj", month: "2026-10", expected: 1000 },
      ],
      realizedIncomeByCategory: realizedMap,
    });

    const goalInsight = insights.find((i) => i.id === "income_goal:g1");
    expect(goalInsight).toBeUndefined();
  });

  it("não gera insight se a categoria estiver inativa ou não for do tipo income", () => {
    const realizedMap = new Map([["cat-pj", 0]]);
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-20",
      categories: [
        {
          id: "cat-pj",
          name: "Serviços PJ",
          is_active: false,
          type: "income",
          user_id: "u1",
          icon: null,
          color: null,
          is_reserved: false,
        },
      ],
      incomeGoals: [
        { id: "g1", user_id: "u1", category_id: "cat-pj", month: "2026-11", expected: 1000 },
      ],
      realizedIncomeByCategory: realizedMap,
    });

    expect(insights.find((i) => i.id === "income_goal:g1")).toBeUndefined();
  });

  it("inclui nome da categoria na descrição e payload contextual de navegação", () => {
    const realizedMap = new Map([["cat-pj", 50000]]);
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-25",
      categories: [
        {
          id: "cat-pj",
          name: "Consultoria PJ",
          is_active: true,
          type: "income",
          user_id: "u1",
          icon: null,
          color: null,
          is_reserved: false,
        },
      ],
      incomeGoals: [
        { id: "g1", user_id: "u1", category_id: "cat-pj", month: "2026-11", expected: 2000 },
      ],
      realizedIncomeByCategory: realizedMap,
    });

    const goalInsight = insights.find((i) => i.id === "income_goal:g1");
    expect(goalInsight).toBeDefined();
    expect(goalInsight?.description).toContain("Consultoria PJ");
    expect(goalInsight?.primaryAction?.payload).toEqual({ categoryId: "cat-pj" });
  });

  it("prioriza a meta de receita com maior déficit financeiro absoluto", () => {
    const realizedMap = new Map([
      ["cat-a", 10000], // 100 de 500 -> déficit R$ 400
      ["cat-b", 50000], // 500 de 3000 -> déficit R$ 2500
    ]);
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-11-25",
      incomeGoals: [
        { id: "g1", user_id: "u1", category_id: "cat-a", month: "2026-11", expected: 500 },
        { id: "g2", user_id: "u1", category_id: "cat-b", month: "2026-11", expected: 3000 },
      ],
      realizedIncomeByCategory: realizedMap,
    });

    const goalInsights = insights.filter((i) => i.id.startsWith("income_goal:"));
    expect(goalInsights).toHaveLength(1);
    expect(goalInsights[0]?.id).toBe("income_goal:g2");
    expect(goalInsights[0]?.metadata?.valueCents).toBe(250000);
  });

  it("gera insight de prioridade 3 (Economia) para teto familiar em ritmo acelerado", () => {
    const insights = generateSmartAdvisorInsights({
      occurrences: [],
      todayISO: "2026-10-15",
      household: {
        family: { id: "fam-1", name: "Família Silva", owner_id: "user-1", monthly_budget_cents: 500000, split_rule: "equal" },
        month: "2026-10",
        monthly_ceiling_cents: 500000,
        total_spent_cents: 450000,
        total_income_cents: 800000,
        remaining_cents: 50000,
        spent_percentage: 90,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: null,
        has_post_settlement_expenses: false,
      },
    });

    const paceInsight = insights.find((i) => i.id === "household:ceiling_warning");
    expect(paceInsight).toBeDefined();
    expect(paceInsight?.priority).toBe(3);
    expect(paceInsight?.category).toBe("savings");
  });

  it("gera insight consolidado de hábito de transporte e não duplica cortes para trajetos isolados", () => {
    const allExpenses: ExpenseLike[] = [
      {
        id: "1",
        description: "Ida para Caju",
        month: "2026-11",
        date: "2026-11-02",
        valueCents: 2500,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "2",
        description: "Ida para Glória",
        month: "2026-11",
        date: "2026-11-03",
        valueCents: 3000,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "3",
        description: "Volta da Unic",
        month: "2026-11",
        date: "2026-11-04",
        valueCents: 2200,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "4",
        description: "Ida para Unic",
        month: "2026-11",
        date: "2026-11-05",
        valueCents: 2200,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
    ];

    // Simula ocorrências atômicas que o motor de recorrência tradicional poderia gerar
    const occurrences: RecurrenceOccurrence[] = [
      {
        key: "ida para caju",
        name: "Ida para Caju",
        level: "recurring",
        months: ["2026-10", "2026-11"],
        averageCents: 2500,
        confidence: 0.8,
        categoryId: "cat_transporte",
        tier: "can_cut",
      },
      {
        key: "ida para gloria",
        name: "Ida para Glória",
        level: "recurring",
        months: ["2026-10", "2026-11"],
        averageCents: 3000,
        confidence: 0.8,
        categoryId: "cat_transporte",
        tier: "can_cut",
      },
    ];

    const insights = generateSmartAdvisorInsights({
      occurrences,
      allExpenses,
      todayISO: "2026-11-07",
    });

    // 1. Deve haver exatamente 1 insight macro consolidado para o hábito de transporte
    const habitInsight = insights.find((i) => i.id === "habit:cat_transporte:mobility:commute");
    expect(habitInsight).toBeDefined();
    expect(habitInsight?.priority).toBe(3);
    expect(habitInsight?.category).toBe("savings");
    expect(habitInsight?.title).toBe("Hábito frequente: Deslocamentos e transporte");
    expect(habitInsight?.description).toContain("4 despesas");
    expect(habitInsight?.description).toContain("R$ 99,00"); // 25 + 30 + 22 + 22 = 99
    expect(habitInsight?.primaryAction?.label).toBe("Definir teto para transporte");
    expect(habitInsight?.primaryAction?.kind).toBe("set_category_budget");

    // 2. Não deve haver cards atômicos duplicados de corte para "ida para caju" ou "ida para gloria"
    const cajuCard = insights.find((i) => i.id.includes("caju"));
    const gloriaCard = insights.find((i) => i.id.includes("gloria"));
    expect(cajuCard).toBeUndefined();
    expect(gloriaCard).toBeUndefined();
  });

  it("ignora ocorrências com lifecycle 'lapsed' para corte, reajuste e calibração", () => {
    const occurrences: RecurrenceOccurrence[] = [
      {
        key: "old-gym",
        name: "Academia Antiga",
        level: "subscription",
        lifecycle: "lapsed",
        tier: "can_cut",
        months: ["2026-06", "2026-07"],
        averageCents: 15000,
        confidence: 0.9,
        priceAdjustment: {
          oldCents: 10000,
          newCents: 15000,
          percentIncrease: 50,
          kind: "plan_change",
          isInflationary: false,
          isPlanChange: true,
          label: "Mudança de plano",
        },
      },
      {
        key: "old-streaming",
        name: "Streaming Cancelado",
        level: "recurring",
        lifecycle: "lapsed",
        tier: "can_cut",
        months: ["2026-06", "2026-07"],
        averageCents: 4500,
        confidence: 0.8,
      },
    ];

    const insights = generateSmartAdvisorInsights({
      occurrences,
      allExpenses: [],
      todayISO: "2026-11-20",
    });

    expect(insights.some((i) => i.id.includes("old-gym"))).toBe(false);
    expect(insights.some((i) => i.id.includes("old-streaming"))).toBe(false);
  });

  describe("Fase 5 — Portão de Qualidade (SmartAdvisor Proativo)", () => {
    it("Cenário 1: silencia hábito quando categoria já tem orçamento com consumo < 85% e muda para revisão quando >= 85%", () => {
      const habits = [
        {
          key: "habit:cat_alimentacao:food",
          categoryId: "cat_alimentacao",
          name: "Alimentação",
          occurrencesCount: 6,
          totalMonthCents: 24_000, // R$ 240 (< 85% de R$ 600)
          averageTicketCents: 4_000,
          annualProjectedCents: 288_000,
          isMicroLeakage: false,
          actionLabel: "Definir teto para alimentação",
          intentKind: "food:daily_meals" as const,
          isRecurringAcrossMonths: true,
          expenses: [],
          activeThisMonth: true,
        },
      ];

      const suppressed = generateSmartAdvisorInsights({
        occurrences: [],
        spendingHabits: habits,
        budgetedCategoryLimits: new Map([["cat_alimentacao", 60_000]]), // R$ 600
        todayISO: "2026-11-15",
      });
      expect(suppressed.some((i) => i.themeKey === "habit:cat_alimentacao:food")).toBe(false);

      const nearLimit = generateSmartAdvisorInsights({
        occurrences: [],
        spendingHabits: [{ ...habits[0]!, totalMonthCents: 54_000 }], // R$ 540 (90% de R$ 600)
        budgetedCategoryLimits: new Map([["cat_alimentacao", 60_000]]),
        todayISO: "2026-11-15",
      });
      const reviewInsight = nearLimit.find((i) => i.themeKey === "habit:cat_alimentacao:food");
      expect(reviewInsight).toBeDefined();
      expect(reviewInsight?.title).toContain("Orçamento próximo do limite");
      expect(reviewInsight?.primaryAction?.label).toBe("Revisar teto");
    });

    it("Cenário 2 (Cross-Module): compra atípica de R$ 3.000 gera micro-calibração e marcar como 'Pontual' melhora a projeção", async () => {
      const { buildUserFinancialContext } = await import("./financial-context");
      const { buildUnifiedLearningGraph, buildTxOneOffKey } = await import("./learning-graph");
      const { endOfMonthProjection } = await import("@/domain/projection");

      const currentExpenses: ExpenseLike[] = [
        {
          id: "exp-outlier",
          description: "Notebook Novo",
          date: "2026-11-10",
          month: "2026-11",
          valueCents: 300_000, // R$ 3.000
          categoryId: "cat_eletronicos",
        },
        {
          id: "exp-var-1",
          description: "Mercado",
          date: "2026-11-05",
          month: "2026-11",
          valueCents: 40_000, // R$ 400
          categoryId: "cat_mercado",
        },
      ];
      const pastExpenses: ExpenseLike[] = [
        {
          id: "exp-hist-1",
          description: "Cabo USB",
          date: "2026-10-10",
          month: "2026-10",
          valueCents: 5_000,
          categoryId: "cat_eletronicos",
        },
        {
          id: "exp-hist-2",
          description: "Mercado",
          date: "2026-10-05",
          month: "2026-10",
          valueCents: 80_000,
          categoryId: "cat_mercado",
        },
      ];

      // 1. Antes da calibração: SmartAdvisor detecta outlier de R$ 3.000
      const insightsBefore = generateSmartAdvisorInsights({
        occurrences: [],
        allExpenses: [...currentExpenses, ...pastExpenses],
        incomes: [
          {
            key: "sal",
            name: "Salário",
            averageCents: 600_000,
            lastValueCents: 600_000,
            months: ["2026-10", "2026-11"],
            confidence: 0.9,
            typicalDayOfMonth: 5,
            profile: "fixed",
            suggestedAction: "one_touch_confirm",
            valueVariationRatio: 0,
          },
        ],
        todayISO: "2026-11-15",
      });
      const outlierInsight = insightsBefore.find((i) => i.themeKey === "calib_tx:exp-outlier");
      expect(outlierInsight).toBeDefined();
      expect(outlierInsight?.title).toBe("Este gasto foi pontual?");
      expect(outlierInsight?.primaryAction?.kind).toBe("mark_tx_one_off");

      // Projeção antes de marcar como pontual
      const rawExpenses = [
        { id: "exp-outlier", description: "Notebook Novo", date: "2026-11-10", value: 3000, category_id: "cat_eletronicos", report_weight: 1 },
        { id: "exp-var-1", description: "Mercado", date: "2026-11-05", value: 400, category_id: "cat_mercado", report_weight: 1 },
      ];
      const rawHist = [
        [{ id: "exp-hist-1", description: "Cabo USB", date: "2026-10-10", value: 50, category_id: "cat_eletronicos", report_weight: 1 },
         { id: "exp-hist-2", description: "Mercado", date: "2026-10-05", value: 800, category_id: "cat_mercado", report_weight: 1 }],
      ];
      const ctxBefore = buildUserFinancialContext({
        month: "2026-11",
        todayISO: "2026-11-15",
        isCurrentMonth: true,
        monthIncomes: [{ id: "inc1", value: 6000, date: "2026-11-05", report_weight: 1 }],
        monthExpenses: rawExpenses,
        historicalExpensesByMonth: rawHist,
        learning: buildUnifiedLearningGraph({ referenceMonth: "2026-11", feedbackMap: {} }),
      });
      const projBefore = endOfMonthProjection({
        phase: "current",
        incomesCents: 600_000,
        referenceBudgetCents: ctxBefore.referenceBudgetCents,
        investmentsCents: 0,
        fixedPaidCents: ctxBefore.lens.consumption.fixedPaidCents,
        pendingFixedCents: ctxBefore.lens.liquidity.pendingRecurringExpensesCents,
        oneOffAndTripCents: ctxBefore.lens.consumption.oneOffAndTripCents,
        variableExpensesCents: ctxBefore.lens.consumption.variableExpenseCents,
        historicalVariableMedianCents: ctxBefore.lens.consumption.historicalVariableMedianCents,
        dayOfMonth: 15,
        daysInMonth: 30,
      });

      // 2. Usuário toca em "Sim, foi pontual" (tx_one_off:exp-outlier = "one_off")
      const txKey = buildTxOneOffKey("exp-outlier");
      const learningAfter = buildUnifiedLearningGraph({
        referenceMonth: "2026-11",
        feedbackMap: { [txKey]: "one_off" },
      });
      const ctxAfter = buildUserFinancialContext({
        month: "2026-11",
        todayISO: "2026-11-15",
        isCurrentMonth: true,
        monthIncomes: [{ id: "inc1", value: 6000, date: "2026-11-05", report_weight: 1 }],
        monthExpenses: rawExpenses,
        historicalExpensesByMonth: rawHist,
        learning: learningAfter,
      });
      const projAfter = endOfMonthProjection({
        phase: "current",
        incomesCents: 600_000,
        referenceBudgetCents: ctxAfter.referenceBudgetCents,
        investmentsCents: 0,
        fixedPaidCents: ctxAfter.lens.consumption.fixedPaidCents,
        pendingFixedCents: ctxAfter.lens.liquidity.pendingRecurringExpensesCents,
        oneOffAndTripCents: ctxAfter.lens.consumption.oneOffAndTripCents,
        variableExpensesCents: ctxAfter.lens.consumption.variableExpenseCents,
        historicalVariableMedianCents: ctxAfter.lens.consumption.historicalVariableMedianCents,
        dayOfMonth: 15,
        daysInMonth: 30,
      });

      // R$ 3.000 saiu da extrapolação variável e foi isolado em oneOffAndTripCents
      expect(ctxAfter.lens.consumption.oneOffAndTripCents).toBe(300_000);
      expect(ctxAfter.lens.consumption.variableExpenseCents).toBe(40_000);
      expect(projAfter.projectedExpensesCents!).toBeLessThan(projBefore.projectedExpensesCents!);

      // E o card de calibração desaparece do SmartAdvisor
      const insightsAfter = generateSmartAdvisorInsights({
        occurrences: [],
        allExpenses: [...currentExpenses, ...pastExpenses],
        feedbackMap: { [txKey]: "one_off" },
        financialContext: ctxAfter,
        todayISO: "2026-11-15",
      });
      expect(insightsAfter.some((i) => i.themeKey === "calib_tx:exp-outlier")).toBe(false);
    });

    it("Cenário 3: Smart Decay aplica cooldown progressivo 7d -> 30d -> 90d após dispensas consecutivas da família habit", async () => {
      const { advanceSmartDecay } = await import("./attention-budget");
      const t0 = Date.UTC(2026, 10, 1, 12, 0, 0);
      const dayMs = 86_400_000;

      const e1 = advanceSmartDecay(undefined, t0);
      expect(e1.nextCooldownDays).toBe(7);
      expect(e1.record.dismissCount).toBe(1);
      expect(e1.record.dismissedUntil).toBe(t0 + 7 * dayMs);

      const e2 = advanceSmartDecay(e1.record, t0 + 8 * dayMs);
      expect(e2.nextCooldownDays).toBe(30);
      expect(e2.record.dismissCount).toBe(2);
      expect(e2.record.dismissedUntil).toBe(t0 + 8 * dayMs + 30 * dayMs);

      const e3 = advanceSmartDecay(e2.record, t0 + 40 * dayMs);
      expect(e3.nextCooldownDays).toBe(90);
      expect(e3.shouldOfferMute).toBe(true);
      expect(e3.record.dismissCount).toBe(3);
      expect(e3.record.dismissedUntil).toBe(t0 + 40 * dayMs + 90 * dayMs);

      const filtered = filterAndRankAllAdvisorInsights(
        [
          {
            id: "habit:cafe",
            themeKey: "habit:cafe",
            priority: 3,
            category: "savings",
            title: "Hábito frequente",
            description: "...",
            iconName: "trending-down",
          },
        ],
        {
          decayByFamily: { habit: e3.record },
          nowMs: t0 + 45 * dayMs,
        },
      );
      expect(filtered).toHaveLength(0);
    });

    it("Cenário 4: celebra economia real (>= 15% abaixo da mediana no dia >= 15) e proventos cobrindo custos fixos (máx 1 celebração)", () => {
      // 4a. Economia real no mês
      const savingsCelebration = generateSmartAdvisorInsights({
        occurrences: [],
        historicalVariableMedianCents: 200_000, // R$ 2.000/mês
        financialContext: {
          month: "2026-11",
          todayISO: "2026-11-20",
          dayOfMonth: 20,
          daysInMonth: 30,
          elapsedPercent: 66.7,
          isCurrentMonth: true,
          maturity: "active_cycle",
          referenceBudgetCents: 500_000,
          referenceBudgetSource: "current_income",
          isProvisionalReference: false,
          learning: {
            activeFeedbackMap: {},
            essentialKeys: new Set(),
            currentMonthOneOffKeys: new Set(),
            oneOffExpenseIds: new Set(),
            ignoredKeys: new Set(),
            budgetedCategoryLimits: new Map(),
            merchantAliasMap: new Map(),
            paydayProfile: {
              pattern: "start_of_month",
              typicalIncomeDays: [5],
              expectedMonthlyIncomeCents: 500_000,
              confidence: 0.9,
              monthsAnalyzed: 3,
            },
            learnedServices: new Map(),
            semanticTagIndex: new Map(),
            decayByFamily: {},
          },
          lens: {
            consumption: {
              operatingIncomeCents: 500_000,
              refundsNeutralizedCents: 0,
              priorCycleRefundCreditCents: 0,
              grossWeightedExpenseCents: 80_000,
              netExpenseCents: 80_000,
              fixedPaidCents: 0,
              oneOffAndTripCents: 0,
              variableExpenseCents: 80_000, // esperado pro-rata ~133.333 -> economia ~53.333 (>= R$ 100 e >= 15%)
              variableDaysCount: 5,
              variableTxCount: 5,
              historicalVariableMedianCents: 200_000,
            },
            liquidity: {
              hasLiquidityContext: false,
              realCashBalanceCents: 0,
              committedObligationsCents: 0,
              safeToSpendCents: 0,
              pendingRecurringExpensesCents: 0,
              expectedUpcomingInflowsCents: 0,
            },
            wealth: {
              hasInvestmentsAccess: true,
              monthlyContributionsCents: 0,
              monthlySettledDividendsCents: 20_000, // R$ 200 de proventos
              emergencyReserveCents: 3_000_000,
              emergencyTargetCents: 1_200_000,
              emergencyMonthsCovered: 15,
              emergencyTargetMonths: 6,
              hasExternalEmergencyFund: false,
              isEmergencyFundComplete: true,
              emergencyGapCents: 0,
            },
          },
          fixedCommitmentsSummary: {
            totalMonthlyFixedCents: 50_000,
            pendingThisMonthCents: 0,
            formalCount: 0,
            detectedCount: 0,
            fixedCommitmentRatePercent: 10,
          },
        },
        todayISO: "2026-11-20",
      });

      const celebrations = savingsCelebration.filter((i) => i.category === "celebration");
      expect(celebrations).toHaveLength(1);
      expect(celebrations[0]?.themeKey).toBe("celebration:real_savings");
      expect(celebrations[0]?.priority).toBe(3.5);

      // 4b. Proventos cobrindo assinatura
      const dividendsCelebration = generateSmartAdvisorInsights({
        occurrences: [
          {
            key: "sub-internet",
            name: "Internet Fibra",
            level: "subscription",
            lifecycle: "active",
            tier: "essential",
            months: ["2026-09", "2026-10", "2026-11"],
            averageCents: 12_000, // R$ 120
            confidence: 0.9,
          },
        ],
        monthlySettledDividendsCents: 15_000, // R$ 150 >= R$ 120
        todayISO: "2026-11-10",
      });
      const divCelebration = dividendsCelebration.find((i) => i.themeKey === "celebration:dividends_cover_fixed");
      expect(divCelebration).toBeDefined();
      expect(divCelebration?.description).toContain("Internet Fibra");
    });

    it("Trava de Reserva no aporte:rebalance sugere 'Reforçar Reserva de Emergência' quando reserva está incompleta", () => {
      const insights = generateSmartAdvisorInsights({
        occurrences: [],
        savingsSurplusCents: 150_000,
        isEmergencyFundComplete: false,
        todayISO: "2026-11-18",
      });

      const aporte = insights.find((i) => i.themeKey === "aporte:rebalance");
      expect(aporte).toBeDefined();
      expect(aporte?.title).toBe("Reforçar Reserva de Emergência");
      expect(aporte?.primaryAction?.label).toBe("Reforçar reserva");
      expect(aporte?.primaryAction?.payload?.intent).toBe("emergency_fund");
    });

    it("Blindagem Semântica: recorrência de Aluguel (40% da renda) não vira 'gasto vampiro / avaliar corte' e farmácia não vira microvazamento", async () => {
      const { detectRecurrences } = await import("./recurrences");
      const rentExpenses: ExpenseLike[] = [
        { id: "r1", description: "Aluguel Apartamento", date: "2026-09-05", month: "2026-09", valueCents: 200_000, categoryId: "c-outros" },
        { id: "r2", description: "Aluguel Apartamento", date: "2026-10-05", month: "2026-10", valueCents: 200_000, categoryId: "c-outros" },
        { id: "r3", description: "Aluguel Apartamento", date: "2026-11-05", month: "2026-11", valueCents: 200_000, categoryId: "c-outros" },
      ];
      const occs = detectRecurrences(rentExpenses, {
        todayISO: "2026-11-15",
        monthlyIncomeCents: 500_000,
      });
      expect(occs[0]?.tier).toBe("essential");
      expect(occs[0]?.budgetImpact?.isVampire).toBe(false);

      const advisorInsights = generateSmartAdvisorInsights({
        occurrences: occs,
        spendingHabits: [
          {
            key: "habit:cat_saude:health:pharmacy",
            categoryId: "cat_saude",
            intentKind: "health:pharmacy",
            name: "Farmácia e cuidados com a saúde",
            actionLabel: "Ajustar gastos de farmácia",
            totalMonthCents: 18_000,
            occurrencesCount: 4,
            averageTicketCents: 4_500,
            annualProjectedCents: 216_000,
            isRecurringAcrossMonths: true,
            isMicroLeakage: true,
            expenses: [],
            activeThisMonth: true,
          },
        ],
        todayISO: "2026-11-15",
      });

      expect(advisorInsights.some((i) => i.themeKey.startsWith("savings:"))).toBe(false);
      expect(advisorInsights.some((i) => i.themeKey.includes("pharmacy"))).toBe(false);
    });

    it("detecta assinatura cobrada em dois cartões/meios no 1º mês e celebra fôlego de parcelamentos no fim", () => {
      const insights = generateSmartAdvisorInsights({
        occurrences: [],
        allExpenses: [
          {
            id: "dup-1",
            description: "Netflix",
            month: "2026-11",
            date: "2026-11-03",
            valueCents: 5590,
            categoryId: "cat-sub",
            paymentMethod: "credit_card",
            cardId: "c1",
            cardName: "Nubank",
          },
          {
            id: "dup-2",
            description: "Netflix",
            month: "2026-11",
            date: "2026-11-10",
            valueCents: 5590,
            categoryId: "cat-sub",
            paymentMethod: "credit_card",
            cardId: "c2",
            cardName: "Itaú",
          },
          {
            id: "inst-final",
            description: "Geladeira 10/10",
            month: "2026-11",
            date: "2026-11-12",
            valueCents: 35000,
            categoryId: "cat-casa",
            installmentGroupId: "grp-gel",
            rawExpense: {
              id: "inst-final",
              user_id: "u1",
              date: "2026-11-12",
              description: "Geladeira 10/10",
              value: 350,
              base_amount: 350,
              category_id: "cat-casa",
              payment_method: "credit_card",
              card_id: "c1",
              bill_competence: "2026-11",
              installments_total: 10,
              installment_number: 10,
              installment_group_id: "grp-gel",
              report_weight: 1,
              created_at: "2026-02-12T00:00:00Z",
            },
          },
        ],
        todayISO: "2026-11-15",
      });

      const dup = insights.find((i) => i.themeKey === "dup:netflix");
      expect(dup).toBeDefined();
      expect(dup?.priority).toBe(1);
      expect(dup?.title).toBe("Assinatura cobrada em dois meios");
      expect(dup?.description).toContain("Nubank e Itaú");

      const endings = insights.find(
        (i) => i.themeKey === "celebration:installments_ending:2026-11",
      );
      expect(endings).toBeDefined();
      expect(endings?.priority).toBe(3.5);
      expect(endings?.title).toBe("Parcelamentos chegando ao fim");
      expect(endings?.description).toContain("R$ 350,00");
    });
  });
});

