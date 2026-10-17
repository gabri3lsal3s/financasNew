import { describe, expect, it } from "vitest";
import { cardPaymentInputSchema, creditCardFormSchema } from "./schemas";

describe("schemas — Módulo de Cartões", () => {
  describe("creditCardFormSchema", () => {
    it("valida e normaliza formulário de cartão válido", () => {
      const input = {
        name: "  <b>Nubank</b> Ultravioleta  ",
        brand: " Mastercard ",
        credit_limit: 15000,
        closing_day: 10,
        due_day: 17,
        color: " #820ad1 ",
        is_active: true,
      };

      const parsed = creditCardFormSchema.parse(input);
      expect(parsed.name).toBe("Nubank Ultravioleta");
      expect(parsed.brand).toBe("Mastercard");
      expect(parsed.credit_limit).toBe(15000);
      expect(parsed.closing_day).toBe(10);
      expect(parsed.due_day).toBe(17);
      expect(parsed.color).toBe("#820ad1");
      expect(parsed.is_active).toBe(true);
    });

    it("rejeita dias de fechamento e vencimento fora do intervalo de 1 a 31", () => {
      expect(() =>
        creditCardFormSchema.parse({
          name: "Inter",
          closing_day: 0,
          due_day: 15,
        }),
      ).toThrow();

      expect(() =>
        creditCardFormSchema.parse({
          name: "Inter",
          closing_day: 10,
          due_day: 32,
        }),
      ).toThrow();
    });

    it("rejeita limites de crédito que excedem o teto monetário de segurança", () => {
      expect(() =>
        creditCardFormSchema.parse({
          name: "Black",
          closing_day: 5,
          due_day: 12,
          credit_limit: 10 ** 12,
        }),
      ).toThrow();
    });

    it("sanitiza tags HTML e caracteres de controle no nome do cartão", () => {
      const parsed = creditCardFormSchema.parse({
        name: "<script>alert(1)</script>Cartão XP\u0000",
        closing_day: 1,
        due_day: 10,
      });

      expect(parsed.name).toBe("alert(1)Cartão XP");
    });
  });

  describe("cardPaymentInputSchema", () => {
    it("valida pagamento de cartão com notas sanitizadas", () => {
      const input = {
        cardId: "card-123",
        competenceMonth: "2026-08",
        amount: 2540.5,
        date: "2026-08-15",
        note: "<b>Pagamento</b> integral da fatura",
      };

      const parsed = cardPaymentInputSchema.parse(input);
      expect(parsed.cardId).toBe("card-123");
      expect(parsed.competenceMonth).toBe("2026-08");
      expect(parsed.amount).toBe(2540.5);
      expect(parsed.note).toBe("Pagamento integral da fatura");
    });

    it("rejeita pagamentos com valor zero ou negativo", () => {
      expect(() =>
        cardPaymentInputSchema.parse({
          cardId: "card-1",
          competenceMonth: "2026-08",
          amount: 0,
          date: "2026-08-15",
        }),
      ).toThrow();

      expect(() =>
        cardPaymentInputSchema.parse({
          cardId: "card-1",
          competenceMonth: "2026-08",
          amount: -100,
          date: "2026-08-15",
        }),
      ).toThrow();
    });
  });
});
