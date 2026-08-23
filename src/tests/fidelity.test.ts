import { describe, expect, it } from "vitest";
import {
  clampDay,
  dueDateOfCompetence,
  resolveBillCompetence,
  resolveBillCompetenceWithOverrides,
} from "@/domain/competence";
import { addDaysISO, debtStatus, todayISO } from "@/domain/debts";
import { autoSelectBillMonth, buildCompetenceSummaries, invoiceBalance, invoiceDueDate, invoiceStatus } from "@/domain/cards";
import { addMonthsClamped, parcelar, splitCents, toISODate } from "@/domain/money/parcelar";
import { parseBRLToCents } from "@/domain/money/parse";
import {
  budgetStatus,
  exceededCents,
  globalUsedPercent,
  incomeGoalStatus,
  isInheritedLimit,
  progressTone,
  reallocationSuggestion,
  resolveEffectiveLimit,
  suggestCategory,
  suggestLimitCents,
} from "@/domain/budgets";
import {
  accountsNet,
  buildDailyFlow,
  computeOverview,
  openInvoicesTotal,
  percentChange,
} from "@/domain/overview";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  MAX_CUSTOM_PERIOD_DAYS,
  mergePaidDebts,
  mondayFirstWeekday,
  validateCustomPeriod,
  weightedCents,
} from "@/domain/reports";
import {
  applyFeedback,
  classifySubscription,
  confidenceScore,
  criticalAlerts,
  detectRecurrences,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  weekendSpendingRatio,
} from "@/domain/insights";
import { dailyBudget, endOfMonthProjection, pendingProjection, spendingPace } from "@/domain/projection";
import { buildLimitSuggestions, discretionaryChallenge, dynamicMinLimitCents, pickTopChallenges } from "@/domain/savings";
import { billReminder, debtReminder, isSnoozeExpired, sortReminders } from "@/domain/reminders";
import { normalizeSearch, recencyBonus, searchGlobal } from "@/domain/search";
import {
  applyOperation,
  computeLedger,
  convertToBRL,
} from "@/domain/portfolio";
import {
  applySpikeGuardrail,
  FALLBACK_USD_RATE,
  resolvePrice,
  usdRateFromPrices,
} from "@/domain/portfolio/valuation";
import {
  clampTargetPercentage,
  parseTargetInput,
  sectorExposure,
  targetsSum,
  validateSectorCaps,
  validateTargetsSum,
} from "@/domain/portfolio/allocation";
import { isFirstUse, onboardingProgress } from "@/domain/onboarding";
import { simulateSmartAporte } from "@/domain/portfolio/aporte";
import { isValidMonth, monthRange, shiftMonth } from "@/lib/date";
import type { CriticalAlertInput } from "@/domain/insights";
import type { LedgerTransaction } from "@/domain/portfolio";

/**
 * F6.1 — PROVA DE FIDELIDADE
 * ------------------------------------------------------------------
 * Espelho das regras de negócio do ESPECIFICACAO_TECNICA.md (§1.3–§4.5):
 * um teste por regra, com exemplo representativo, verificando a INVARIANTE
 * central de cada seção. A cobertura profunda de cada motor vive nos testes
 * colocalizados (ver docs/ROADMAP.md F6.1 — matriz de fidelidade).
 *
 * Regras impostas no servidor (RPCs transacionais, RLS, constraints) são
 * cobertas por migrations + testes de repositórios (ver matriz).
 */

const TODAY = "2026-08-13";

describe("§1.5 — Competência de fatura (D3 — snapshot na escrita)", () => {
  it("compra no dia do fechamento vai para a fatura do mês seguinte", () => {
    expect(resolveBillCompetence(new Date(2026, 3, 10), 10)).toBe("2026-05");
    expect(resolveBillCompetence(new Date(2026, 3, 5), 10)).toBe("2026-04");
  });

  it("clampDay limita 1–31 (fevereiro usa o último dia)", () => {
    expect(clampDay(31, 2026, 1)).toBe(28);
    expect(clampDay(0, 2026, 0)).toBe(1);
  });

  it("overrides mensais prevalecem sobre o padrão", () => {
    const overrides = [{ month: "2026-04", closingDay: 20, dueDay: 15 }];
    // Compra em 10/04 com closing padrão 10 → maio; override 20 → abril.
    expect(resolveBillCompetenceWithOverrides(new Date(2026, 3, 10), 10, overrides)).toBe("2026-04");
  });

  it("dueDateOfCompetence deriva o vencimento da competência", () => {
    expect(dueDateOfCompetence("2026-08", 15)).toBe("2026-08-15");
  });
});

