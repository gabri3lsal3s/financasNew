import { describe, expect, it } from "vitest";
import {
  cleanTaxId,
  extractTaxIdFromText,
  findLearnedMerchant,
  forgetCardDigitsLearning,
  forgetMerchantCategoryMemory,
  forgetMerchantLearning,
  formatTaxId,
  lookupCardByDigits,
  lookupMerchantCategory,
  normalizeCardDigits,
  recordCardDigitsLearning,
  recordMerchantCategoryMemory,
  recordMerchantLearning,
  resolveCategoryWithPriority,
  toMerchantMemoryKey,
  type CardDigitsMapping,
  type MerchantLearningMemory,
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

describe("merchant-memory — Limpeza, Formatação e Extração de TaxId (CNPJ/CPF)", () => {
  it("cleanTaxId limpa dígitos e aceita exclusivamente 11 ou 14 dígitos", () => {
    expect(cleanTaxId("12.345.678/0001-90")).toBe("12345678000190");
    expect(cleanTaxId("123.456.789-01")).toBe("12345678901");
    expect(cleanTaxId("12345678000190")).toBe("12345678000190");
    expect(cleanTaxId("12345678901")).toBe("12345678901");

    // Inválidos ou comprimentos divergentes
    expect(cleanTaxId(undefined)).toBeUndefined();
    expect(cleanTaxId(null)).toBeUndefined();
    expect(cleanTaxId("")).toBeUndefined();
    expect(cleanTaxId("123.456.789")).toBeUndefined(); // 9 dígitos
    expect(cleanTaxId("123456789012345")).toBeUndefined(); // 15 dígitos
  });

  it("formatTaxId formata adequadamente CNPJs e CPFs limpos", () => {
    expect(formatTaxId("12345678000190")).toBe("12.345.678/0001-90");
    expect(formatTaxId("12345678901")).toBe("123.456.789-01");
    expect(formatTaxId("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatTaxId("invalid")).toBeUndefined();
  });

  it("extractTaxIdFromText extrai CNPJ formatado no padrão clássico", () => {
    const text = "Comprovante de Transferência\nFavorecido: Drogaria Raia S.A.\nCNPJ: 61.585.865/0240-42\nValor: R$ 45,90";
    expect(extractTaxIdFromText(text)).toBe("61585865024042");
  });

  it("extractTaxIdFromText extrai CPF formatado no padrão clássico", () => {
    const text = "Pix enviado com sucesso para Maria Silva (123.456.789-00) no valor de R$ 120,00";
    expect(extractTaxIdFromText(text)).toBe("12345678900");
  });

  it("extractTaxIdFromText extrai CNPJ desformatado precedido por marcador semântico", () => {
    const text1 = "Favorecido CNPJ 12345678000190 Arcos Dourados Comercio de Alimentos";
    expect(extractTaxIdFromText(text1)).toBe("12345678000190");

    const text2 = "Chave Pix CNPJ: 12345678000190 confirmada com sucesso";
    expect(extractTaxIdFromText(text2)).toBe("12345678000190");

    const text3 = "Cadastro Nacional da Pessoa Juridica: 12345678000190";
    expect(extractTaxIdFromText(text3)).toBe("12345678000190");
  });

  it("extractTaxIdFromText extrai CPF desformatado precedido por marcador semântico", () => {
    const text1 = "Chave Pix CPF: 12345678901 destinatário José Santos";
    expect(extractTaxIdFromText(text1)).toBe("12345678901");

    const text2 = "Doc: 12345678901 - Transferência realizada";
    expect(extractTaxIdFromText(text2)).toBe("12345678901");
  });

  it("extractTaxIdFromText rejeita números aleatórios de 14 dígitos sem marcador semântico", () => {
    const text = "Protocolo de autorização 20261021174700 gerado com sucesso";
    expect(extractTaxIdFromText(text)).toBeUndefined();
  });

  it("extractTaxIdFromText retorna undefined para texto vazio ou sem documento", () => {
    expect(extractTaxIdFromText("")).toBeUndefined();
    expect(extractTaxIdFromText(undefined)).toBeUndefined();
    expect(extractTaxIdFromText("Compra no débito de R$ 35,00 em Padaria Central")).toBeUndefined();
  });
});

describe("merchant-memory — Aprendizado Semântico de Estabelecimentos (MerchantLearningRecord)", () => {
  it("recordMerchantLearning cria novo registro quando a memória está vazia", () => {
    const now = "2026-10-21T17:47:00.000Z";
    const memory = recordMerchantLearning(
      {
        friendlyName: "McDonald's",
        categorySlug: "alimentacao",
        cnpjOrCpf: "42.591.651/0001-43",
        alias: "Arcos Dourados",
        rawAliases: ["mc donalds", "pag*mcdonalds"],
      },
      {},
      now,
    );

    const record = memory["tax_42591651000143"];
    expect(record).toBeDefined();
    expect(record?.friendlyName).toBe("McDonald's");
    expect(record?.categorySlug).toBe("alimentacao");
    expect(record?.cnpjOrCpf).toBe("42591651000143");
    expect(record?.usageCount).toBe(1);
    expect(record?.lastUsedAt).toBe(now);
    expect(record?.rawAliases).toContain("arcos dourados");
    expect(record?.rawAliases).toContain("mc donalds");
    expect(record?.rawAliases).toContain("pag*mcdonalds");
  });

  it("recordMerchantLearning atualiza e agrega aliases a um registro existente", () => {
    const initialNow = "2026-10-21T17:00:00.000Z";
    const initialMemory: MerchantLearningMemory = {
      tax_42591651000143: {
        friendlyName: "McDonald's",
        categorySlug: "alimentacao",
        cnpjOrCpf: "42591651000143",
        rawAliases: ["arcos dourados"],
        usageCount: 1,
        lastUsedAt: initialNow,
      },
    };

    const nextNow = "2026-10-21T17:50:00.000Z";
    const updatedMemory = recordMerchantLearning(
      {
        friendlyName: "McDonald's Drive Thru",
        categorySlug: "alimentacao",
        cnpjOrCpf: "42591651000143",
        alias: "pag*mcdonalds 01",
      },
      initialMemory,
      nextNow,
    );

    const record = updatedMemory["tax_42591651000143"];
    expect(record).toBeDefined();
    expect(record?.usageCount).toBe(2);
    expect(record?.lastUsedAt).toBe(nextNow);
    expect(record?.rawAliases).toContain("arcos dourados");
    expect(record?.rawAliases).toContain("pag*mcdonalds 01");
  });

  it("findLearnedMerchant encontra registro por taxId (Chave de Ouro)", () => {
    const memory: MerchantLearningMemory = {
      tax_42591651000143: {
        friendlyName: "McDonald's",
        categorySlug: "alimentacao",
        cnpjOrCpf: "42591651000143",
        rawAliases: ["arcos dourados"],
        usageCount: 3,
        lastUsedAt: "2026-10-21T12:00:00.000Z",
      },
    };

    const foundByCleanTax = findLearnedMerchant({ taxId: "42591651000143" }, memory);
    expect(foundByCleanTax?.friendlyName).toBe("McDonald's");

    const foundByFormattedTax = findLearnedMerchant({ taxId: "42.591.651/0001-43" }, memory);
    expect(foundByFormattedTax?.friendlyName).toBe("McDonald's");

    const foundByRawText = findLearnedMerchant(
      { rawText: "Pix para Arcos Dourados CNPJ 42.591.651/0001-43 R$ 38,00" },
      memory,
    );
    expect(foundByRawText?.friendlyName).toBe("McDonald's");
  });

  it("findLearnedMerchant encontra registro por alias ou nome amigável", () => {
    const memory: MerchantLearningMemory = {
      name_padaria_do_ze: {
        friendlyName: "Padaria do Zé",
        categorySlug: "mercado",
        rawAliases: ["jose da silva panificadora", "panificadora estrela"],
        usageCount: 2,
        lastUsedAt: "2026-10-21T12:00:00.000Z",
      },
    };

    const foundByName = findLearnedMerchant({ merchant: "Padaria do Zé" }, memory);
    expect(foundByName?.categorySlug).toBe("mercado");

    const foundByAlias = findLearnedMerchant({ merchant: "José da Silva Panificadora" }, memory);
    expect(foundByAlias?.friendlyName).toBe("Padaria do Zé");
  });

  it("findLearnedMerchant encontra registro por substring de alias no texto bruto", () => {
    const memory: MerchantLearningMemory = {
      name_netflix: {
        friendlyName: "Netflix",
        categorySlug: "streaming",
        rawAliases: ["netflix entretenimento", "netflix.com"],
        usageCount: 5,
        lastUsedAt: "2026-10-21T12:00:00.000Z",
      },
    };

    const found = findLearnedMerchant(
      { rawText: "Compra aprovada no cartão final 1234 em netflix.com no valor de R$ 55,90" },
      memory,
    );
    expect(found?.friendlyName).toBe("Netflix");
  });

  it("forgetMerchantLearning remove registro por taxId ou nome", () => {
    const memory: MerchantLearningMemory = {
      tax_12345678000190: {
        friendlyName: "Drogaria Pacheco",
        categorySlug: "saude",
        cnpjOrCpf: "12345678000190",
        rawAliases: ["drogaria pacheco"],
        usageCount: 1,
        lastUsedAt: "2026-10-21T10:00:00.000Z",
      },
      name_padaria_central: {
        friendlyName: "Padaria Central",
        categorySlug: "alimentacao",
        rawAliases: ["padaria central"],
        usageCount: 1,
        lastUsedAt: "2026-10-21T10:00:00.000Z",
      },
    };

    const afterTaxRemove = forgetMerchantLearning("12.345.678/0001-90", memory);
    expect(afterTaxRemove["tax_12345678000190"]).toBeUndefined();
    expect(afterTaxRemove["name_padaria_central"]).toBeDefined();

    const afterNameRemove = forgetMerchantLearning("Padaria Central", afterTaxRemove);
    expect(afterNameRemove["name_padaria_central"]).toBeUndefined();
    expect(Object.keys(afterNameRemove)).toHaveLength(0);
  });

  it("recordMerchantLearning armazena e preserva preferredPaymentMethod e preferredCardId", () => {
    const now = "2026-10-29T10:00:00.000Z";
    const initial = recordMerchantLearning(
      {
        friendlyName: "Posto Shell",
        categorySlug: "transporte",
        preferredPaymentMethod: "credit_card",
        preferredCardId: "card-itau-black-123",
      },
      {},
      now,
    );

    const record = initial["name_posto_shell"];
    expect(record).toBeDefined();
    expect(record?.preferredPaymentMethod).toBe("credit_card");
    expect(record?.preferredCardId).toBe("card-itau-black-123");

    // Atualização preserva os campos caso não sejam passados
    const updated = recordMerchantLearning(
      {
        friendlyName: "Posto Shell",
        categorySlug: "transporte",
        alias: "Auto Posto Shell",
      },
      initial,
      "2026-10-29T11:00:00.000Z",
    );

    const updatedRecord = updated["name_posto_shell"];
    expect(updatedRecord?.preferredPaymentMethod).toBe("credit_card");
    expect(updatedRecord?.preferredCardId).toBe("card-itau-black-123");
    expect(updatedRecord?.rawAliases).toContain("auto posto shell");

    // Atualização com novo método e cartão sobrescreve
    const overwritten = recordMerchantLearning(
      {
        friendlyName: "Posto Shell",
        categorySlug: "transporte",
        preferredPaymentMethod: "pix",
        preferredCardId: undefined,
      },
      updated,
      "2026-10-29T12:00:00.000Z",
    );

    const overwrittenRecord = overwritten["name_posto_shell"];
    expect(overwrittenRecord?.preferredPaymentMethod).toBe("pix");
  });
});

describe("merchant-memory — Mapeamento e Memória de Dígitos de Cartão (CardDigitsMapping)", () => {
  it("normalizeCardDigits limpa e extrai dígitos corretamente", () => {
    expect(normalizeCardDigits("4821")).toBe("4821");
    expect(normalizeCardDigits("**** 4821")).toBe("4821");
    expect(normalizeCardDigits("Cartão final 4821")).toBe("4821");
    expect(normalizeCardDigits("****.****.****.1029")).toBe("1029");
    expect(normalizeCardDigits("12")).toBe("12");
    expect(normalizeCardDigits("")).toBeUndefined();
    expect(normalizeCardDigits(undefined)).toBeUndefined();
    expect(normalizeCardDigits(null)).toBeUndefined();
    expect(normalizeCardDigits("a")).toBeUndefined();
  });

  it("recordCardDigitsLearning adiciona e atualiza mapeamentos de forma imutável", () => {
    const initial: CardDigitsMapping = {};
    const step1 = recordCardDigitsLearning("4821", "card-itau-uuid", initial);

    expect(step1).toEqual({ "4821": "card-itau-uuid" });
    expect(initial).toEqual({});

    const step2 = recordCardDigitsLearning("**** 3341", "card-stone-uuid", step1);
    expect(step2).toEqual({
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    });

    // Atualização de cartão existente para os mesmos dígitos
    const step3 = recordCardDigitsLearning("4821", "card-nubank-uuid", step2);
    expect(step3["4821"]).toBe("card-nubank-uuid");
  });

  it("lookupCardByDigits consulta o cartão correto aceitando dígitos mascarados ou puros", () => {
    const mapping: CardDigitsMapping = {
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
    };

    expect(lookupCardByDigits("4821", mapping)).toBe("card-itau-uuid");
    expect(lookupCardByDigits("**** 4821", mapping)).toBe("card-itau-uuid");
    expect(lookupCardByDigits("Final 3341", mapping)).toBe("card-stone-uuid");
    expect(lookupCardByDigits("9999", mapping)).toBeUndefined();
    expect(lookupCardByDigits(undefined, mapping)).toBeUndefined();
    expect(lookupCardByDigits("4821", undefined)).toBeUndefined();
  });

  it("forgetCardDigitsLearning remove associações por ID do cartão ou por dígitos", () => {
    const mapping: CardDigitsMapping = {
      "4821": "card-itau-uuid",
      "3341": "card-stone-uuid",
      "9988": "card-itau-uuid", // mesmo cartão itau com outro cartão virtual
    };

    // Remove todas as entradas associadas a card-itau-uuid
    const afterCardRemoval = forgetCardDigitsLearning("card-itau-uuid", mapping);
    expect(afterCardRemoval).toEqual({ "3341": "card-stone-uuid" });
    expect(mapping).toHaveProperty("4821");

    // Remove por dígitos
    const afterDigitRemoval = forgetCardDigitsLearning("3341", afterCardRemoval);
    expect(afterDigitRemoval).toEqual({});
  });
});

