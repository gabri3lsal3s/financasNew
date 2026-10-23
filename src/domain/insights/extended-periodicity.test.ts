import { describe, expect, it } from "vitest";
import {
  detectAnnualCommitments,
  detectWeeklyCommitments,
} from "./extended-periodicity";
import type { ExpenseLike } from "./recurrences";

describe("extended-periodicity domain", () => {
  describe("detectAnnualCommitments", () => {
    it("detecta IPVA pago no ano anterior e gera alerta com 30 dias de antecedência", () => {
      const expenses: ExpenseLike[] = [
        {
          id: "exp-ipva-2025",
          description: "IPVA SP 2025",
          date: "2025-01-20",
          month: "2025-01",
          valueCents: 185000, // R$ 1.850,00
          categoryId: "cat-impostos",
          categoryName: "Impostos",
        },
      ];

      // Hoje: 5 de Janeiro de 2026 (faltam 15 dias para 20 de Janeiro de 2026)
      const commitments = detectAnnualCommitments(expenses, {
        todayISO: "2026-01-05",
      });

      expect(commitments).toHaveLength(1);
      const ipva = commitments[0]!;
      expect(ipva.name).toBe("IPVA");
      expect(ipva.lastValueCents).toBe(185000);
      expect(ipva.lastPaymentMonth).toBe("2025-01");
      expect(ipva.lastMonthName).toBe("Janeiro");
      expect(ipva.projectedDate).toBe("2026-01-20");
      expect(ipva.daysUntilDue).toBe(15);
      expect(ipva.isDueSoon).toBe(true);
      expect(ipva.isAlreadyPaidThisYear).toBe(false);
      expect(ipva.alertMessage).toBe(
        "No ano passado você pagou R$ 1.850,00 de IPVA em Janeiro. Deseja provisionar este valor?",
      );
    });

    it("identifica que o compromisso já foi pago no ano corrente e desativa isDueSoon", () => {
      const expenses: ExpenseLike[] = [
        {
          id: "exp-iptu-2025",
          description: "IPTU Parcela Única",
          date: "2025-02-10",
          month: "2025-02",
          valueCents: 92000, // R$ 920,00
          categoryId: "cat-moradia",
          categoryName: "Moradia",
        },
        {
          id: "exp-iptu-2026",
          description: "IPTU Parcela Única",
          date: "2026-02-08",
          month: "2026-02",
          valueCents: 95000, // R$ 950,00
          categoryId: "cat-moradia",
          categoryName: "Moradia",
        },
      ];

      const commitments = detectAnnualCommitments(expenses, {
        todayISO: "2026-02-09",
      });

      expect(commitments).toHaveLength(1);
      const iptu = commitments[0]!;
      expect(iptu.name).toBe("IPTU");
      expect(iptu.isAlreadyPaidThisYear).toBe(true);
      expect(iptu.isDueSoon).toBe(false);
    });

    it("detecta despesas genéricas espaçadas por ~365 dias como compromissos anuais", () => {
      const expenses: ExpenseLike[] = [
        {
          id: "exp-anual-1",
          description: "Associação Clube de Campo",
          date: "2024-05-15",
          month: "2024-05",
          valueCents: 60000,
          categoryId: "cat-lazer",
        },
        {
          id: "exp-anual-2",
          description: "Associação Clube de Campo",
          date: "2025-05-18", // 368 dias depois
          month: "2025-05",
          valueCents: 65000,
          categoryId: "cat-lazer",
        },
      ];

      // Hoje: 25 de Abril de 2026 (faltam ~23 dias para 18 de Maio de 2026)
      const commitments = detectAnnualCommitments(expenses, {
        todayISO: "2026-04-25",
      });

      expect(commitments).toHaveLength(1);
      const clube = commitments[0]!;
      expect(clube.lastValueCents).toBe(65000);
      expect(clube.projectedDate).toBe("2026-05-18");
      expect(clube.daysUntilDue).toBe(23);
      expect(clube.isDueSoon).toBe(true);
      expect(clube.alertMessage).toBe(
        "No ano passado você pagou R$ 650,00 de Associação Clube de Campo em Maio. Deseja provisionar este valor?",
      );
    });

    it("respeita feedbackMap e suprime compromissos ignorados", () => {
      const expenses: ExpenseLike[] = [
        {
          id: "exp-seguro-2025",
          description: "Porto Seguro Auto",
          date: "2025-11-20",
          month: "2025-11",
          valueCents: 240000,
          categoryId: "cat-auto",
        },
      ];

      const commitments = detectAnnualCommitments(expenses, {
        todayISO: "2026-11-01",
        feedbackMap: {
          "annual:seguro": "ignore",
        },
      });

      expect(commitments).toHaveLength(0);
    });
  });

  describe("detectWeeklyCommitments", () => {
    it("detecta sessões semanais de Terapia e calcula o custo mensal consolidado", () => {
      // 5 sessões semanais às terças-feiras de R$ 150,00
      const expenses: ExpenseLike[] = [
        { id: "e1", description: "Terapia Sessão", date: "2026-09-01", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" }, // Terça
        { id: "e2", description: "Terapia Sessão", date: "2026-09-08", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" }, // Terça (+7d)
        { id: "e3", description: "Terapia Sessão", date: "2026-09-15", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" }, // Terça (+7d)
        { id: "e4", description: "Terapia Sessão", date: "2026-09-22", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" }, // Terça (+7d)
        { id: "e5", description: "Terapia Sessão", date: "2026-09-29", month: "2026-09", valueCents: 15000, categoryId: "cat-saude" }, // Terça (+7d)
      ];

      const commitments = detectWeeklyCommitments(expenses, {
        todayISO: "2026-10-05",
      });

      expect(commitments).toHaveLength(1);
      const terapia = commitments[0]!;
      expect(terapia.key).toBe("weekly:terapia sessao");
      expect(terapia.averageWeeklyCents).toBe(15000); // R$ 150,00
      expect(terapia.monthlyConsolidatedCents).toBe(60000); // R$ 600,00 / mês
      expect(terapia.occurrencesPerMonth).toBe(4);
      expect(terapia.dayOfWeek).toBe(2); // Terça-feira
      expect(terapia.dayOfWeekLabel).toBe("Toda terça-feira");
      expect(terapia.confidence).toBeGreaterThanOrEqual(0.85);
      expect(terapia.active).toBe(true);
    });

    it("detecta serviço semanal de Diarista toda sexta-feira e consolida o valor", () => {
      const expenses: ExpenseLike[] = [
        { id: "d1", description: "Diarista Faxina", date: "2026-08-07", month: "2026-08", valueCents: 20000, categoryId: "cat-moradia" }, // Sexta
        { id: "d2", description: "Diarista Faxina", date: "2026-08-14", month: "2026-08", valueCents: 20000, categoryId: "cat-moradia" }, // Sexta (+7d)
        { id: "d3", description: "Diarista Faxina", date: "2026-08-21", month: "2026-08", valueCents: 20000, categoryId: "cat-moradia" }, // Sexta (+7d)
        { id: "d4", description: "Diarista Faxina", date: "2026-08-28", month: "2026-08", valueCents: 20000, categoryId: "cat-moradia" }, // Sexta (+7d)
      ];

      const commitments = detectWeeklyCommitments(expenses, {
        todayISO: "2026-09-01",
      });

      expect(commitments).toHaveLength(1);
      const diarista = commitments[0]!;
      expect(diarista.averageWeeklyCents).toBe(20000); // R$ 200,00
      expect(diarista.monthlyConsolidatedCents).toBe(80000); // R$ 800,00 / mês
      expect(diarista.dayOfWeek).toBe(5); // Sexta-feira
      expect(diarista.dayOfWeekLabel).toBe("Toda sexta-feira");
      expect(diarista.active).toBe(true);
    });

    it("não classifica despesas com intervalos aleatórios ou insuficientes como semanais", () => {
      const expenses: ExpenseLike[] = [
        { id: "r1", description: "Restaurante", date: "2026-09-01", month: "2026-09", valueCents: 5000, categoryId: "cat-alim" },
        { id: "r2", description: "Restaurante", date: "2026-09-03", month: "2026-09", valueCents: 7500, categoryId: "cat-alim" }, // +2d
        { id: "r3", description: "Restaurante", date: "2026-09-25", month: "2026-09", valueCents: 6200, categoryId: "cat-alim" }, // +22d
      ];

      const commitments = detectWeeklyCommitments(expenses, {
        todayISO: "2026-10-01",
      });

      expect(commitments).toHaveLength(0);
    });

    it("respeita feedbackMap e exclui ocorrências semanais ignoradas", () => {
      const expenses: ExpenseLike[] = [
        { id: "f1", description: "Feira Livre", date: "2026-09-06", month: "2026-09", valueCents: 10000, categoryId: "cat-alim" },
        { id: "f2", description: "Feira Livre", date: "2026-09-13", month: "2026-09", valueCents: 10000, categoryId: "cat-alim" },
        { id: "f3", description: "Feira Livre", date: "2026-09-20", month: "2026-09", valueCents: 10000, categoryId: "cat-alim" },
      ];

      const commitments = detectWeeklyCommitments(expenses, {
        todayISO: "2026-09-25",
        feedbackMap: {
          "weekly:feira livre": "ignore",
        },
      });

      expect(commitments).toHaveLength(0);
    });
  });
});
