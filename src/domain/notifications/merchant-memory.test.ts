import { describe, expect, it } from "vitest";
import {
  forgetMerchantCategoryMemory,
  lookupMerchantCategory,
  recordMerchantCategoryMemory,
  resolveCategoryWithPriority,
  toMerchantMemoryKey,
} from "./merchant-memory";

describe("merchant-memory — Memória Adaptativa de Categorias", () => {
  it("normaliza corretamente o nome do estabelecimento para a chave de memória", () => {
    expect(toMerchantMemoryKey("Supermercado Aliança Ltda")).toBe("supermercado alianca ltda");
    expect(toMerchantMemoryKey("   PADARIA   ESTRELA   ")).toBe("padaria estrela");
    expect(toMerchantMemoryKey("")).toBe("");
  });

  it("retorna undefined quando o estabelecimento não consta na memória", () => {
    const memory = { "padaria estrela": "alimentacao" };
    expect(lookupMerchantCategory("Posto Shell", memory)).toBeUndefined();
    expect(lookupMerchantCategory(undefined, memory)).toBeUndefined();
    expect(lookupMerchantCategory("Padaria Estrela", undefined)).toBeUndefined();
  });

  it("retorna a categoria memorizada independentemente de maiúsculas e acentuação", () => {
    const memory = { "padaria estrela": "alimentacao" };
    expect(lookupMerchantCategory("PADÁRIA ÉSTRELA", memory)).toBe("alimentacao");
  });

  it("adiciona e atualiza registros na memória de forma imutável", () => {
    const initial = {};
    const updated = recordMerchantCategoryMemory("Drogaria Pacheco", "saude", initial);

    expect(updated).toEqual({ "drogaria pacheco": "saude" });
    expect(initial).toEqual({});

    const updatedAgain = recordMerchantCategoryMemory("Drogaria Pacheco", "farmacia_vip", updated);
    expect(updatedAgain["drogaria pacheco"]).toBe("farmacia_vip");
  });

  it("remove registros da memória de forma imutável", () => {
    const memory = { "uber trip": "transporte", "ifood": "alimentacao" };
    const forgotten = forgetMerchantCategoryMemory("Uber Trip", memory);

    expect(forgotten).toEqual({ ifood: "alimentacao" });
    expect(memory).toHaveProperty("uber trip");
  });

  it("resolveCategoryWithPriority prioriza a memória do usuário sobre o fallback genérico", () => {
    const memory = { "uber trip": "viagens" }; // Usuário prefere classificar Uber como viagens e não transporte
    const fallback = () => "transporte" as const;

    const resolved = resolveCategoryWithPriority("Uber Trip", "Corrida Uber", memory, fallback);
    expect(resolved).toBe("viagens");
  });

  it("resolveCategoryWithPriority usa fallback genérico se não estiver na memória", () => {
    const memory = {};
    const fallback = () => "transporte" as const;

    const resolved = resolveCategoryWithPriority("Uber Trip", "Corrida Uber", memory, fallback);
    expect(resolved).toBe("transporte");
  });
});
