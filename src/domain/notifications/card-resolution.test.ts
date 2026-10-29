import { describe, expect, it } from "vitest";
import type { CreditCard } from "@/types/schema";
import { resolveBestMatchingCard } from "./card-resolution";
import { recordCardDigitsLearning, type CardDigitsMapping } from "./merchant-memory";

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

  describe("Hierarquia Estrita em 5 Etapas e Memória de Dígitos (§11.4 / Fase 3)", () => {
    const itauBlack = makeCard({ id: "itau-black", name: "Itaú Personnalité Black", brand: "mastercard" });
    const c6Carbon = makeCard({ id: "c6-carbon", name: "C6 Carbon Mastercard Black", brand: "mastercard" });
    const nubankPlat = makeCard({ id: "nu-plat", name: "Nubank Platinum final 9911", brand: "mastercard" });
    const allCards = [itauBlack, c6Carbon, nubankPlat];

    it("1ª Prioridade: seleciona cartão via cardDigitsMapping mesmo sem dígitos no nome", () => {
      const mapping: CardDigitsMapping = {
        "4821": "itau-black",
      };

      const resolved = resolveBestMatchingCard(allCards, {
        cardLastDigits: "4821",
        cardDigitsMapping: mapping,
      });

      expect(resolved?.id).toBe("itau-black");
    });

    it("1ª Prioridade sobrepuja 2ª Prioridade (Dígitos Aprendidos > Dígitos no Nome)", () => {
      // nu-plat tem 9911 no nome, mas o usuário reconfigurou/aprendeu que 9911 é c6-carbon
      const mapping: CardDigitsMapping = {
        "9911": "c6-carbon",
      };

      const resolved = resolveBestMatchingCard(allCards, {
        cardLastDigits: "9911",
        cardDigitsMapping: mapping,
      });

      expect(resolved?.id).toBe("c6-carbon");
    });

    it("1ª Prioridade ignora mapping se o cartão correspondente estiver inativo", () => {
      const inactiveItau = makeCard({ id: "itau-black", name: "Itaú Black", is_active: false });
      const cardsWithInactive = [inactiveItau, c6Carbon, nubankPlat];
      const mapping: CardDigitsMapping = {
        "4821": "itau-black",
      };

      // Não deve selecionar o cartão inativo; como não há outro critério, retorna undefined
      const resolved = resolveBestMatchingCard(cardsWithInactive, {
        cardLastDigits: "4821",
        cardDigitsMapping: mapping,
      });

      expect(resolved).toBeUndefined();
    });

    it("4ª Prioridade: seleciona preferredCardId para estabelecimento habitual sem dígitos", () => {
      const resolved = resolveBestMatchingCard(allCards, {
        preferredCardId: "c6-carbon",
      });

      expect(resolved?.id).toBe("c6-carbon");
    });

    it("4ª Prioridade ignora preferredCardId se for de cartão inativo", () => {
      const inactiveC6 = makeCard({ id: "c6-carbon", name: "C6 Carbon", is_active: false });
      const cardsWithInactive = [itauBlack, inactiveC6, nubankPlat];

      const resolved = resolveBestMatchingCard(cardsWithInactive, {
        preferredCardId: "c6-carbon",
      });

      expect(resolved).toBeUndefined();
    });

    it("Quality Gate 3: simula fluxo completo de aprendizado de dígitos e preferência", () => {
      // 1. Primeira transação: usuário seleciona cartão C6 Carbon com final 4821
      let digitsMemory: CardDigitsMapping = {};
      digitsMemory = recordCardDigitsLearning("4821", "c6-carbon", digitsMemory);

      // 2. Segunda transação chega via notificação com '**** 4821': sistema seleciona C6 Carbon automaticamente
      const autoResolved = resolveBestMatchingCard(allCards, {
        cardLastDigits: "4821",
        cardDigitsMapping: digitsMemory,
      });
      expect(autoResolved?.id).toBe("c6-carbon");

      // 3. Terceira transação no mesmo estabelecimento habitual sem dígitos de cartão:
      // Herda o preferredCardId configurado
      const prefResolved = resolveBestMatchingCard(allCards, {
        preferredCardId: "c6-carbon",
      });
      expect(prefResolved?.id).toBe("c6-carbon");
    });
  });
});
