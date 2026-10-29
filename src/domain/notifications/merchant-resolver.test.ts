import { describe, expect, it } from "vitest";
import type { MerchantLearningMemory } from "./merchant-memory";
import {
  formatFriendlyTitle,
  resolveMerchantIdentity,
} from "./merchant-resolver";

describe("merchant-resolver — formatFriendlyTitle", () => {
  it("converte texto em maiúsculas para Title Case preservando conectivos", () => {
    expect(formatFriendlyTitle("PADARIA ESTRELA LTDA")).toBe("Padaria Estrela Ltda");
    expect(formatFriendlyTitle("PADARIA DO ZE E FILHOS")).toBe("Padaria do Ze e Filhos");
    expect(formatFriendlyTitle("MERCADO DA PRACA")).toBe("Mercado da Praca");
  });

  it("preserva textos que já possuem caixa mista ou camelCase", () => {
    expect(formatFriendlyTitle("McDonald's")).toBe("McDonald's");
    expect(formatFriendlyTitle("iFood")).toBe("iFood");
    expect(formatFriendlyTitle("Smart Fit")).toBe("Smart Fit");
  });

  it("trata strings vazias ou nulas adequadamente", () => {
    expect(formatFriendlyTitle("")).toBe("");
    expect(formatFriendlyTitle("   ")).toBe("");
  });
});

describe("merchant-resolver — 1ª Camada (Chave de Ouro: CNPJ/CPF)", () => {
  const mockUserMemory: MerchantLearningMemory = {
    tax_12345678000190: {
      friendlyName: "Padaria da Esquina",
      categorySlug: "alimentacao",
      cnpjOrCpf: "12345678000190",
      rawAliases: ["panificadora silva ltda"],
      usageCount: 4,
      lastUsedAt: "2026-10-21T18:00:00.000Z",
    },
  };

  it("prioriza correspondência exata de CNPJ na memória personalizada do usuário", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Panificadora Silva Ltda",
      taxId: "12.345.678/0001-90",
      userMemory: mockUserMemory,
    });

    expect(resolved.friendlyName).toBe("Padaria da Esquina");
    expect(resolved.categorySlug).toBe("alimentacao");
    expect(resolved.confidence).toBe("exact_tax_id");
    expect(resolved.isLearned).toBe(true);
    expect(resolved.taxId).toBe("12345678000190");
    expect(resolved.layer).toBe(1);
  });

  it("extrai CNPJ contextualmente do rawText do comprovante bancário", () => {
    const rawReceipt = `
      Comprovante de Transferência Pix
      Favorecido: Panificadora Silva Ltda
      CNPJ: 12.345.678/0001-90
      Valor: R$ 35,00
    `;

    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Pix Enviado",
      rawText: rawReceipt,
      userMemory: mockUserMemory,
    });

    expect(resolved.friendlyName).toBe("Padaria da Esquina");
    expect(resolved.categorySlug).toBe("alimentacao");
    expect(resolved.confidence).toBe("exact_tax_id");
    expect(resolved.isLearned).toBe(true);
    expect(resolved.layer).toBe(1);
  });

  it("recorre ao catálogo canônico nativo quando o CNPJ não está na memória do usuário", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Arcos Dourados Comercio de Alimentos",
      taxId: "42.591.651/0001-43", // CNPJ McDonald's
      userMemory: {}, // Memória do usuário vazia
    });

    expect(resolved.friendlyName).toBe("McDonald's");
    expect(resolved.categorySlug).toBe("alimentacao");
    expect(resolved.confidence).toBe("exact_tax_id");
    expect(resolved.isLearned).toBe(false);
    expect(resolved.taxId).toBe("42591651000143");
    expect(resolved.layer).toBe(1);
  });
});

describe("merchant-resolver — 2ª Camada (Memória Adaptativa do Usuário)", () => {
  const mockUserMemory: MerchantLearningMemory = {
    name_supermercado_do_bairro: {
      friendlyName: "Mercadinho do Bairro",
      categorySlug: "mercado",
      rawAliases: ["supermercado do bairro", "supermercado bairro ltda", "pag*bairro merc"],
      usageCount: 3,
      lastUsedAt: "2026-10-21T18:00:00.000Z",
    },
    name_pet_shop_amigo: {
      friendlyName: "Pet Shop Amigo Fiel",
      categorySlug: "compras",
      rawAliases: ["clinica e pet amigo fiel", "pag*amigofiel"],
      usageCount: 2,
      lastUsedAt: "2026-10-21T18:00:00.000Z",
    },
  };

  it("resolve pelo nome exato configurado na memória aprendida", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Mercadinho do Bairro",
      userMemory: mockUserMemory,
    });

    expect(resolved.friendlyName).toBe("Mercadinho do Bairro");
    expect(resolved.categorySlug).toBe("mercado");
    expect(resolved.confidence).toBe("learned_alias");
    expect(resolved.isLearned).toBe(true);
    expect(resolved.layer).toBe(2);
  });

  it("propaga preferredPaymentMethod e preferredCardId configurados na memória", () => {
    const memoryWithCard: MerchantLearningMemory = {
      name_posto_ipiranga: {
        friendlyName: "Posto Ipiranga",
        categorySlug: "transporte",
        rawAliases: ["posto ipiranga", "auto posto ipiranga"],
        usageCount: 1,
        lastUsedAt: "2026-10-29T10:00:00.000Z",
        preferredPaymentMethod: "credit_card",
        preferredCardId: "card-uuid-456",
      },
    };

    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Auto Posto Ipiranga",
      userMemory: memoryWithCard,
    });

    expect(resolved.friendlyName).toBe("Posto Ipiranga");
    expect(resolved.preferredPaymentMethod).toBe("credit_card");
    expect(resolved.preferredCardId).toBe("card-uuid-456");
  });

  it("propaga preferredPaymentMethod e preferredCardId configurados na memória", () => {
    const memoryWithCard: MerchantLearningMemory = {
      name_posto_ipiranga: {
        friendlyName: "Posto Ipiranga",
        categorySlug: "transporte",
        rawAliases: ["posto ipiranga", "auto posto ipiranga"],
        usageCount: 1,
        lastUsedAt: "2026-10-29T10:00:00.000Z",
        preferredPaymentMethod: "credit_card",
        preferredCardId: "card-uuid-456",
      },
    };

    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Auto Posto Ipiranga",
      userMemory: memoryWithCard,
    });

    expect(resolved.friendlyName).toBe("Posto Ipiranga");
    expect(resolved.preferredPaymentMethod).toBe("credit_card");
    expect(resolved.preferredCardId).toBe("card-uuid-456");
  });

  it("resolve por variação/alias prévia registrada mesmo com ruído de adquirente", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "PAG*BAIRRO MERC",
      userMemory: mockUserMemory,
    });

    expect(resolved.friendlyName).toBe("Mercadinho do Bairro");
    expect(resolved.categorySlug).toBe("mercado");
    expect(resolved.confidence).toBe("learned_alias");
    expect(resolved.isLearned).toBe(true);
    expect(resolved.layer).toBe(2);
  });

  it("resolve por substring de alias presente no rawText da notificação", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "Compra no Débito",
      rawText: "Compra aprovada de R$ 80,00 em pag*amigofiel cartao final 1234",
      userMemory: mockUserMemory,
    });

    expect(resolved.friendlyName).toBe("Pet Shop Amigo Fiel");
    expect(resolved.categorySlug).toBe("compras");
    expect(resolved.confidence).toBe("learned_alias");
    expect(resolved.isLearned).toBe(true);
    expect(resolved.layer).toBe(2);
  });
});

