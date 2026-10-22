import { describe, expect, it } from "vitest";
import {
  calculateAllCardsSubscriptionImpact,
  calculateCardSubscriptionImpact,
  getNextInvoiceClosingDate,
  isSubscriptionDueBeforeClosing,
  type CardForImpact,
} from "./card-radar";
import type { RecurrenceOccurrence } from "./recurrences";

describe("card-radar domain — Impacto de assinaturas por cartão de crédito (F22)", () => {
  const cardNubank: CardForImpact = {
    id: "card-nubank",
    name: "Nubank Ultravioleta",
    closing_day: 10,
    due_day: 17,
    credit_limit: 5000, // R$ 5.000,00
  };

  const cardXP: CardForImpact = {
    id: "card-xp",
    name: "XP Visa Infinite",
    closing_day: 25,
    due_day: 5,
    credit_limit: 10000,
  };

  const occurrences: RecurrenceOccurrence[] = [
    {
      key: "sub:netflix",
      name: "Netflix",
      level: "subscription",
      segment: "streaming",
      months: ["2026-06", "2026-07", "2026-08"],
      averageCents: 3990, // R$ 39,90
      confidence: 0.98,
      typicalDayOfMonth: 8,
      nextDueDate: "2026-08-08",
      daysUntilNextDue: 4,
      cardId: "card-nubank",
      cardName: "Nubank Ultravioleta",
      paymentMethod: "credit_card",
    },
    {
      key: "sub:spotify",
      name: "Spotify",
      level: "subscription",
      segment: "streaming",
      months: ["2026-06", "2026-07", "2026-08"],
      averageCents: 2190, // R$ 21,90
      confidence: 0.95,
      typicalDayOfMonth: 15,
      nextDueDate: "2026-08-15",
      daysUntilNextDue: 11,
      cardId: "card-nubank",
      cardName: "Nubank Ultravioleta",
      paymentMethod: "credit_card",
    },
    {
      key: "sub:aws",
      name: "Amazon Web Services",
      level: "subscription",
      segment: "cloud_ai",
      months: ["2026-06", "2026-07", "2026-08"],
      averageCents: 15000, // R$ 150,00
      confidence: 0.99,
      typicalDayOfMonth: 20,
      nextDueDate: "2026-08-20",
      daysUntilNextDue: 16,
      cardId: "card-xp",
      cardName: "XP Visa Infinite",
      paymentMethod: "credit_card",
    },
  ];

  describe("getNextInvoiceClosingDate", () => {
    it("retorna o fechamento no mês corrente se hoje for antes do dia de fechamento", () => {
      const closingDate = getNextInvoiceClosingDate(10, "2026-08-04");
      expect(closingDate).toBe("2026-08-10");
    });

    it("avança para o mês seguinte se hoje for igual ao dia de fechamento", () => {
      const closingDate = getNextInvoiceClosingDate(10, "2026-08-10");
      expect(closingDate).toBe("2026-09-10");
    });

    it("avança para o mês seguinte se hoje for posterior ao dia de fechamento", () => {
      const closingDate = getNextInvoiceClosingDate(10, "2026-08-15");
      expect(closingDate).toBe("2026-09-10");
    });

    it("avança de ano na virada de dezembro para janeiro", () => {
      const closingDate = getNextInvoiceClosingDate(20, "2026-12-25");
      expect(closingDate).toBe("2027-01-20");
    });

    it("clampa o dia para meses mais curtos como fevereiro", () => {
      const closingDate = getNextInvoiceClosingDate(31, "2026-01-31");
      expect(closingDate).toBe("2026-02-28");
    });
  });

  describe("isSubscriptionDueBeforeClosing", () => {
    it("retorna true para assinatura cuja data estimada cai antes do fechamento", () => {
      const occ = occurrences[0]!; // Netflix no dia 8
      expect(isSubscriptionDueBeforeClosing(occ, "2026-08-10", "2026-08-04", 10)).toBe(true);
    });

    it("retorna false para assinatura que vence após a data de fechamento", () => {
      const occ = occurrences[1]!; // Spotify no dia 15
      expect(isSubscriptionDueBeforeClosing(occ, "2026-08-10", "2026-08-04", 10)).toBe(false);
    });

    it("retorna true se a assinatura está pendente no mês (missingThisMonth) com dia típico antes do fechamento", () => {
      const missingOcc: RecurrenceOccurrence = {
        key: "sub:cloud",
        name: "Cloud Storage",
        level: "subscription",
        months: ["2026-06", "2026-07"],
        averageCents: 1000,
        confidence: 0.9,
        typicalDayOfMonth: 5,
        nextDueDate: "2026-08-05",
        missingThisMonth: true,
      };
      // Hoje é dia 7, fechamento dia 10
      expect(isSubscriptionDueBeforeClosing(missingOcc, "2026-08-10", "2026-08-07", 10)).toBe(true);
    });
  });

  describe("calculateCardSubscriptionImpact", () => {
    it("calcula o total de assinaturas antes do fechamento e gera a mensagem informativa", () => {
      // Hoje é 04/08/2026, fechamento do Nubank é dia 10 (2026-08-10).
      // Apenas Netflix (dia 08, R$ 39,90) entra antes do fechamento. Spotify (dia 15) fica para a próxima.
      const impact = calculateCardSubscriptionImpact(cardNubank, occurrences, {
        todayISO: "2026-08-04",
      });

      expect(impact.cardId).toBe("card-nubank");
      expect(impact.nextClosingDate).toBe("2026-08-10");
      expect(impact.daysUntilClosing).toBe(6);
      expect(impact.totalProjectedCents).toBe(3990);
      expect(impact.projectedCount).toBe(1);
      expect(impact.items[0]?.name).toBe("Netflix");
      expect(impact.message).toBe(
        "Você possui R$ 39,90 em assinaturas previstas para este cartão antes do fechamento da fatura",
      );
      expect(impact.exceedsAvailableLimit).toBe(false);
      expect(impact.warningMessage).toBeUndefined();
    });

    it("inclui múltiplas assinaturas se todas vencerem antes do fechamento", () => {
      // Para o cartão XP, fechamento é dia 25. AWS (dia 20) entra perfeitamente.
      const impact = calculateCardSubscriptionImpact(cardXP, occurrences, {
        todayISO: "2026-08-04",
      });

      expect(impact.cardId).toBe("card-xp");
      expect(impact.totalProjectedCents).toBe(15000);
      expect(impact.message).toBe(
        "Você possui R$ 150,00 em assinaturas previstas para este cartão antes do fechamento da fatura",
      );
    });

    it("dispara alerta preventivo quando o total de assinaturas supera o limite disponível restante", () => {
      // Limite disponível do Nubank reduzido para R$ 20,00 (2000 centavos)
      const impact = calculateCardSubscriptionImpact(cardNubank, occurrences, {
        todayISO: "2026-08-04",
        availableLimitCents: 2000,
      });

      expect(impact.totalProjectedCents).toBe(3990);
      expect(impact.availableLimitCents).toBe(2000);
      expect(impact.exceedsAvailableLimit).toBe(true);
      expect(impact.overflowCents).toBe(1990);
      expect(impact.warningMessage).toContain("supera o limite disponível de R$ 20,00 em R$ 19,90");
    });

    it("calcula limite disponível a partir de currentInvoiceSpentCents se não informado explicitamente", () => {
      // Limite total = 500000 (R$ 5.000,00). Gasto na fatura = 498000 (R$ 4.980,00).
      // Limite disponível resultante = 2000 (R$ 20,00). Assinatura = 3990 (R$ 39,90).
      const impact = calculateCardSubscriptionImpact(cardNubank, occurrences, {
        todayISO: "2026-08-04",
        currentInvoiceSpentCents: 498000,
      });

      expect(impact.availableLimitCents).toBe(2000);
      expect(impact.exceedsAvailableLimit).toBe(true);
    });

    it("lida corretamente com cartão sem limite cadastrado (credit_limit = null)", () => {
      const unlimitedCard: CardForImpact = {
        ...cardNubank,
        credit_limit: null,
      };

      const impact = calculateCardSubscriptionImpact(unlimitedCard, occurrences, {
        todayISO: "2026-08-04",
      });

      expect(impact.totalLimitCents).toBeNull();
      expect(impact.availableLimitCents).toBeNull();
      expect(impact.exceedsAvailableLimit).toBe(false);
      expect(impact.warningMessage).toBeUndefined();
    });

    it("retorna total zero caso nenhuma assinatura esteja vinculada ao cartão", () => {
      const otherCard: CardForImpact = {
        id: "card-inter",
        name: "Inter Gold",
        closing_day: 12,
        due_day: 20,
      };

      const impact = calculateCardSubscriptionImpact(otherCard, occurrences, {
        todayISO: "2026-08-04",
      });

      expect(impact.totalProjectedCents).toBe(0);
      expect(impact.projectedCount).toBe(0);
      expect(impact.items).toEqual([]);
      expect(impact.exceedsAvailableLimit).toBe(false);
    });

    it("descarta ocorrências com lifecycle 'lapsed' (descontinuadas há 2+ meses)", () => {
      const lapsedOccurrences: RecurrenceOccurrence[] = [
        ...occurrences,
        {
          key: "recurring:almoco-sabor-do-bem",
          name: "Almoço Sabor do Bem",
          level: "recurring",
          lifecycle: "lapsed",
          months: ["2026-04", "2026-05"],
          averageCents: 9150,
          confidence: 0.9,
          cardId: "card-nubank",
          paymentMethod: "credit_card",
        },
      ];

      const impact = calculateCardSubscriptionImpact(cardNubank, lapsedOccurrences, {
        todayISO: "2026-08-04",
      });

      // Almoço Sabor do Bem não deve entrar na projeção
      const saborItem = impact.items.find((i) => i.name === "Almoço Sabor do Bem");
      expect(saborItem).toBeUndefined();
      expect(impact.totalProjectedCents).toBe(3990); // apenas Netflix
    });

    it("suprime previsão se a assinatura já estiver lançada/faturada na fatura aberta (ex.: parcela Vivo Easy)", () => {
      const vivoOccurrences: RecurrenceOccurrence[] = [
        {
          key: "sub:vivo-easy",
          name: "Vivo Easy",
          level: "subscription",
          months: ["2026-06", "2026-07"],
          averageCents: 4500,
          confidence: 0.95,
          typicalDayOfMonth: 3,
          nextDueDate: "2026-08-08",
          cardId: "card-nubank",
          paymentMethod: "credit_card",
        },
      ];

      // Cenário 1: sem parcela na fatura -> projeta normalmente
      const withoutInstallment = calculateCardSubscriptionImpact(cardNubank, vivoOccurrences, {
        todayISO: "2026-08-04",
      });
      expect(withoutInstallment.totalProjectedCents).toBe(4500);

      // Cenário 2: com parcela de Vivo Easy já lançada na fatura aberta -> suprime projeção para não duplicar
      const withInstallment = calculateCardSubscriptionImpact(cardNubank, vivoOccurrences, {
        todayISO: "2026-08-04",
        existingCardExpenses: [
          { description: "Vivo Easy (Chip pessoal)", installmentGroupId: "group-123" },
        ],
      });
      expect(withInstallment.totalProjectedCents).toBe(0);
      expect(withInstallment.items).toHaveLength(0);
    });
  });

  describe("calculateAllCardsSubscriptionImpact", () => {
    it("processa todos os cartões cadastrados simultaneamente", () => {
      const impacts = calculateAllCardsSubscriptionImpact(
        [cardNubank, cardXP],
        occurrences,
        { todayISO: "2026-08-04" },
      );

      expect(impacts).toHaveLength(2);
      expect(impacts[0]?.cardId).toBe("card-nubank");
      expect(impacts[0]?.totalProjectedCents).toBe(3990);
      expect(impacts[1]?.cardId).toBe("card-xp");
      expect(impacts[1]?.totalProjectedCents).toBe(15000);
    });
  });
});
