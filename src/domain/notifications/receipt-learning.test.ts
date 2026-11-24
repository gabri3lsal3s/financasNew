import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReceiptLearningMemory,
  getLearnedReceiptPreferences,
  learnFromReceiptCorrection,
  lookupReceiptPreferenceInMerchantMemory,
  migrateLegacyReceiptDictToMerchantMemory,
  normalizeMerchantKey,
} from "./receipt-learning";

describe("receipt-learning (Plano 10 — Fase 5)", () => {
  beforeEach(() => {
    clearReceiptLearningMemory();
  });

  it("normaliza chaves de estabelecimentos removendo acentos e pontuacao", () => {
    expect(normalizeMerchantKey("PADARIA SÃO JOSÉ LTDA.")).toBe("padariasaojoseltda");
    expect(normalizeMerchantKey("Drogaria Araújo - S/A")).toBe("drogariaaraujosa");
  });

  it("aprende correcao do usuario e recupera por CNPJ", () => {
    learnFromReceiptCorrection({
      cnpj: "88.709.563/0001-02",
      rawMerchant: "REDE MOLEZA DISTRIBUICAO LTDA",
      correctedMerchant: "Rede Moleza",
      categorySlug: "lazer",
      paymentMethod: "cash",
    });

    const learned = getLearnedReceiptPreferences({
      cnpj: "88.709.563/0001-02",
    });

    expect(learned).not.toBeNull();
    expect(learned?.merchantName).toBe("Rede Moleza");
    expect(learned?.categorySlug).toBe("lazer");
    expect(learned?.paymentMethod).toBe("cash");
    expect(learned?.usageCount).toBe(1);
  });

  it("recupera preferencia por nome corrigido ou nome bruto", () => {
    learnFromReceiptCorrection({
      rawMerchant: "MELLO E SIMON COMERCIO",
      correctedMerchant: "Popularmed Farmácias",
      categorySlug: "saude",
      paymentMethod: "debit",
      cardLastDigits: "4821",
    });

    // Recupera pelo nome bruto original que veio no OCR
    const byRaw = getLearnedReceiptPreferences({
      merchantName: "MELLO E SIMON COMERCIO",
    });
    expect(byRaw?.merchantName).toBe("Popularmed Farmácias");
    expect(byRaw?.categorySlug).toBe("saude");
    expect(byRaw?.cardLastDigits).toBe("4821");

    // Recupera pelo nome corrigido
    const byCorrected = getLearnedReceiptPreferences({
      merchantName: "Popularmed Farmácias",
    });
    expect(byCorrected?.merchantName).toBe("Popularmed Farmácias");
  });

  it("incrementa contador de uso ao aprender repetidas vezes", () => {
    learnFromReceiptCorrection({
      cnpj: "04.737.552/0018-86",
      correctedMerchant: "Mart Minas",
      categorySlug: "mercado",
    });

    learnFromReceiptCorrection({
      cnpj: "04.737.552/0018-86",
      correctedMerchant: "Mart Minas Atacado",
      categorySlug: "mercado",
    });

    const learned = getLearnedReceiptPreferences({
      cnpj: "04.737.552/0018-86",
    });

    expect(learned?.merchantName).toBe("Mart Minas Atacado");
    expect(learned?.usageCount).toBe(2);
  });

  it("converte dicionário legado para MerchantLearningMemory sem duplicar uso e resolve via userMemory", () => {
    const migrated = migrateLegacyReceiptDictToMerchantMemory({
      "cnpj:88709563000102": {
        merchantName: "Rede Moleza",
        categorySlug: "lazer",
        paymentMethod: "debit",
        cardLastDigits: "1234",
        cnpj: "88709563000102",
        usageCount: 3,
        lastUpdated: "2026-10-10T10:00:00.000Z",
      },
      "name:redemolezadistribuicao": {
        merchantName: "Rede Moleza",
        categorySlug: "lazer",
        cnpj: "88709563000102",
        usageCount: 2,
        lastUpdated: "2026-10-08T10:00:00.000Z",
      },
    });

    expect(migrated.migratedCount).toBe(1);
    const rec = migrated.memory["tax_88709563000102"];
    expect(rec?.usageCount).toBe(3);
    expect(rec?.preferredCardLastDigits).toBe("1234");
    expect(rec?.rawAliases).toContain("redemolezadistribuicao");

    const lookedUp = lookupReceiptPreferenceInMerchantMemory(
      { merchantName: "REDE MOLEZA DISTRIBUICAO" },
      migrated.memory,
    );
    expect(lookedUp?.merchantName).toBe("Rede Moleza");
    expect(lookedUp?.cardLastDigits).toBe("1234");
  });
});