describe("merchant-resolver — 3ª Camada (Catálogo Canônico + Inferência por Palavras-Chave)", () => {
  it("3A: resolve através do catálogo de marcas brasileiras com ruído de maquininha", () => {
    const drogaRaia = resolveMerchantIdentity({
      merchantOrDescription: "PAG*DROGA RAIA SAO PAULO BR",
      userMemory: {},
    });

    expect(drogaRaia.friendlyName).toBe("Droga Raia");
    expect(drogaRaia.categorySlug).toBe("saude");
    expect(drogaRaia.confidence).toBe("canonical_catalog");
    expect(drogaRaia.isLearned).toBe(false);
    expect(drogaRaia.layer).toBe(3);

    const enel = resolveMerchantIdentity({
      merchantOrDescription: "ENEL DISTRIBUICAO SP",
      userMemory: {},
    });

    expect(enel.friendlyName).toBe("Enel");
    expect(enel.categorySlug).toBe("moradia");
    expect(enel.confidence).toBe("canonical_catalog");
    expect(enel.layer).toBe(3);

    const netflix = resolveMerchantIdentity({
      merchantOrDescription: "NETFLIX.COM ENTRETER",
      userMemory: {},
    });

    expect(netflix.friendlyName).toBe("Netflix");
    expect(netflix.categorySlug).toBe("assinaturas");
    expect(netflix.confidence).toBe("canonical_catalog");
    expect(netflix.layer).toBe(3);
  });

  it("3B: infere categoria semântica por palavras-chave quando a marca não está no catálogo", () => {
    const pizzaria = resolveMerchantIdentity({
      merchantOrDescription: "STONE*PIZZARIA FORNO A LENHA",
      userMemory: {},
    });

    expect(pizzaria.friendlyName).toBe("Pizzaria Forno a Lenha");
    expect(pizzaria.categorySlug).toBe("alimentacao");
    expect(pizzaria.confidence).toBe("inferred_keyword");
    expect(pizzaria.isLearned).toBe(false);
    expect(pizzaria.layer).toBe(3);

    const hortifruti = resolveMerchantIdentity({
      merchantOrDescription: "HORTIFRUTI VERDE VALE",
      userMemory: {},
    });

    expect(hortifruti.friendlyName).toBe("Hortifruti Verde Vale");
    expect(hortifruti.categorySlug).toBe("mercado");
    expect(hortifruti.confidence).toBe("inferred_keyword");
    expect(hortifruti.layer).toBe(3);
  });
});

describe("merchant-resolver — Fallback Seguro", () => {
  it("higieniza o nome e aplica categoria de fallback padrão para termos desconhecidos", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "PAG*EMPRESA XPTO SERVICOS 123",
      userMemory: {},
    });

    expect(resolved.friendlyName).toBe("Empresa Xpto Servicos 123");
    expect(resolved.categorySlug).toBe("compras");
    expect(resolved.confidence).toBe("fallback");
    expect(resolved.isLearned).toBe(false);
    expect(resolved.layer).toBe("fallback");
  });

  it("respeita fallbackCategorySlug customizado quando fornecido", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "PAG*COMERCIO GENERICO LTDA",
      userMemory: {},
      fallbackCategorySlug: "lazer",
    });

    expect(resolved.friendlyName).toBe("Comercio Generico Ltda");
    expect(resolved.categorySlug).toBe("lazer");
    expect(resolved.confidence).toBe("fallback");
    expect(resolved.layer).toBe("fallback");
  });

  it("atribui nome amigável padrão quando a entrada for completamente vazia", () => {
    const resolved = resolveMerchantIdentity({
      merchantOrDescription: "",
      rawText: "",
      userMemory: {},
    });

    expect(resolved.friendlyName).toBe("Despesa");
    expect(resolved.categorySlug).toBe("compras");
    expect(resolved.confidence).toBe("fallback");
    expect(resolved.layer).toBe("fallback");
  });
});
