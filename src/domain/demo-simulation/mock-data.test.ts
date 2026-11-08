import { describe, expect, it } from "vitest";
import { currentMonth, shiftMonth } from "@/lib/date";
import type { GoalTrackerSharePayload, SplitSharePayload } from "@/types";
import {
  DEMO_FAMILY_ID,
  DEMO_PARTNER_USER_ID,
  DEMO_USER_ID,
  formatIsoDate,
  generateMockFamily,
  generateMockFamilyConsolidation,
  generateMockFinances,
  generateMockInvestments,
  generateMockPublicShares,
  generateMockDebts,
  generateMockLoans,
  generateMockIncomeGoals,
  getTourSteps,
  TOUR_STEPS,
} from "./index";

describe("demo-simulation — Datasets Puros e Dinâmicos em Memória (Fase 2)", () => {
  describe("formatIsoDate", () => {
    it("formata a data corretamente com zero à esquerda", () => {
      expect(formatIsoDate("2026-10", 5)).toBe("2026-10-05");
      expect(formatIsoDate("2026-10", 15)).toBe("2026-10-15");
    });

    it("limita o dia ao total de dias do mês fornecido", () => {
      // Abril tem 30 dias
      expect(formatIsoDate("2026-04", 31)).toBe("2026-04-30");
      // Fevereiro de 2026 (ano não bissexto) tem 28 dias
      expect(formatIsoDate("2026-02", 30)).toBe("2026-02-28");
    });

    it("limita dias menores que 1 ao primeiro dia do mês", () => {
      expect(formatIsoDate("2026-05", 0)).toBe("2026-05-01");
      expect(formatIsoDate("2026-05", -5)).toBe("2026-05-01");
    });
  });

  describe("generateMockFinances", () => {
    it("gera dados dinâmicos ancorados no mês corrente por padrão", () => {
      const nowMonth = currentMonth();
      const prevMonth = shiftMonth(nowMonth, -1);
      const dataset = generateMockFinances();

      expect(dataset.referenceMonth).toBe(nowMonth);
      expect(dataset.previousMonth).toBe(prevMonth);

      // Validação de categorias
      expect(dataset.categories.length).toBeGreaterThanOrEqual(8);
      const expenseCats = dataset.categories.filter((c) => c.type === "expense");
      const incomeCats = dataset.categories.filter((c) => c.type === "income");
      expect(expenseCats.length).toBeGreaterThan(0);
      expect(incomeCats.length).toBeGreaterThan(0);

      // Validação de cartões
      expect(dataset.cards).toHaveLength(1);
      const [card] = dataset.cards;
      expect(card?.credit_limit).toBeGreaterThan(0);
      expect(card?.closing_day).toBe(25);
      expect(card?.due_day).toBe(5);

      // Validação de receitas: todas no mês de referência ou no anterior
      expect(dataset.incomes.length).toBeGreaterThan(0);
      for (const inc of dataset.incomes) {
        expect(inc.value).toBeGreaterThan(0);
        const incMonth = inc.date.slice(0, 7);
        expect([nowMonth, prevMonth]).toContain(incMonth);
      }

      // Validação de despesas: todas com valor positivo e datas consistentes
      expect(dataset.expenses.length).toBeGreaterThan(0);
      for (const exp of dataset.expenses) {
        expect(exp.value).toBeGreaterThan(0);
        const expMonth = exp.date.slice(0, 7);
        expect([nowMonth, prevMonth]).toContain(expMonth);
      }

      // Validação de orçamentos: todos vinculados ao mês de referência
      expect(dataset.budgets.length).toBeGreaterThan(0);
      for (const b of dataset.budgets) {
        expect(b.month).toBe(nowMonth);
        expect(b.limit).toBeGreaterThan(0);
      }

      // Validação de pagamentos de cartão simulados
      expect(dataset.cardPayments.length).toBeGreaterThan(0);
      for (const p of dataset.cardPayments) {
        expect(p.amount).toBeGreaterThan(0);
        expect(p.card_id).toBe("card-demo-black");
      }

      // Validação de dívidas, contas a pagar, a receber e parcelas de contratos
      expect(dataset.debts.length).toBeGreaterThanOrEqual(10);
      expect(dataset.debts.some((d) => d.type === "payable")).toBe(true);
      expect(dataset.debts.some((d) => d.type === "receivable")).toBe(true);
      expect(dataset.debts.some((d) => d.paid_at !== null)).toBe(true);
      expect(dataset.debts.some((d) => d.paid_at === null)).toBe(true);
      expect(dataset.debts.some((d) => d.installment_group_id !== null)).toBe(true);

      // Validação de contratos de crédito / financiamento
      expect(dataset.loans).toHaveLength(2);
      expect(dataset.loans.some((l) => l.amortization_system === "sac")).toBe(true);
      expect(dataset.loans.some((l) => l.amortization_system === "price")).toBe(true);

      // Validação de metas de renda
      expect(dataset.incomeGoals.length).toBeGreaterThan(0);
      for (const g of dataset.incomeGoals) {
        expect(g.month).toBe(nowMonth);
        expect(g.expected).toBeGreaterThan(0);
      }
    });

    it("suporta mês de referência arbitrário mantendo integridade temporal", () => {
      const customMonth = "2025-08";
      const customPrevMonth = "2025-07";
      const dataset = generateMockFinances(customMonth);

      expect(dataset.referenceMonth).toBe(customMonth);
      expect(dataset.previousMonth).toBe(customPrevMonth);

      const refExpenses = dataset.expenses.filter((e) => e.date.startsWith(customMonth));
      const prevExpenses = dataset.expenses.filter((e) => e.date.startsWith(customPrevMonth));

      expect(refExpenses.length).toBeGreaterThan(0);
      expect(prevExpenses.length).toBeGreaterThan(0);

      // Nenhuma data fora de customMonth e customPrevMonth
      for (const exp of dataset.expenses) {
        const expMonth = exp.date.slice(0, 7);
        expect([customMonth, customPrevMonth]).toContain(expMonth);
      }
    });

    it("mantém coerência entre compras no cartão e competência de fatura", () => {
      const customMonth = "2026-11";
      const dataset = generateMockFinances(customMonth);
      const cardExpenses = dataset.expenses.filter((e) => e.payment_method === "credit_card");

      expect(cardExpenses.length).toBeGreaterThan(0);
      for (const exp of cardExpenses) {
        expect(exp.card_id).toBe("card-demo-black");
        expect(exp.bill_competence).toBeDefined();
      }

      // Checagem de compra parcelada
      const installmentExpense = dataset.expenses.find((e) => e.installments_total > 1);
      expect(installmentExpense).toBeDefined();
      expect(installmentExpense?.installment_group_id).toBeTruthy();
      expect(installmentExpense?.installment_number).toBeLessThanOrEqual(
        installmentExpense?.installments_total ?? 1,
      );
    });

    it("inclui despesas familiares com is_family: true e family_id consistente", () => {
      const dataset = generateMockFinances();
      const familyExpenses = dataset.expenses.filter((e) => e.is_family);

      expect(familyExpenses.length).toBeGreaterThanOrEqual(1);
      for (const exp of familyExpenses) {
        expect(exp.is_family).toBe(true);
        expect(exp.family_id).toBe(DEMO_FAMILY_ID);
        expect(exp.user_id).toBe(DEMO_USER_ID);
      }
    });

    it("agrega compartilhamentos públicos, unidade familiar e consolidação no dataset diário", () => {
      const dataset = generateMockFinances();

      expect(dataset.publicShares).toBeDefined();
      expect(dataset.publicShares.length).toBeGreaterThanOrEqual(2);
      expect(dataset.family).toBeDefined();
      expect(dataset.family?.family.id).toBe(DEMO_FAMILY_ID);
      expect(dataset.familyConsolidation).toBeDefined();
      expect(dataset.familyConsolidation?.family.id).toBe(DEMO_FAMILY_ID);
    });
  });

  describe("Finanças Compartilhadas Mock (Plano 04 — Tarefa 1.2)", () => {
    describe("generateMockPublicShares", () => {
      it("gera racha ativo com 4 participantes e 2 pagamentos já sinalizados via Pix", () => {
        const shares = generateMockPublicShares("2026-11");
        const splitShare = shares.find((s) => s.kind === "split");

        expect(splitShare).toBeDefined();
        expect(splitShare?.is_revoked).toBe(false);

        const payload = splitShare?.payload as unknown as SplitSharePayload;
        expect(payload).toBeDefined();
        expect(payload.is_completed).toBe(false);
        expect(payload.people_count).toBe(4);
        expect(payload.participants).toHaveLength(4);

        // Anfitrião
        const host = payload.participants.find((p) => p.is_host);
        expect(host).toBeDefined();
        expect(host?.is_settled).toBe(true);

        // Participantes convidados
        const guests = payload.participants.filter((p) => !p.is_host);
        expect(guests).toHaveLength(3);

        // 2 pagamentos sinalizados
        const signaledGuests = guests.filter((g) => g.has_payment_signal);
        expect(signaledGuests).toHaveLength(2);

        // Sinalizações em payment_signals
        expect(payload.payment_signals).toBeDefined();
        expect(payload.payment_signals).toHaveLength(2);
        for (const signal of payload.payment_signals ?? []) {
          expect(signal.status).toBe("pending");
          expect(signal.amount_cents).toBeGreaterThan(0);
        }

        // Chave Pix válida mockada
        expect(payload.pix_key).toBeTruthy();
        expect(payload.pix_key_type).toBe("email");
        expect(payload.pix_br_code).toContain("BR.GOV.BCB.PIX");
      });

      it("gera meta pública coletiva com arrecadação em exatos 75% e chave Pix mockada", () => {
        const shares = generateMockPublicShares("2026-11");
        const goalShare = shares.find((s) => s.kind === "goal_tracker");

        expect(goalShare).toBeDefined();
        expect(goalShare?.is_revoked).toBe(false);

        const payload = goalShare?.payload as unknown as GoalTrackerSharePayload;
        expect(payload).toBeDefined();
        expect(payload.status).toBe("active");
        expect(payload.target_cents).toBe(800000);
        expect(payload.current_cents).toBe(600000);

        // Taxa de arrecadação exatamente 75%
        const percentage = (payload.current_cents ?? 0) / payload.target_cents;
        expect(percentage).toBe(0.75);

        // Chave Pix mockada e BR Code
        expect(payload.pix_key).toBe("viagem.familia@exemplo.com");
        expect(payload.pix_key_type).toBe("email");
        expect(payload.pix_br_code).toContain("BR.GOV.BCB.PIX");

        // Contribuições transparentes mockadas
        expect(payload.contributions).toBeDefined();
        expect(payload.contributions?.length).toBeGreaterThanOrEqual(3);
        const sumContribs = (payload.contributions ?? []).reduce((acc, c) => acc + c.amount_cents, 0);
        expect(sumContribs).toBe(payload.current_cents);
      });
    });

    describe("generateMockFamily e generateMockFamilyConsolidation", () => {
      it("gera unidade familiar simulada com 2 membros", () => {
        const familyData = generateMockFamily();

        expect(familyData.family.id).toBe(DEMO_FAMILY_ID);
        expect(familyData.family.owner_id).toBe(DEMO_USER_ID);
        expect(familyData.family.split_rule).toBe("equal");
        expect(familyData.members).toHaveLength(2);

        const owner = familyData.members.find((m) => m.role === "owner");
        const partner = familyData.members.find((m) => m.role === "member");

        expect(owner?.user_id).toBe(DEMO_USER_ID);
        expect(partner?.user_id).toBe(DEMO_PARTNER_USER_ID);
        expect(owner?.split_ratio).toBe(0.5);
        expect(partner?.split_ratio).toBe(0.5);
      });

      it("gera consolidação familiar com 2 membros e acerto de contas perfeitamente equilibrado", () => {
        const month = "2026-11";
        const consolidation = generateMockFamilyConsolidation(month);

        expect(consolidation.family.id).toBe(DEMO_FAMILY_ID);
        expect(consolidation.month).toBe(month);
        expect(consolidation.members).toHaveLength(2);

        const [m1, m2] = consolidation.members;
        expect(m1).toBeDefined();
        expect(m2).toBeDefined();

        // Equilíbrio perfeito: ambos pagaram exatamente 50%
        expect(m1?.spent_cents).toBe(m2?.spent_cents);
        expect(m1?.percentage_of_total).toBe(50);
        expect(m2?.percentage_of_total).toBe(50);
        expect(consolidation.total_spent_cents).toBe((m1?.spent_cents ?? 0) + (m2?.spent_cents ?? 0));

        // Acerto de contas auditado sem pendências
        expect(consolidation.is_settled).toBe(true);
        expect(consolidation.has_post_settlement_expenses).toBe(false);
        expect(consolidation.settlement).toBeDefined();
        expect(consolidation.settlement?.amount_cents).toBe(0);
        expect(consolidation.settlement?.notes).toContain("50% / 50%");
      });
    });
  });

  describe("generateMockInvestments", () => {
    it("gera carteira balanceada com soma de metas igual a 100%", () => {
      const dataset = generateMockInvestments("2026-10");

      // Classes balanceadas
      expect(dataset.assets.length).toBeGreaterThanOrEqual(6);
      const assetClasses = new Set(dataset.assets.map((a) => a.asset_class));
      expect(assetClasses).toContain("Renda Fixa");
      expect(assetClasses).toContain("Ações Brasil");
      expect(assetClasses).toContain("FIIs");
      expect(assetClasses).toContain("Cripto");

      // Soma de metas por classe == 100%
      const totalGroupPercent = dataset.groupTargets.reduce(
        (sum, t) => sum + t.target_percentage,
        0,
      );
      expect(totalGroupPercent).toBe(100);

      // Soma de metas por ativo == 100%
      const totalAllocPercent = dataset.allocationTargets.reduce(
        (sum, t) => sum + t.target_percentage,
        0,
      );
      expect(totalAllocPercent).toBe(100);

      // Todo ativo em allocationTargets existe em assets
      const assetIds = new Set(dataset.assets.map((a) => a.id));
      for (const target of dataset.allocationTargets) {
        expect(assetIds.has(target.asset_id)).toBe(true);
      }
    });

    it("gera curva patrimonial crescente de 3 meses para os snapshots", () => {
      const refMonth = "2026-10";
      const dataset = generateMockInvestments(refMonth);

      expect(dataset.snapshots).toHaveLength(3);
      expect(dataset.snapshots[0]?.month).toBe("2026-08");
      expect(dataset.snapshots[1]?.month).toBe("2026-09");
      expect(dataset.snapshots[2]?.month).toBe("2026-10");

      // Patrimônio crescente
      const val0 = dataset.snapshots[0]?.total_value ?? 0;
      const val1 = dataset.snapshots[1]?.total_value ?? 0;
      const val2 = dataset.snapshots[2]?.total_value ?? 0;
      expect(val1).toBeGreaterThan(val0);
      expect(val2).toBeGreaterThan(val1);
    });

    it("gera proventos e aportes condizentes com o mês corrente", () => {
      const refMonth = "2026-10";
      const dataset = generateMockInvestments(refMonth);

      expect(dataset.contributions.length).toBeGreaterThan(0);
      expect(dataset.dividends.length).toBeGreaterThan(0);

      for (const d of dataset.dividends) {
        expect(d.date.startsWith(refMonth)).toBe(true);
        expect(d.amount).toBeGreaterThan(0);
      }
    });
  });

  describe("TOUR_STEPS e getTourSteps", () => {
    it("fornece 5 passos na trilha de finanças e 5 na de investimentos", () => {
      const financesSteps = getTourSteps("finances");
      const investmentsSteps = getTourSteps("investments");

      expect(financesSteps).toHaveLength(5);
      expect(investmentsSteps).toHaveLength(5);

      // Ordem sequencial
      expect(financesSteps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
      expect(investmentsSteps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);

      // Todas as rotas iniciam com '/'
      for (const step of [...financesSteps, ...investmentsSteps]) {
        expect(step.targetRoute.startsWith("/")).toBe(true);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      }
    });

    it("garante ausência total de emojis e caracteres decorativos nos textos do tour", () => {
      const allSteps = [...TOUR_STEPS.finances, ...TOUR_STEPS.investments];
      const emojiRegex = /\p{Extended_Pictographic}/u;

      for (const step of allSteps) {
        expect(emojiRegex.test(step.title)).toBe(false);
        expect(emojiRegex.test(step.description)).toBe(false);
        if (step.badgeLabel) {
          expect(emojiRegex.test(step.badgeLabel)).toBe(false);
        }
        if (step.actionLabel) {
          expect(emojiRegex.test(step.actionLabel)).toBe(false);
        }
      }
    });
  });

  describe("generateMockDebts, generateMockLoans e generateMockIncomeGoals", () => {
    it("generateMockDebts gera contas a pagar e receber com dados consistentes", () => {
      const debts = generateMockDebts();
      expect(debts.length).toBeGreaterThan(0);

      const payables = debts.filter((d) => d.type === "payable");
      const receivables = debts.filter((d) => d.type === "receivable");

      expect(payables.length).toBeGreaterThan(0);
      expect(receivables.length).toBeGreaterThan(0);

      // Contas a pagar com status pendente e quitado
      expect(payables.some((d) => d.paid_at === null)).toBe(true);
      expect(payables.some((d) => d.paid_at !== null)).toBe(true);

      // Contas a receber com status pendente e quitado
      expect(receivables.some((d) => d.paid_at === null)).toBe(true);
      expect(receivables.some((d) => d.paid_at !== null)).toBe(true);

      // Todos os itens têm valores estritamente positivos
      for (const d of debts) {
        expect(d.amount).toBeGreaterThan(0);
        expect(d.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("generateMockLoans gera contratos de crédito Price e SAC com valores válidos", () => {
      const loans = generateMockLoans();
      expect(loans.length).toBe(2);

      const sacLoan = loans.find((l) => l.amortization_system === "sac");
      const priceLoan = loans.find((l) => l.amortization_system === "price");

      expect(sacLoan).toBeDefined();
      expect(priceLoan).toBeDefined();
      expect(sacLoan?.principal_amount).toBeGreaterThan(0);
      expect(priceLoan?.principal_amount).toBeGreaterThan(0);
      expect(sacLoan?.interest_rate_monthly).toBeGreaterThan(0);
      expect(priceLoan?.interest_rate_monthly).toBeGreaterThan(0);
      expect(sacLoan?.total_installments).toBeGreaterThan(0);
      expect(priceLoan?.total_installments).toBeGreaterThan(0);
    });

    it("generateMockIncomeGoals gera metas de renda com valores consistentes", () => {
      const goals = generateMockIncomeGoals();
      expect(goals.length).toBeGreaterThan(0);
      for (const g of goals) {
        expect(g.expected).toBeGreaterThan(0);
        expect(g.month).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });
});

