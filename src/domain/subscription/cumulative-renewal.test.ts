import { describe, it, expect } from "vitest";
import {
  calculateCumulativePrice,
  getCumulativeDiscountPercentage,
  addCivilMonths,
  isCumulativeRenewalEligible,
  CUMULATIVE_RENEWAL_MAX_MONTHS,
} from "./cumulative-renewal";

describe("cumulative-renewal (Regras Canônicas de Pagamento Acumulativo)", () => {
  describe("Tabela de Descontos Progressivos", () => {
    it("aplica 5% de desconto para 2 e 3 meses", () => {
      expect(CUMULATIVE_RENEWAL_MAX_MONTHS).toBe(11);
      expect(getCumulativeDiscountPercentage(2)).toBe(5);
      expect(getCumulativeDiscountPercentage(3)).toBe(5);

      const price2 = calculateCumulativePrice(2);
      expect(price2.discountPercentage).toBe(5);
      expect(price2.monthlyEquivalentCents).toBe(1899); // R$ 18,99
      expect(price2.totalCents).toBe(3798); // R$ 37,98
      expect(price2.savingsCents).toBe(200); // R$ 2,00 de economia

      const price3 = calculateCumulativePrice(3);
      expect(price3.monthlyEquivalentCents).toBe(1899);
      expect(price3.totalCents).toBe(5697); // R$ 56,97
    });

    it("aplica 10% de desconto para 4, 5 e 6 meses", () => {
      expect(getCumulativeDiscountPercentage(4)).toBe(10);
      expect(getCumulativeDiscountPercentage(6)).toBe(10);

      const price6 = calculateCumulativePrice(6);
      expect(price6.discountPercentage).toBe(10);
      expect(price6.monthlyEquivalentCents).toBe(1799); // R$ 17,99
      expect(price6.totalCents).toBe(10794); // R$ 107,94
      expect(price6.savingsCents).toBe(1200); // R$ 12,00 de economia
    });

    it("aplica 15% de desconto para 7, 8 e 9 meses", () => {
      expect(getCumulativeDiscountPercentage(7)).toBe(15);
      expect(getCumulativeDiscountPercentage(9)).toBe(15);

      const price8 = calculateCumulativePrice(8);
      expect(price8.discountPercentage).toBe(15);
      expect(price8.monthlyEquivalentCents).toBe(1699); // R$ 16,99
      expect(price8.totalCents).toBe(13592); // R$ 135,92
    });

    it("aplica 20% de desconto para 10 e 11 meses", () => {
      expect(getCumulativeDiscountPercentage(10)).toBe(20);
      expect(getCumulativeDiscountPercentage(11)).toBe(20);

      const price11 = calculateCumulativePrice(11);
      expect(price11.discountPercentage).toBe(20);
      expect(price11.monthlyEquivalentCents).toBe(1599); // R$ 15,99
      expect(price11.totalCents).toBe(17589); // R$ 175,89
      expect(price11.savingsCents).toBe(4400); // R$ 44,00 de economia
      expect(price11.suggestAnnual).toBe(false);
    });

    it("dispara suggestAnnual para 12 ou mais meses (gatilho de ancoragem)", () => {
      const price12 = calculateCumulativePrice(12);
      expect(price12.suggestAnnual).toBe(true);
    });
  });

  describe("addCivilMonths (Prevenção de Month Overshoot)", () => {
    it("faz clamp para 28 de fevereiro em ano não-bissexto (31/01/2026 + 1 mês)", () => {
      const jan31 = new Date("2026-01-31T15:30:00.000Z");
      const febResult = addCivilMonths(jan31, 1);
      expect(febResult.toISOString()).toBe("2026-02-28T15:30:00.000Z");
    });

    it("faz clamp para 29 de fevereiro em ano bissexto (31/01/2024 + 1 mês)", () => {
      const jan31 = new Date("2024-01-31T12:00:00.000Z");
      const febResult = addCivilMonths(jan31, 1);
      expect(febResult.toISOString()).toBe("2024-02-29T12:00:00.000Z");
    });

    it("faz clamp para 30 de abril ao somar 1 mês em 31 de março", () => {
      const mar31 = new Date("2026-03-31T10:00:00.000Z");
      const aprResult = addCivilMonths(mar31, 1);
      expect(aprResult.toISOString()).toBe("2026-04-30T10:00:00.000Z");
    });

    it("soma meses preservando o dia quando o mês de destino comporta (15/05 + 3 meses = 15/08)", () => {
      const may15 = new Date("2026-05-15T18:00:00.000Z");
      const aug15 = addCivilMonths(may15, 3);
      expect(aug15.toISOString()).toBe("2026-08-15T18:00:00.000Z");
    });

    it("atravessa virada de ano civil com perfeição (10/11/2026 + 4 meses = 10/03/2027)", () => {
      const nov10 = new Date("2026-11-10T12:00:00.000Z");
      const mar10 = addCivilMonths(nov10, 4);
      expect(mar10.toISOString()).toBe("2027-03-10T12:00:00.000Z");
    });
  });

  describe("isCumulativeRenewalEligible", () => {
    const baseNow = new Date("2026-11-12T12:00:00.000Z");

    it("permite para assinante pro_monthly ativo", () => {
      expect(
        isCumulativeRenewalEligible({
          tier: "pro_monthly",
          status: "active",
          currentPeriodEnd: "2026-12-12T12:00:00.000Z",
          now: baseNow,
        }),
      ).toBe(true);
    });

    it("bloqueia para planos anuais, trial ou lifetime", () => {
      expect(
        isCumulativeRenewalEligible({
          tier: "pro_annual",
          status: "active",
          now: baseNow,
        }),
      ).toBe(false);

      expect(
        isCumulativeRenewalEligible({
          tier: "trial",
          status: "trialing",
          now: baseNow,
        }),
      ).toBe(false);
    });

    it("bloqueia se já houver migração pendente de plano", () => {
      expect(
        isCumulativeRenewalEligible({
          tier: "pro_monthly",
          status: "active",
          pendingPlanId: "pro_annual",
          now: baseNow,
        }),
      ).toBe(false);
    });

    it("bloqueia se a data de vigência já ultrapassar 11 meses a partir de hoje", () => {
      const futureDate12Months = addCivilMonths(baseNow, 12);
      expect(
        isCumulativeRenewalEligible({
          tier: "pro_monthly",
          status: "active",
          currentPeriodEnd: futureDate12Months,
          now: baseNow,
        }),
      ).toBe(false);
    });
  });
});