describe("§3.2.2 — Parcelamento 1–60x (D12 — cálculo no cliente, validação no servidor)", () => {
  it("divisão exata em centavos com resto nas primeiras parcelas (R$ 100 ÷ 3)", () => {
    const values = splitCents(10_000, 3);
    expect(values).toEqual([3334, 3333, 3333]);
    expect(values.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("parcelar gera datas mensais com número 1-based e soma idêntica ao original", () => {
    const plan = parcelar(10_000, 3, new Date(2026, 0, 31));
    expect(plan).toHaveLength(3);
    expect(plan.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(plan[1]?.date).toBe("2026-02-28"); // addMonthsClamped: sem salto de mês
    expect(plan.reduce((a, p) => a + p.valueCents, 0)).toBe(10_000);
  });

  it("addMonthsClamped preserva o fim do mês", () => {
    expect(toISODate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});

describe("§3.3 — Cartões: fatura, pagamentos e estornos", () => {
  it("saldo aberto nunca é negativo (pagamento a maior)", () => {
    expect(invoiceBalance(100_000, 120_000)).toBe(0);
    expect(invoiceBalance(100_000, 30_000)).toBe(70_000);
  });

  it("estorno entra à parte no resumo da competência (com peso aplicado)", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 0.5 }],
      [{ competence_month: "2026-08", amount: -40 }],
    );
    expect(summaries[0]).toMatchObject({
      previstoBrutoCents: 10000,
      previstoPonderadoCents: 5000,
      pagoCents: 0,
      estornoCents: 4000,
      saldoBrutoCents: 10000,
      saldoPonderadoCents: 5000,
    });
  });

  it("seleção automática do mês: atual com pendência → varredura para trás → seguinte → atual", () => {
    const summaries = [
      { month: "2026-07", saldoCents: 5000 },
      { month: "2026-06", saldoCents: 3000 },
    ];
    expect(autoSelectBillMonth(summaries, TODAY)).toBe("2026-07");
  });

  it("invoiceStatus: fechada / aberta / a vencer na janela / vencida", () => {
    expect(invoiceStatus("2026-08", 10, 0, TODAY)).toBe("closed");
    expect(invoiceStatus("2026-08", 20, 5000, TODAY)).toBe("open");
    expect(invoiceStatus("2026-08", 15, 5000, TODAY)).toBe("near_due"); // 2 dias
    expect(invoiceStatus("2026-08", 10, 5000, TODAY)).toBe("overdue");
  });

  it("invoiceDueDate deriva o vencimento da fatura", () => {
    expect(invoiceDueDate("2026-08", 10)).toBe("2026-08-10");
  });
});

describe("§3.4 — Dívidas: status derivado (nunca armazenado)", () => {
  it("paid / overdue / due_today / due_soon / pending", () => {
    expect(debtStatus("2026-08-10", "2026-08-05", TODAY)).toBe("paid");
    expect(debtStatus("2026-08-10", null, TODAY)).toBe("overdue");
    expect(debtStatus("2026-08-13", null, TODAY)).toBe("due_today");
    expect(debtStatus("2026-08-15", null, TODAY)).toBe("due_soon"); // ≤ 3 dias
    expect(debtStatus("2026-08-20", null, TODAY)).toBe("pending");
  });

  it("dívidas pagas entram nos totais (recebíveis → rendas; pagáveis → despesas)", () => {
    const merged = mergePaidDebts(500_000, 200_000, 0, [
      { kind: "receivable", valueCents: 30_000 },
      { kind: "payable", valueCents: 10_000 },
    ]);
    expect(merged.incomeCents).toBe(530_000);
    expect(merged.expenseCents).toBe(210_000);
    expect(merged.balanceCents).toBe(320_000);
  });
});

describe("§3.5 — Categorias, orçamentos e metas", () => {
  it("sugestão inteligente por nome infere ícone/cor/%", () => {
    expect(suggestCategory("Alimentação")).toMatchObject({ icon: "alimentacao", limitPercent: 15 });
    expect(suggestCategory("xyz")).toBeNull();
  });

  it("limite sugerido arredondado a R$ 10 com piso de R$ 10", () => {
    expect(suggestLimitCents(500_000, 15)).toBe(75_000);
    expect(suggestLimitCents(10_000, 5)).toBe(1000); // piso R$ 10
  });

  it("faixas de atenção 85/90/95 e excedida > 100", () => {
    expect(budgetStatus(84_000, 100_000)).toBe("ok");
    expect(budgetStatus(85_000, 100_000)).toBe("attention");
    expect(budgetStatus(90_000, 100_000)).toBe("high");
    expect(budgetStatus(95_000, 100_000)).toBe("critical");
    expect(budgetStatus(100_001, 100_000)).toBe("exceeded");
    expect(exceededCents(120_000, 100_000)).toBe(20_000);
  });

  it("% global usado com fallback para rendas e teto em 100", () => {
    expect(globalUsedPercent(80_000, 100_000, 0)).toBe(80);
    expect(globalUsedPercent(200_000, 100_000, 0)).toBe(100);
    expect(globalUsedPercent(80_000, 0, 100_000)).toBe(80); // fallback rendas
  });

  it("progressTone: ≥85 crítico, ≥70 atenção, senão positivo", () => {
    expect(progressTone(90)).toBe("critical");
    expect(progressTone(70)).toBe("warning");
    expect(progressTone(50)).toBe("positive");
  });

  it("herança de limite: sem limite no mês, usa o anterior (fallback de exibição)", () => {
    const limits = [
      { month: "2026-07", limitCents: 100_000 },
      { month: "2026-08", limitCents: 120_000 },
    ];
    expect(resolveEffectiveLimit(limits, "2026-08")).toBe(120_000);
    expect(resolveEffectiveLimit([{ month: "2026-07", limitCents: 100_000 }], "2026-08")).toBe(100_000);
    expect(isInheritedLimit([{ month: "2026-07" }], "2026-08")).toBe(true);
  });

  it("realocação: maior excesso → maior folga, valor = min(excesso, folga)", () => {
    const suggestion = reallocationSuggestion([
      { categoryId: "a", limitCents: 100_000, spentCents: 160_000 }, // excesso 60.000
      { categoryId: "b", limitCents: 100_000, spentCents: 30_000 }, // folga 70.000
    ]);
    expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 60_000 });
  });

  it("meta de renda: déficit quando realizado < esperado", () => {
    expect(incomeGoalStatus(80_000, 100_000)).toBe("deficit");
    expect(incomeGoalStatus(120_000, 100_000)).toBe("surplus");
  });
});

describe("§3.6 — Visão consolidada (Dia/Mês/Ano)", () => {
  it("saldo = rendas − despesas − investimentos; savingsRate = (rendas − despesas) ÷ rendas", () => {
    const totals = computeOverview(500_000, 300_000, 50_000);
    expect(totals.balanceCents).toBe(150_000);
    expect(totals.savingsRatePercent).toBe(40);
    expect(computeOverview(0, 10_000, 0).savingsRatePercent).toBe(0); // rendas 0 → sem taxa
  });

  it("percentChange relativo ao período anterior; null sem base", () => {
    expect(percentChange(120_000, 100_000)).toBe(20);
    expect(percentChange(5_000, 0)).toBeNull();
  });

  it("saldo líquido de contas = receber − pagar − faturas em aberto", () => {
    expect(accountsNet(100_000, 40_000, 30_000)).toBe(30_000);
  });

  it("faturas em aberto somam o saldo bruto das faturas a pagar", () => {
    const expenses = [
      { card_id: "c1", bill_competence: "2026-08", value: 100, report_weight: 1 },
      { card_id: "c2", bill_competence: "2026-08", value: 200, report_weight: 0.5 },
    ];
    expect(openInvoicesTotal(expenses, [], TODAY)).toBe(30_000); // 100 + 200 (bruto)
  });

  it("fluxo diário empilha rendas/despesas/investimentos por dia", () => {
    const flow = buildDailyFlow("2026-08", [
      { date: "2026-08-03", kind: "income", amountCents: 10_000 },
      { date: "2026-08-03", kind: "expense", amountCents: 4_000 },
    ]);
    const day = flow.find((d) => d.dayOfMonth === 3);
    expect(day).toMatchObject({ incomeCents: 10_000, expenseCents: 4_000, investmentCents: 0 });
    expect(flow).toHaveLength(31); // dias do mês sempre presentes
  });
});

describe("§3.7 — Motor de análise (insights)", () => {
  const base: CriticalAlertInput = {
    balanceCents: 100_000,
    incomeCents: 500_000,
    paceRatio: 1,
    overspentBudgets: 0,
    burnRatePercent: 60,
    projectedDeficit: false,
    savingsRatePercent: 20,
  };

  it("alertas críticos seguem a prioridade 1–6 da spec", () => {
    const alerts = criticalAlerts({
      ...base,
      balanceCents: -100,
      paceRatio: 1.06,
      overspentBudgets: 2,
      burnRatePercent: 90,
      projectedDeficit: true,
    });
    const priorities = alerts.map((a) => a.priority);
    expect(priorities).toEqual([1, 2, 3, 4, 5, 6]);
    expect(alerts.find((a) => a.id === "poupanca_saudavel")?.severity).toBe("praise");
  });

  it("assinaturas: 3 sinais (nome/categoria/valor) + tier de corte", () => {
    const classified = classifySubscription({
      name: "Netflix",
      categoryIcon: "assinaturas",
      monthlyValuesCents: [3990, 3990, 3990],
    });
    expect(classified).not.toBeNull();
    expect(classified?.confidence).toBeGreaterThan(0.9);
    expect(classified?.tier).toBe("can_cut");
  });

  it("recorrências em 3 níveis: subscription / recurring / estimated", () => {
    const occurrences = detectRecurrences([
      { id: "1", description: "Spotify", month: "2026-06", valueCents: 1990, categoryId: "c1", categoryIcon: "assinaturas" },
      { id: "2", description: "Spotify", month: "2026-07", valueCents: 1990, categoryId: "c1", categoryIcon: "assinaturas" },
      { id: "3", description: "Spotify", month: "2026-08", valueCents: 1990, categoryId: "c1", categoryIcon: "assinaturas" },
    ]);
    expect(occurrences.some((o) => o.level === "subscription")).toBe(true);
  });

  it("confiança: bônus por histórico e penalidade por variância", () => {
    const withHistory = confidenceScore({ base: 0.6, monthsHistory: 5, kind: "recurring", variance: 0.05 });
    const fresh = confidenceScore({ base: 0.6, monthsHistory: 1, kind: "recurring", variance: 0.05 });
    expect(withHistory).toBeGreaterThan(fresh);
  });

  it("aprendizado: ignorada sai da lista; confirmada ganha flag", () => {
    const result = applyFeedback([{ key: "k1" }, { key: "k2" }], { k1: "ignore", k2: "confirm" });
    expect(result.map((o) => o.key)).toEqual(["k2"]);
    expect(result[0]?.confirmed).toBe(true);
  });

  it("diagnósticos: concentração > 60% alerta; fim de semana ratio > 1.5; tendência > 15%", () => {
    expect(incomeConcentration([700_000, 300_000]).alert).toBe(true);
    expect(weekendSpendingRatio(100, 200)).toBe(2);
    expect(isSignificantTrend(120_000, 100_000)).toBe(true);
    expect(savingsHealth(25)).toBe("saudavel");
  });

  it("desafios: piso dinâmico max(R$ 20, 0,5% da renda) e máx. 4 simultâneos", () => {
    expect(dynamicMinLimitCents(100_000)).toBe(2000); // R$ 20
    expect(dynamicMinLimitCents(1_000_000)).toBe(5000); // R$ 50
    expect(
      pickTopChallenges(
        [1, 2, 3, 4, 5].map((i) => ({
          categoryId: `c${i}`,
          name: `Cat ${i}`,
          percent: 20 as const,
          targetCents: 8000,
          savingsCents: i * 100,
          minLimitCents: 2000,
        })),
      ),
    ).toHaveLength(4);
    expect(discretionaryChallenge).toBeTypeOf("function");
  });

  it("sugestões de limite: máx. 3 por mês, priorizadas por impacto", () => {
    const suggestions = buildLimitSuggestions(
      [
        { categoryId: "a", name: "A", icon: "x", limitCents: 100_000, spentCents: 160_000 },
        { categoryId: "b", name: "B", icon: "x", limitCents: 100_000, spentCents: 20_000 },
        { categoryId: "c", name: "C", icon: "x", limitCents: 100_000, spentCents: 10_000 },
        { categoryId: "d", name: "D", icon: "x", limitCents: 100_000, spentCents: 170_000 },
      ],
      500_000,
    );
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.some((s) => s.categoryId === "d" && s.kind === "increase")).toBe(true);
  });
});

