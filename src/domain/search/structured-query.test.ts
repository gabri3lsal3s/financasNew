import { describe, expect, it } from "vitest";
import type { MerchantLearningMemory } from "@/domain/notifications";
import {
  buildStructuredQueryBadges,
  matchesStructuredTransactionQuery,
  parseStructuredSearchQuery,
} from "./structured-query";

describe("structured-query — Parser Semântico Offline", () => {
  it("extrai limites monetários ('acima de', 'até', 'entre'), parcelas e janela temporal", () => {
    const parsed = parseStructuredSearchQuery("compras parceladas acima de 200 nos últimos 3 meses", {
      todayISO: "2026-11-23",
      referenceMonth: "2026-11",
    });

    expect(parsed.nature).toBe("expense");
    expect(parsed.onlyInstallments).toBe(true);
    expect(parsed.minAmountCents).toBe(20_000);
    expect(parsed.monthScope).toEqual({
      kind: "last_3_months",
      fromMonth: "2026-09",
      toMonth: "2026-11",
    });
    expect(parsed.textTokens).toEqual([]);

    const badges = buildStructuredQueryBadges(parsed);
    expect(badges).toContain("Parcelado");
    expect(badges).toContain("Últimos 3 meses");
    expect(badges.some((b) => b.includes("200,00"))).toBe(true);
  });

  it("expande conceitos em pt-BR (pet/reforma) + tags semânticas aprendidas no merchantLearning", () => {
    const memory: MerchantLearningMemory = {
      tax_moleza: {
        friendlyName: "Rede Moleza",
        categorySlug: "cat-casa",
        rawAliases: ["REDE MOLEZA"],
        semanticTags: ["eletrica", "reforma", "pulverizador"],
        usageCount: 2,
        lastUsedAt: "2026-11-23T12:00:00.000Z",
      },
    };

    const parsed = parseStructuredSearchQuery("gastos com reforma acima de 100", {
      todayISO: "2026-11-23",
      referenceMonth: "2026-11",
      merchantLearning: memory,
    });

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "REDE MOLEZA",
          categoryName: "Casa",
          date: "2026-11-10",
          amountCents: 27_000,
          paymentMethod: "cash",
        },
        parsed,
      ),
    ).toBe(true);

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "REDE MOLEZA",
          categoryName: "Casa",
          date: "2026-11-10",
          amountCents: 5_000,
          paymentMethod: "cash",
        },
        parsed,
      ),
    ).toBe(false);
  });

  it("filtra corretamente por intervalo 'entre X e Y', Pix, cartão e mês passado", () => {
    const parsed = parseStructuredSearchQuery("pix entre 50 e 150 mês passado", {
      todayISO: "2026-11-23",
      referenceMonth: "2026-11",
    });

    expect(parsed.paymentMethod).toBe("pix");
    expect(parsed.minAmountCents).toBe(5_000);
    expect(parsed.maxAmountCents).toBe(15_000);
    expect(parsed.monthScope).toEqual({
      kind: "previous_month",
      month: "2026-10",
    });

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "Padaria Central",
          date: "2026-10-15",
          amountCents: 8_500,
          paymentMethod: "pix",
        },
        parsed,
      ),
    ).toBe(true);

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "Padaria Central",
          date: "2026-11-15",
          amountCents: 8_500,
          paymentMethod: "pix",
        },
        parsed,
      ),
    ).toBe(false);
  });

  it("filtra recorrências com 'mensalidades acima de 50' e transações com 'cartão nubank'", () => {
    const parsedRecurring = parseStructuredSearchQuery("mensalidades acima de 50");
    expect(parsedRecurring.onlyRecurring).toBe(true);
    expect(parsedRecurring.minAmountCents).toBe(5_000);
    expect(parsedRecurring.textTokens).toEqual([]);

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "Smart Fit",
          date: "2026-11-10",
          amountCents: 11_990,
          recurrenceId: "rec-gym-1",
          paymentMethod: "credit_card",
        },
        parsedRecurring,
      ),
    ).toBe(true);

    const parsedCard = parseStructuredSearchQuery("cartão nubank");
    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "Restaurante Sabor",
          cardName: "Nubank",
          date: "2026-11-10",
          amountCents: 6_500,
          paymentMethod: "credit_card",
        },
        parsedCard,
      ),
    ).toBe(true);

    expect(
      matchesStructuredTransactionQuery(
        {
          kind: "expense",
          description: "Restaurante Sabor",
          cardName: "Itaú",
          date: "2026-11-10",
          amountCents: 6_500,
          paymentMethod: "credit_card",
        },
        parsedCard,
      ),
    ).toBe(false);
  });
});
