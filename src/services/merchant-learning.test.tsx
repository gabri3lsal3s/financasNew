import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoLearnExpenseCategory,
  forgetCardDigitFeedback,
  forgetMerchantLearningAction,
  getCardDigitsMapping,
  getMerchantLearningMemory,
  recordCardDigitFeedback,
  recordMerchantLearningAction,
  recordTransactionLearning,
  setCardDigitsMapping,
  setMerchantLearningMemory,
  subscribeInsightsReevaluation,
  syncCardDigitsMappingFromCloud,
  syncMerchantLearningFromCloud,
  triggerSessionInsightsReevaluation,
  useCardDigitsMapping,
  useMerchantLearning,
} from "./merchant-learning";

vi.mock("@/data/repositories/user-preferences", () => ({
  updateCustomSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("services/merchant-learning — Memória Rápida e Persistência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMerchantLearningMemory({}, false);
    setCardDigitsMapping({}, false);
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("getMerchantLearningMemory responde em menos de 2ms", () => {
    const start = performance.now();
    const memory = getMerchantLearningMemory();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2);
    expect(memory).toEqual({});
  });

  it("recordMerchantLearningAction atualiza a memória local síncrona e incrementa contadores", () => {
    const now = "2026-10-21T18:00:00.000Z";
    const next = recordMerchantLearningAction(
      {
        friendlyName: "Padaria do Zé",
        categorySlug: "alimentacao",
        alias: "pag*padaria do ze",
      },
      now,
    );

    expect(next["name_padaria_do_ze"]).toBeDefined();
    expect(next["name_padaria_do_ze"]?.friendlyName).toBe("Padaria do Zé");
    expect(next["name_padaria_do_ze"]?.usageCount).toBe(1);

    // Segundo registro incrementa contadores
    const updated = recordMerchantLearningAction(
      {
        friendlyName: "Padaria do Zé",
        categorySlug: "alimentacao",
        alias: "padaria do ze centro",
      },
      "2026-10-21T18:05:00.000Z",
    );

    expect(updated["name_padaria_do_ze"]?.usageCount).toBe(2);
    expect(updated["name_padaria_do_ze"]?.rawAliases).toContain("pag*padaria do ze");
    expect(updated["name_padaria_do_ze"]?.rawAliases).toContain("padaria do ze centro");
  });

  it("forgetMerchantLearningAction remove registro com sucesso", () => {
    recordMerchantLearningAction({
      friendlyName: "Livraria Cultura",
      categorySlug: "lazer",
      alias: "cultura",
    });

    const memoryBefore = getMerchantLearningMemory();
    expect(memoryBefore["name_livraria_cultura"]).toBeDefined();

    const memoryAfter = forgetMerchantLearningAction("Livraria Cultura");
    expect(memoryAfter["name_livraria_cultura"]).toBeUndefined();
  });

  it("syncMerchantLearningFromCloud mescla registros da nuvem priorizando timestamps mais recentes", () => {
    setMerchantLearningMemory(
      {
        name_farmacia_vida: {
          friendlyName: "Farmácia Vida Local",
          categorySlug: "saude",
          rawAliases: ["farmacia vida"],
          usageCount: 2,
          lastUsedAt: "2026-10-21T12:00:00.000Z",
        },
      },
      false,
    );

    const cloudPayload = {
      name_farmacia_vida: {
        friendlyName: "Farmácia Vida Cloud",
        categorySlug: "saude",
        rawAliases: ["farmacia vida", "drogaria vida"],
        usageCount: 5,
        lastUsedAt: "2026-10-21T15:00:00.000Z", // Mais recente
      },
      name_posto_ipiranga: {
        friendlyName: "Posto Ipiranga",
        categorySlug: "transporte",
        rawAliases: ["posto ipiranga"],
        usageCount: 1,
        lastUsedAt: "2026-10-21T14:00:00.000Z",
      },
    };

    syncMerchantLearningFromCloud(cloudPayload);

    const current = getMerchantLearningMemory();
    // Priorizou o nome e data da nuvem por ser mais recente
    expect(current["name_farmacia_vida"]?.friendlyName).toBe("Farmácia Vida Cloud");
    expect(current["name_farmacia_vida"]?.usageCount).toBe(5);
    expect(current["name_farmacia_vida"]?.rawAliases).toContain("drogaria vida");
    // Adicionou o registro novo
    expect(current["name_posto_ipiranga"]?.friendlyName).toBe("Posto Ipiranga");
  });

  it("autoLearnExpenseCategory registra novas despesas em background sem travar", () => {
    autoLearnExpenseCategory("Restaurante Tempero Bom", "alimentacao");
    const current = getMerchantLearningMemory();
    expect(current["name_restaurante_tempero_bom"]?.friendlyName).toBe("Restaurante Tempero Bom");
    expect(current["name_restaurante_tempero_bom"]?.categorySlug).toBe("alimentacao");

    // Ignora descrições curtas ou vazias
    autoLearnExpenseCategory("a", "alimentacao");
    autoLearnExpenseCategory("", "alimentacao");
  });

  it("autoLearnExpenseCategory aprende aliases brutos (rawName) e dispara reavaliação de insights (§Eixo 1)", () => {
    const reevalSpy = vi.fn();
    const unsub = subscribeInsightsReevaluation(reevalSpy);

    autoLearnExpenseCategory(
      "Padaria Estrela",
      "alimentacao",
      undefined,
      "PAG*PadariaEstrela LTDA ME",
    );

    const current = getMerchantLearningMemory();
    const rec = current["name_padaria_estrela"];
    expect(rec).toBeDefined();
    expect(rec?.friendlyName).toBe("Padaria Estrela");
    expect(rec?.categorySlug).toBe("alimentacao");
    expect(rec?.rawAliases).toContain("pag*padariaestrela ltda me");

    expect(reevalSpy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("triggerSessionInsightsReevaluation notifica ouvintes inscritos", () => {
    const spy = vi.fn();
    const unsub = subscribeInsightsReevaluation(spy);

    triggerSessionInsightsReevaluation();
    expect(spy).toHaveBeenCalledTimes(1);

    unsub();
    triggerSessionInsightsReevaluation();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("services/merchant-learning — Hook useMerchantLearning & Concorrência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMerchantLearningMemory({}, false);
  });

  it("fornece estado reativo e resolve identidades de estabelecimentos", async () => {
    const { result } = renderHook(() => useMerchantLearning());

    expect(result.current.memory).toEqual({});

    await act(async () => {
      await result.current.recordLearning({
        friendlyName: "Posto Shell Central",
        categorySlug: "transporte",
        cnpjOrCpf: "33.453.598/0001-23",
        alias: "raizen combustiveis",
      });
    });

    expect(result.current.memory["tax_33453598000123"]).toBeDefined();
    expect(result.current.memory["tax_33453598000123"]?.friendlyName).toBe("Posto Shell Central");

    // Resolve via método integrado do hook usando a memória ativa
    const resolved = result.current.resolve({
      merchantOrDescription: "Raizen Combustiveis",
    });

    expect(resolved.friendlyName).toBe("Posto Shell Central");
    expect(resolved.categorySlug).toBe("transporte");
    expect(resolved.confidence).toBe("learned_alias");
    expect(resolved.isLearned).toBe(true);
  });

  it("lida com atualizações concorrentes sincronizando múltiplos hooks simultâneos", async () => {
    const hook1 = renderHook(() => useMerchantLearning());
    const hook2 = renderHook(() => useMerchantLearning());

    await act(async () => {
      await hook1.result.current.recordLearning({
        friendlyName: "Bar do Zé",
        categorySlug: "alimentacao",
        alias: "pag*bar do ze",
      });
    });

    // O hook2 deve ter sido notificado via listeners imediatamente
    expect(hook2.result.current.memory["name_bar_do_ze"]).toBeDefined();
    expect(hook2.result.current.memory["name_bar_do_ze"]?.friendlyName).toBe("Bar do Zé");

    await act(async () => {
      await hook2.result.current.forgetLearning("Bar do Zé");
    });

    // O hook1 deve refletir a exclusão imediatamente
    expect(hook1.result.current.memory["name_bar_do_ze"]).toBeUndefined();
  });
});

describe("services/merchant-learning — Memória e Sincronização de Dígitos de Cartão (§11.4 / Tarefa 3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCardDigitsMapping({}, false);
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("getCardDigitsMapping responde com mapa limpo", () => {
    const mapping = getCardDigitsMapping();
    expect(mapping).toEqual({});
  });

  it("recordCardDigitFeedback associa dígitos a um cardId e persiste de forma síncrona", () => {
    const updated = recordCardDigitFeedback("4821", "card-itau-uuid");
    expect(updated).toEqual({ "4821": "card-itau-uuid" });

    // Segunda associação acumula de forma imutável
    const updated2 = recordCardDigitFeedback("**** 3341", "card-stone-uuid");
    expect(updated2).toEqual({
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    });

    expect(getCardDigitsMapping()).toEqual({
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    });
  });

  it("forgetCardDigitFeedback remove mapeamento por cardId ou dígitos", () => {
    recordCardDigitFeedback("4821", "card-itau-uuid");
    recordCardDigitFeedback("3341", "card-stone-uuid");

    const afterCardRemoval = forgetCardDigitFeedback("card-itau-uuid");
    expect(afterCardRemoval).toEqual({ "3341": "card-stone-uuid" });

    const afterDigitRemoval = forgetCardDigitFeedback("3341");
    expect(afterDigitRemoval).toEqual({});
  });

  it("syncCardDigitsMappingFromCloud mescla dados da nuvem com dados locais", () => {
    setCardDigitsMapping({ "1111": "card-local-uuid" }, false);

    syncCardDigitsMappingFromCloud({
      "2222": "card-cloud-uuid",
      "1111": "card-cloud-antigo", // local prevalece
    });

    const current = getCardDigitsMapping();
    expect(current["2222"]).toBe("card-cloud-uuid");
    expect(current["1111"]).toBe("card-local-uuid");
  });

  it("hook useCardDigitsMapping provê estado reativo e métodos de consulta", async () => {
    const { result } = renderHook(() => useCardDigitsMapping());
    expect(result.current.cardDigitsMapping).toEqual({});

    await act(async () => {
      result.current.recordFeedback("5544", "card-c6-uuid");
    });

    expect(result.current.cardDigitsMapping["5544"]).toBe("card-c6-uuid");
    expect(result.current.lookupCard("**** 5544")).toBe("card-c6-uuid");
    expect(result.current.lookupCard("9999")).toBeUndefined();

    await act(async () => {
      result.current.forgetFeedback("5544");
    });

    expect(result.current.cardDigitsMapping["5544"]).toBeUndefined();
  });
});

describe("services/merchant-learning — Helper Unificado recordTransactionLearning (Tarefa 3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMerchantLearningMemory({}, false);
    setCardDigitsMapping({}, false);
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("recordTransactionLearning atualiza memória do estabelecimento, preferências e dígitos simultaneamente", () => {
    const reevalSpy = vi.fn();
    const unsub = subscribeInsightsReevaluation(reevalSpy);

    recordTransactionLearning({
      merchant: "Posto Shell Central",
      categoryId: "transporte",
      paymentMethod: "credit_card",
      cardId: "card-itau-black",
      cardLastDigits: "4821",
      taxId: "33.453.598/0001-23",
    });

    // 1. Memória do estabelecimento registrada com método e cartão preferencial
    const merchantMemory = getMerchantLearningMemory();
    const record = merchantMemory["tax_33453598000123"];
    expect(record).toBeDefined();
    expect(record?.friendlyName).toBe("Posto Shell Central");
    expect(record?.categorySlug).toBe("transporte");
    expect(record?.preferredPaymentMethod).toBe("credit_card");
    expect(record?.preferredCardId).toBe("card-itau-black");

    // 2. Dígitos do cartão mapeados
    const digitsMemory = getCardDigitsMapping();
    expect(digitsMemory["4821"]).toBe("card-itau-black");

    // 3. Reavaliação de insights disparada
    expect(reevalSpy).toHaveBeenCalledTimes(1);

    unsub();
  });

  it("recordTransactionLearning lida com transações sem cartão ou sem dígitos com segurança", () => {
    recordTransactionLearning({
      merchant: "Padaria da Esquina",
      categoryId: "alimentacao",
      paymentMethod: "pix",
    });

    const merchantMemory = getMerchantLearningMemory();
    const record = merchantMemory["name_padaria_da_esquina"];
    expect(record).toBeDefined();
    expect(record?.preferredPaymentMethod).toBe("pix");
    expect(record?.preferredCardId).toBeUndefined();

    // Nenhum dígito novo registrado
    expect(getCardDigitsMapping()).toEqual({});
  });
});

describe("services/merchant-learning — Memória e Sincronização de Dígitos de Cartão (§11.4 / Tarefa 3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCardDigitsMapping({}, false);
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("getCardDigitsMapping responde com mapa limpo", () => {
    const mapping = getCardDigitsMapping();
    expect(mapping).toEqual({});
  });

  it("recordCardDigitFeedback associa dígitos a um cardId e persiste de forma síncrona", () => {
    const updated = recordCardDigitFeedback("4821", "card-itau-uuid");
    expect(updated).toEqual({ "4821": "card-itau-uuid" });

    // Segunda associação acumula de forma imutável
    const updated2 = recordCardDigitFeedback("**** 3341", "card-stone-uuid");
    expect(updated2).toEqual({
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    });

    expect(getCardDigitsMapping()).toEqual({
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    });
  });

  it("forgetCardDigitFeedback remove mapeamento por cardId ou dígitos", () => {
    recordCardDigitFeedback("4821", "card-itau-uuid");
    recordCardDigitFeedback("3341", "card-stone-uuid");

    const afterCardRemoval = forgetCardDigitFeedback("card-itau-uuid");
    expect(afterCardRemoval).toEqual({ "3341": "card-stone-uuid" });

    const afterDigitRemoval = forgetCardDigitFeedback("3341");
    expect(afterDigitRemoval).toEqual({});
  });

  it("syncCardDigitsMappingFromCloud mescla dados da nuvem com dados locais", () => {
    setCardDigitsMapping({ "1111": "card-local-uuid" }, false);

    syncCardDigitsMappingFromCloud({
      "2222": "card-cloud-uuid",
      "1111": "card-cloud-antigo", // local prevalece
    });

    const current = getCardDigitsMapping();
    expect(current["2222"]).toBe("card-cloud-uuid");
    expect(current["1111"]).toBe("card-local-uuid");
  });

  it("hook useCardDigitsMapping provê estado reativo e métodos de consulta", async () => {
    const { result } = renderHook(() => useCardDigitsMapping());
    expect(result.current.cardDigitsMapping).toEqual({});

    await act(async () => {
      result.current.recordFeedback("5544", "card-c6-uuid");
    });

    expect(result.current.cardDigitsMapping["5544"]).toBe("card-c6-uuid");
    expect(result.current.lookupCard("**** 5544")).toBe("card-c6-uuid");
    expect(result.current.lookupCard("9999")).toBeUndefined();

    await act(async () => {
      result.current.forgetFeedback("5544");
    });

    expect(result.current.cardDigitsMapping["5544"]).toBeUndefined();
  });
});

describe("services/merchant-learning — Helper Unificado recordTransactionLearning (Tarefa 3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMerchantLearningMemory({}, false);
    setCardDigitsMapping({}, false);
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("recordTransactionLearning atualiza memória do estabelecimento, preferências e dígitos simultaneamente", () => {
    const reevalSpy = vi.fn();
    const unsub = subscribeInsightsReevaluation(reevalSpy);

    recordTransactionLearning({
      merchant: "Posto Shell Central",
      categoryId: "transporte",
      paymentMethod: "credit_card",
      cardId: "card-itau-black",
      cardLastDigits: "4821",
      taxId: "33.453.598/0001-23",
    });

    // 1. Memória do estabelecimento registrada com método e cartão preferencial
    const merchantMemory = getMerchantLearningMemory();
    const record = merchantMemory["tax_33453598000123"];
    expect(record).toBeDefined();
    expect(record?.friendlyName).toBe("Posto Shell Central");
    expect(record?.categorySlug).toBe("transporte");
    expect(record?.preferredPaymentMethod).toBe("credit_card");
    expect(record?.preferredCardId).toBe("card-itau-black");

    // 2. Dígitos do cartão mapeados
    const digitsMemory = getCardDigitsMapping();
    expect(digitsMemory["4821"]).toBe("card-itau-black");

    // 3. Reavaliação de insights disparada
    expect(reevalSpy).toHaveBeenCalledTimes(1);

    unsub();
  });

  it("recordTransactionLearning lida com transações sem cartão ou sem dígitos com segurança", () => {
    recordTransactionLearning({
      merchant: "Padaria da Esquina",
      categoryId: "alimentacao",
      paymentMethod: "pix",
    });

    const merchantMemory = getMerchantLearningMemory();
    const record = merchantMemory["name_padaria_da_esquina"];
    expect(record).toBeDefined();
    expect(record?.preferredPaymentMethod).toBe("pix");
    expect(record?.preferredCardId).toBeUndefined();

    // Nenhum dígito novo registrado
    expect(getCardDigitsMapping()).toEqual({});
  });
});