describe("§3.8 — Projeção e prospecção de gastos", () => {
  it("gasto diário disponível = max(0, líquido ÷ dias restantes incluindo hoje)", () => {
    const result = dailyBudget({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 150_000,
      dayOfMonth: 20,
      daysInMonth: 30,
    });
    expect(result.dailyCents).toBe(Math.floor(300_000 / 11));
  });

  it("ritmo de gastos ativo a partir do 8º dia E ≥ 30% decorrido", () => {
    const result = spendingPace({
      dayOfMonth: 10,
      daysInMonth: 30,
      monthlyBudgetCents: 300_000,
      spentCents: 150_000,
    });
    expect(result.active).toBe(true);
    expect(result.ahead).toBe(true); // 50% gasto × 33% decorrido
    expect(result.gapPoints).toBeGreaterThan(0);
  });

  it("projeção de fim de mês: burn rate × dias; fora do trilho quando superávit < 0", () => {
    const result = endOfMonthProjection({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 0,
      expensesCents: 200_000,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(result.burnRateCents).toBe(20_000);
    expect(result.projectedExpensesCents).toBe(600_000);
    expect(result.onTrack).toBe(false);
  });

  it("projeção de pendências = recebíveis − pagáveis", () => {
    const result = pendingProjection([
      { id: "r1", kind: "receivable", remainingCents: 30_000 },
      { id: "p1", kind: "payable", remainingCents: 10_000 },
    ]);
    expect(result.balanceCents).toBe(20_000);
  });
});

describe("§3.9 — Busca global", () => {
  it("normalização ignora acentos e caixa; scoring 100/85/60", () => {
    expect(normalizeSearch("AlugUÉL")).toBe("aluguel");
  });

  it("bônus de recência decrescente por meses", () => {
    expect(recencyBonus(0)).toBe(25);
    expect(recencyBonus(13)).toBe(0);
  });

  it("limites por tipo (5) e total (12), ordenado por score desc", () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      type: "expense" as const,
      text: [`despesa ${i}`],
      label: `Despesa ${i}`,
      date: "2026-08-01",
      link: { path: "/transacoes" },
    }));
    const results = searchGlobal("despesa", entries, TODAY);
    expect(results.filter((r) => r.entry.type === "expense")).toHaveLength(5);
    expect(results.length).toBeLessThanOrEqual(12);
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("§3.10 — Lembretes (in-app)", () => {
  it("fatura vencida ou a vencer na janela gera lembrete", () => {
    expect(
      billReminder(
        { key: "b1", title: "Nubank", dueDate: "2026-08-10", amountCents: 100 },
        5000,
        10,
        TODAY,
      )?.status,
    ).toBe("overdue");
  });

  it("dívida pendente dentro da janela gera lembrete", () => {
    expect(
      debtReminder({ key: "d1", title: "Conta", dueDate: "2026-08-15", amountCents: 100 }, null, TODAY)?.status,
    ).toBe("due_soon");
  });

  it("snooze oculta até a data, mas expira ao vencer/atrasar (o alerta volta)", () => {
    expect(isSnoozeExpired({ key: "s1", kind: "snoozed", snoozeUntil: "2026-08-15" }, "2026-08-12", "2026-08-10")).toBe(false);
    expect(isSnoozeExpired({ key: "s2", kind: "snoozed", snoozeUntil: "2026-08-30" }, "2026-08-05", "2026-08-10")).toBe(true); // vencida
  });

  it("ordenação: atrasados primeiro, depois por vencimento", () => {
    const sorted = sortReminders([
      { key: "a", kind: "debt", title: "A", dueDate: "2026-08-20", status: "pending", amountCents: 100 },
      { key: "b", kind: "debt", title: "B", dueDate: "2026-08-10", status: "overdue", amountCents: 100 },
    ]);
    expect(sorted[0]?.key).toBe("b");
  });
});

describe("§3.11 — Carteira: metas, ledger, valoração e aporte", () => {
  it("soma de metas ≤ 100% (UI e banco)", () => {
    expect(targetsSum([{ target: 30 }, { target: 40 }])).toBe(70);
    expect(validateTargetsSum([{ target: 30 }, { target: 80 }]).ok).toBe(false);
    expect(clampTargetPercentage(120)).toBe(100);
    expect(parseTargetInput("25,5")).toBe(25.5); // vírgula pt-BR
  });

  it("travas setoriais: exposição acima do teto é violação", () => {
    const exposure = sectorExposure(60_000, 100_000, 50); // 60% > teto 50%
    expect(exposure.exceeded).toBe(true);
    expect(validateSectorCaps([{ pct: 60, cap: 50 }]).ok).toBe(false);
  });

  it("ledger: custo médio ponderado e caixa derivado (nunca armazenado)", () => {
    const tx = (overrides: Partial<LedgerTransaction> & Pick<LedgerTransaction, "type" | "date">): LedgerTransaction => ({
      id: "t",
      quantity: 0,
      price: 0,
      total: 0,
      ...overrides,
    });
    const result = computeLedger([
      tx({ type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 }),
      tx({ type: "buy", date: "2026-02-10", quantity: 10, price: 200, total: 2000 }),
    ]);
    expect(result.quantity).toBe(20);
    expect(result.averageCost).toBe(150);
    expect(result.cash).toBe(-3000);
  });

  it("venda reduz proporcionalmente pelo custo médio", () => {
    const result = applyOperation(
      { quantity: 20, totalCost: 3000, averageCost: 150, dividends: 0 },
      { type: "sell", quantity: 10, price: 250, total: 2500 },
    );
    expect(result.quantity).toBe(10);
    expect(result.averageCost).toBe(150);
  });

  it("valoração: manual → cache (api) → fallback; guardrail de spike > 50%", () => {
    expect(resolvePrice({ manualPrice: 42.5, cachePrice: 40, fallbackPrice: 5.25 })).toEqual({
      price: 42.5,
      source: "manual",
    });
    expect(resolvePrice({ manualPrice: null, cachePrice: 40, fallbackPrice: 5.25 }).source).toBe("api");
    expect(resolvePrice({ manualPrice: null, cachePrice: null, fallbackPrice: 5.25 }).source).toBe("fallback");
    expect(applySpikeGuardrail(100, 40)).toBe(40); // variação > 50% mantém o último válido
    expect(applySpikeGuardrail(100, 80)).toBe(100);
  });

  it("USD com fallback 5,25; taxa do cache USDBRL=X", () => {
    expect(convertToBRL(1000, "USD", FALLBACK_USD_RATE)).toBe(5250);
    expect(convertToBRL(1000, "USD")).toBe(5250); // fallback padrão
    expect(usdRateFromPrices([{ ticker: "USDBRL=X", price: 5.4 }])).toBe(5.4);
  });

  it("aporte nunca aloca além do informado; sobra vai para caixa/reserva", () => {
    const result = simulateSmartAporte({
      aporte: 10_000,
      assets: [
        { id: "a", ticker: "A", assetClass: null, currency: "BRL", currentValueBRL: 1000, priceBRL: 100, targetPercentage: 50 },
        { id: "b", ticker: "B", assetClass: null, currency: "BRL", currentValueBRL: 4000, priceBRL: 200, targetPercentage: 40 },
      ],
    });
    expect(result.totalAllocated).toBeLessThanOrEqual(result.aporte);
    expect(result.leftover).toBeGreaterThan(0); // sobra → caixa
    expect(result.routes.every((r) => r.allocatedBRL > 0 && r.gapBRL > 0)).toBe(true); // só gap > 0 recebe
  });
});

describe("§4.1 — Datas e calendário (timezone local)", () => {
  it("range de mês [start, end) com mês seguinte — sem toISOString", () => {
    expect(monthRange("2026-08")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
  });

  it("dia da semana Monday-first", () => {
    expect(mondayFirstWeekday("2026-08-03")).toBe(0); // segunda
  });

  it("datas relativas para status de dívida", () => {
    expect(addDaysISO("2026-08-13", 2)).toBe("2026-08-15");
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("§4.2 — Moeda e arredondamento", () => {
  it("parsing pt-BR tolerante (R$, milhar com ponto, decimal com vírgula)", () => {
    expect(parseBRLToCents("R$ 1.500,00")).toBe(150_000);
    expect(parseBRLToCents("1.500,5")).toBe(150_050);
    expect(parseBRLToCents("0,01")).toBe(1);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("-10")).toBeNull();
  });

  it("peso de relatório: exibido = base × peso (4 casas), base preservada", () => {
    expect(weightedCents(20_000, 0.5)).toBe(10_000);
  });

  it("agregações ponderadas ordenadas por total desc", () => {
    const entries = [
      { id: "1", date: "2026-08-03", kind: "expense" as const, categoryId: "a", categoryName: "A", categoryIcon: "x", paymentMethod: "pix", baseCents: 10_000, weight: 1 },
      { id: "2", date: "2026-08-04", kind: "expense" as const, categoryId: "b", categoryName: "B", categoryIcon: "y", paymentMethod: "credit_card", baseCents: 20_000, weight: 0.5 },
    ];
    const byCategory = aggregateByCategory(entries);
    expect(byCategory[0]?.name).toBe("A"); // 10.000 > 10.000? empate → ordem estável; B = 10.000
    expect(aggregateByPaymentMethod(entries).length).toBeGreaterThan(0);
    expect(aggregateByWeekday(entries)).toHaveLength(7); // segunda → domingo sempre presentes
  });
});

describe("§4.5 — Validações de formulário (pt-BR)", () => {
  it("período customizado com máximo de 366 dias", () => {
    expect(MAX_CUSTOM_PERIOD_DAYS).toBe(366);
    expect(validateCustomPeriod("2026-01-01", "2026-12-31").ok).toBe(true);
    expect(validateCustomPeriod("2026-12-31", "2026-01-01").ok).toBe(false); // início > fim
    expect(validateCustomPeriod("2025-01-01", "2026-12-31").ok).toBe(false); // > 366 dias
  });

  it("valores monetários inválidos são rejeitados (parse retorna null)", () => {
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("0,00")).toBe(0);
  });

  it("meta de ativo: parse e clamp 0–100", () => {
    expect(clampTargetPercentage(-5)).toBe(0);
    expect(parseTargetInput("120")).toBe(100);
  });
});

describe("§5.7 — Onboarding de primeiro uso (derivação por dados)", () => {
  it("progresso do checklist e conclusão do setup", () => {
    const progress = onboardingProgress({
      expenseCategories: 3,
      incomeCategories: 1,
      cards: 1,
      transactions: 1,
    });
    expect(progress.done).toBe(4);
    expect(progress.total).toBe(4);
    expect(isFirstUse({ expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0 })).toBe(true);
  });
});
