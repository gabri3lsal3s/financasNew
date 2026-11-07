import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReceiptLearningMemory,
  getLearnedReceiptPreferences,
  learnFromReceiptCorrection,
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
});
