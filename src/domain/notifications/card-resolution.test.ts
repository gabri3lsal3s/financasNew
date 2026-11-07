import { describe, expect, it } from "vitest";
import type { CreditCard } from "@/types/schema";
import {
  extractLastFourDigits,
  resolveBestMatchingCard,
  resolveBestMatchingBankAccount,
  type BankAccount,
} from "./card-resolution";
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

  describe("extractLastFourDigits (Tarefa 3.2)", () => {
    it("extrai 4 dígitos de strings desmascaradas e prefixadas", () => {
      expect(extractLastFourDigits("1234")).toBe("1234");
      expect(extractLastFourDigits("final 1234")).toBe("1234");
      expect(extractLastFourDigits("terminado em 5678")).toBe("5678");
      expect(extractLastFourDigits("**** 9012")).toBe("9012");
      expect(extractLastFourDigits("****-4321")).toBe("4321");
      expect(extractLastFourDigits("cartão final 8899")).toBe("8899");
      expect(extractLastFourDigits("cartao final 7766")).toBe("7766");
      expect(extractLastFourDigits("Nubank Roxinho")).toBeUndefined();
      expect(extractLastFourDigits("")).toBeUndefined();
      expect(extractLastFourDigits(null)).toBeUndefined();
    });
  });

  describe("Resolução de Cartões com Unmasking, Bandeira e Virtual vs Físico (Tarefa 3.2)", () => {
    const cardNuFisico = makeCard({ id: "nu-fisico", name: "Nubank Físico", brand: "mastercard" });
    const cardNuVirtual = makeCard({ id: "nu-virtual", name: "Nubank Cartão Virtual", brand: "mastercard" });
    const cardItauVisa = makeCard({ id: "itau-visa", name: "Itaú Click", brand: "visa" });
    const cardItauMaster = makeCard({ id: "itau-master", name: "Itaú Click", brand: "mastercard" });
    const cardBradescoElo = makeCard({ id: "brad-elo", name: "Bradesco Elo Nanquim", brand: "elo" });
    const cardSantanderAmex = makeCard({ id: "sant-amex", name: "Santander The Platinum Card", brand: "amex" });

    it("casa 4 dígitos informados com máscaras textuais ('final 4321', '**** 4321')", () => {
      const cards = [cardNubank, cardRico, cardItau];
      expect(resolveBestMatchingCard(cards, { cardLastDigits: "final 4321" })?.id).toBe("card-itau-1");
      expect(resolveBestMatchingCard(cards, { cardLastDigits: "**** 4321" })?.id).toBe("card-itau-1");
      expect(resolveBestMatchingCard(cards, { cardLastDigits: "terminado em 4321" })?.id).toBe("card-itau-1");
      expect(resolveBestMatchingCard(cards, { cardId: "final 4321" })?.id).toBe("card-itau-1");
    });

    it("desempata entre cartão virtual e físico quando isVirtual for informado", () => {
      const cards = [cardNuFisico, cardNuVirtual];
      const resolvedVirtual = resolveBestMatchingCard(cards, {
        bankName: "Nubank",
        isVirtual: true,
      });
      expect(resolvedVirtual?.id).toBe("nu-virtual");

      const resolvedFisico = resolveBestMatchingCard(cards, {
        bankName: "Nubank",
        isVirtual: false,
      });
      expect(resolvedFisico?.id).toBe("nu-fisico");
    });

    it("desempata por bandeira para múltiplos cartões do mesmo banco (Visa, Mastercard, Elo, Amex)", () => {
      const cards = [cardItauVisa, cardItauMaster, cardBradescoElo, cardSantanderAmex];

      const resolvedMaster = resolveBestMatchingCard(cards, {
        bankName: "Itaú",
        cardBrand: "Mastercard",
      });
      expect(resolvedMaster?.id).toBe("itau-master");

      const resolvedVisa = resolveBestMatchingCard(cards, {
        bankName: "Itaú",
        cardBrand: "Visa",
      });
      expect(resolvedVisa?.id).toBe("itau-visa");

      const resolvedElo = resolveBestMatchingCard(cards, {
        bankName: "Bradesco",
        cardBrand: "Elo",
      });
      expect(resolvedElo?.id).toBe("brad-elo");

      const resolvedAmex = resolveBestMatchingCard(cards, {
        bankName: "Santander",
        cardBrand: "Amex",
      });
      expect(resolvedAmex?.id).toBe("sant-amex");
    });
  });

  describe("resolveBestMatchingBankAccount (Tarefa 3.3)", () => {
    const accNu: BankAccount = { id: "acc-nu", name: "NuConta", institution: "Nubank", is_active: true };
    const accItau: BankAccount = { id: "acc-itau", name: "Conta Corrente", institution: "Banco Itaú", is_active: true };
    const accInter: BankAccount = { id: "acc-inter", name: "Inter Digital", institution: "Banco Inter", is_active: true };
    const accInactive: BankAccount = { id: "acc-inativa", name: "Conta Antiga", institution: "Bradesco", is_active: false };
    const allAccounts = [accNu, accItau, accInter, accInactive];

    it("retorna undefined quando lista de contas for vazia ou nula", () => {
      expect(resolveBestMatchingBankAccount([], { bankName: "Nubank" })).toBeUndefined();
      expect(resolveBestMatchingBankAccount(null, { bankName: "Nubank" })).toBeUndefined();
      expect(resolveBestMatchingBankAccount(undefined, { bankName: "Nubank" })).toBeUndefined();
    });

    it("prioriza correspondência exata por accountId ativo", () => {
      expect(resolveBestMatchingBankAccount(allAccounts, { accountId: "acc-itau" })?.id).toBe("acc-itau");
    });

    it("ignora accountId se a conta estiver inativa", () => {
      // Como accInactive está inativa e há mais de 1 conta ativa, não retorna a inativa
      expect(resolveBestMatchingBankAccount(allAccounts, { accountId: "acc-inativa" })).toBeUndefined();
    });

    it("prioriza preferredAccountId se especificado e ativo", () => {
      expect(resolveBestMatchingBankAccount(allAccounts, { preferredAccountId: "acc-inter" })?.id).toBe("acc-inter");
    });

    it("resolve por bankName ou institution usando aliases bancários", () => {
      expect(resolveBestMatchingBankAccount(allAccounts, { bankName: "Nubank" })?.id).toBe("acc-nu");
      expect(resolveBestMatchingBankAccount(allAccounts, { bankName: "Nu" })?.id).toBe("acc-nu");
      expect(resolveBestMatchingBankAccount(allAccounts, { institution: "Itaú" })?.id).toBe("acc-itau");
      expect(resolveBestMatchingBankAccount(allAccounts, { bankName: "Inter" })?.id).toBe("acc-inter");
    });

    it("adota fallback para conta única ativa quando não houver outro critério específico", () => {
      const singleAccount = [accNu];
      expect(resolveBestMatchingBankAccount(singleAccount, { paymentMethod: "pix" })?.id).toBe("acc-nu");
      expect(resolveBestMatchingBankAccount(singleAccount, { bankName: "Banco Qualquer" })?.id).toBe("acc-nu");
    });

    it("retorna undefined se houver múltiplas contas ativas e nenhuma correspondência de banco", () => {
      expect(resolveBestMatchingBankAccount(allAccounts, { bankName: "Banco Safra" })).toBeUndefined();
    });
  });

  describe("Cascata de Desempate de Cartões em 6 Níveis (§Plano 09 — Fase 5)", () => {
    const cardNomadFisico = makeCard({
      id: "nomad-fisico",
      name: "Nomad Infinite",
      last_four_digits: "7756",
      brand: "visa",
    });
    const cardNomadVirtual = makeCard({
      id: "nomad-virtual",
      name: "Nomad Virtual",
      last_four_digits: "1234",
      brand: "visa",
    });
    const cardXpInfinite = makeCard({
      id: "xp-infinite",
      name: "XP Infinite",
      last_four_digits: "1234",
      brand: "visa",
    });
    const cardBradesco = makeCard({
      id: "bradesco-cartoes",
      name: "Bradesco Elo",
      brand: "elo",
    });

    const multiCards = [cardNomadFisico, cardNomadVirtual, cardXpInfinite, cardBradesco];

    it("Nível 1: resolve exatamente pelo campo last_four_digits cadastrado no cartão", () => {
      const resolved = resolveBestMatchingCard(multiCards, {
        cardLastDigits: "7756",
      });
      expect(resolved?.id).toBe("nomad-fisico");
    });

    it("Nível 1: desempata entre cartões do mesmo banco (Físico vs Virtual) por last_four_digits", () => {
      const resolvedFisico = resolveBestMatchingCard(multiCards, {
        cardLastDigits: "7756",
        bankName: "Nomad",
      });
      expect(resolvedFisico?.id).toBe("nomad-fisico");

      const resolvedVirtual = resolveBestMatchingCard(multiCards, {
        cardLastDigits: "1234",
        bankName: "Nomad",
      });
      expect(resolvedVirtual?.id).toBe("nomad-virtual");
    });

    it("Nível 2: resolve por preferredCardId memorizado para o estabelecimento quando sem dígitos", () => {
      const resolved = resolveBestMatchingCard(multiCards, {
        preferredCardId: "bradesco-cartoes",
      });
      expect(resolved?.id).toBe("bradesco-cartoes");
    });

    it("Nível 3: resolve por bankCardMapping quando o pacote Android for conhecido", () => {
      const bankMapping = {
        "com.nomadfinancial.app": "nomad-fisico",
        "com.bradesco": "bradesco-cartoes",
      };

      const resolved = resolveBestMatchingCard(multiCards, {
        packageName: "com.bradesco",
        bankCardMapping: bankMapping,
      });
      expect(resolved?.id).toBe("bradesco-cartoes");
    });

    it("Nível 3: vincula diretamente se o usuário tiver apenas 1 cartão daquele banco", () => {
      const cardsSubset = [cardNomadFisico, cardBradesco];
      const resolved = resolveBestMatchingCard(cardsSubset, {
        bankName: "Bradesco",
      });
      expect(resolved?.id).toBe("bradesco-cartoes");
    });

    it("Nível 4: resolve por correspondência semântica de bandeira quando banco empata", () => {
      const resolved = resolveBestMatchingCard(multiCards, {
        cardBrand: "Elo",
      });
      expect(resolved?.id).toBe("bradesco-cartoes");
    });
  });
});
