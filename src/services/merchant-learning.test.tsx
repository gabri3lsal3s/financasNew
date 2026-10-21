import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoLearnExpenseCategory,
  forgetMerchantLearningAction,
  getMerchantLearningMemory,
  recordMerchantLearningAction,
  setMerchantLearningMemory,
  syncMerchantLearningFromCloud,
  useMerchantLearning,
} from "./merchant-learning";

vi.mock("@/data/repositories/user-preferences", () => ({
  updateCustomSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("services/merchant-learning — Memória Rápida e Persistência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMerchantLearningMemory({}, false);
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
