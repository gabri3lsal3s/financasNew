import { describe, expect, it } from "vitest";
import type { CreditCard } from "@/types/schema";
import { resolveBestMatchingCard } from "./card-resolution";

function makeCard(overrides: Partial<CreditCard> & { id: string; name: string }): CreditCard {
  return {
    user_id: "user-1",
    brand: null,
    credit_limit: 500000,
    closing_day: 10,
    due_day: 17,
    color: null,
    is_active: true,
    ...overrides,
  };
}

describe("card-resolution — Motor Puro de Resolução e Auto-Vínculo de Cartão (Fase 11 / Tarefa 11.4)", () => {
  const cardNubank = makeCard({ id: "card-nu-1", name: "Nubank Roxinho", brand: "mastercard" });
  const cardRico = makeCard({ id: "card-rico-1", name: "Cartão Rico Visa Infinite", brand: "visa" });
  const cardItau = makeCard({ id: "card-itau-1", name: "Itaucard Pão de Açúcar final 4321", brand: "visa" });
  const cardXP = makeCard({ id: "card-xp-1", name: "Cartão XP", brand: "visa" });
  const cardBB = makeCard({ id: "card-bb-1", name: "Ourocard Fácil", brand: "visa" });

  it("retorna undefined quando lista de cartões for vazia ou nula", () => {
    expect(resolveBestMatchingCard([], { bankName: "Rico" })).toBeUndefined();
    expect(resolveBestMatchingCard(null, { bankName: "Rico" })).toBeUndefined();
    expect(resolveBestMatchingCard(undefined, { bankName: "Rico" })).toBeUndefined();
  });

  it("1ª Regra: prioriza cardId exato quando corresponder a um cartão ativo", () => {
    const cards = [cardNubank, cardRico, cardItau];
    const resolved = resolveBestMatchingCard(cards, { cardId: "card-rico-1" });
    expect(resolved?.id).toBe("card-rico-1");
  });

  it("ignora cardId se o cartão estiver inativo", () => {
    const inactiveRico = makeCard({ id: "card-rico-inativo", name: "Cartão Rico", is_active: false });
    const cards = [cardNubank, inactiveRico];
    const resolved = resolveBestMatchingCard(cards, { cardId: "card-rico-inativo" });
    // Cai para o fallback único ativo (Nubank)
    expect(resolved?.id).toBe("card-nu-1");
  });

  it("2ª Regra: resolve por cardLastDigits (4 dígitos)", () => {
    const cards = [cardNubank, cardRico, cardItau];
    const resolved = resolveBestMatchingCard(cards, { cardLastDigits: "4321" });
    expect(resolved?.id).toBe("card-itau-1");
  });

  it("trata cardId com 4 dígitos numéricos como cardLastDigits", () => {
    const cards = [cardNubank, cardRico, cardItau];
    const resolved = resolveBestMatchingCard(cards, { cardId: "4321" });
    expect(resolved?.id).toBe("card-itau-1");
  });

  it("3ª Regra: resolve por bankName / issuerBank com matching de substring", () => {
    const cards = [cardNubank, cardRico, cardXP];
    const resolvedRico = resolveBestMatchingCard(cards, { bankName: "Rico" });
    expect(resolvedRico?.id).toBe("card-rico-1");

    const resolvedXP = resolveBestMatchingCard(cards, { issuerBank: "XP Investimentos" });
    expect(resolvedXP?.id).toBe("card-xp-1");
  });

  it("resolve cardId com token textual de banco passado via query param (?cartao=Rico)", () => {
    const cards = [cardNubank, cardRico, cardXP];
    const resolved = resolveBestMatchingCard(cards, { cardId: "Rico" });
    expect(resolved?.id).toBe("card-rico-1");
  });

  it("resolve aliases de bancos brasileiros (Ourocard -> Banco do Brasil, Itaucard -> Itaú)", () => {
    const cards = [cardNubank, cardBB, cardItau];
    const resolvedBB = resolveBestMatchingCard(cards, { bankName: "Banco do Brasil" });
    expect(resolvedBB?.id).toBe("card-bb-1");

    const resolvedItau = resolveBestMatchingCard(cards, { issuerBank: "Itaú" });
    expect(resolvedItau?.id).toBe("card-itau-1");
  });

  it("4ª Regra: desempate por bandeira quando houver múltiplos cartões do mesmo emissor", () => {
    const ricoVisa = makeCard({ id: "rico-visa", name: "Cartão Rico", brand: "visa" });
    const ricoMaster = makeCard({ id: "rico-master", name: "Cartão Rico", brand: "mastercard" });
    const cards = [cardNubank, ricoVisa, ricoMaster];

    const resolved = resolveBestMatchingCard(cards, {
      issuerBank: "Rico",
      cardBrand: "Mastercard",
    });
    expect(resolved?.id).toBe("rico-master");
  });

  it("5ª Regra: adota fallback automático se houver exatamente 1 cartão ativo", () => {
    const cards = [cardNubank];
    // Nenhum parâmetro ou parâmetro sem match específico
    expect(resolveBestMatchingCard(cards, {})?.id).toBe("card-nu-1");
    expect(resolveBestMatchingCard(cards, { bankName: "Banco Desconhecido" })?.id).toBe("card-nu-1");
  });

  it("retorna undefined quando houver múltiplos cartões e nenhum critério casar", () => {
    const cards = [cardNubank, cardRico];
    const resolved = resolveBestMatchingCard(cards, { bankName: "Santander" });
    expect(resolved).toBeUndefined();
  });
});
