import { describe, expect, it } from "vitest";
import {
  analyzeDocumentMultiplicity,
  detectDocumentMultiplicity,
} from "./document-multiplicity";

describe("document-multiplicity (Detecção Comprovante Único vs. Extrato/Fatura)", () => {
  it("classifica PDF/extrato com múltiplas linhas datadas como multi_statement", () => {
    const statementText = Array.from({ length: 12 }, (_, idx) => {
      const day = String(idx + 1).padStart(2, "0");
      return `${day}/10/2026 MERCADO MODELO R$ ${(25 + idx).toFixed(2).replace(".", ",")}`;
    }).join("\n");

    const analysis = analyzeDocumentMultiplicity(`Extrato Mensal\n${statementText}`);
    expect(analysis.multiplicity).toBe("multi_statement");
    expect(analysis.datedTransactionLines).toBe(12);
    expect(detectDocumentMultiplicity(statementText)).toBe("multi_statement");
  });

  it("classifica fatura com cabeçalho explícito e >= 2 lançamentos datados como multi_statement", () => {
    const invoiceText = `
      Fatura Nubank - Outubro 2026
      Lançamentos na fatura
      10 OUT PADARIA CENTRAL 32,90
      12 OUT FARMACIA POPULAR 84,50
    `;

    expect(detectDocumentMultiplicity(invoiceText)).toBe("multi_statement");
  });

  it("mantém cupom fiscal DANFE NFC-e com vários itens como single_receipt", () => {
    const nfceText = `
      DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      SUPERMERCADO EXEMPLO LTDA
      EMISSAO: 15/10/2026 14:20:00
      01 ARROZ 5KG 02/10 R$ 29,90
      02 FEIJAO 1KG 03/10 R$ 8,90
      03 OLEO SOJA 04/10 R$ 7,50
      04 LEITE INTEGRAL 05/10 R$ 5,80
      VALOR TOTAL R$: 52,10
      CHAVE DE ACESSO: 35261047508411000156650010000123451009876543
    `;

    expect(detectDocumentMultiplicity(nfceText)).toBe("single_receipt");
  });

  it("classifica comprovante bancário único com datas de emissão e vencimento como single_receipt", () => {
    const boleto = `
      Comprovante de pagamento de boleto
      Data do pagamento: 10/10/2026
      Vencimento: 15/10/2026
      Valor do documento: R$ 250,00
      Valor pago: R$ 250,00
    `;

    expect(detectDocumentMultiplicity(boleto)).toBe("single_receipt");
  });

  it("diferencia fatura de cartão (multi_statement) de comprovante de pagamento de fatura (single_receipt)", () => {
    const cardStatement = `
      Fatura do cartão Itaú Black
      10/11 PADARIA CENTRAL R$ 42,00
      12/11 UBER TRIP R$ 28,90
    `;
    expect(detectDocumentMultiplicity(cardStatement)).toBe("multi_statement");

    const cardPaymentReceipt = `
      Comprovante de pagamento de fatura do cartão
      Data do pagamento: 15/11/2026
      Vencimento: 20/11/2026
      Valor pago: R$ 1.250,00
    `;
    expect(detectDocumentMultiplicity(cardPaymentReceipt)).toBe("single_receipt");
  });

  it("retorna unknown para texto curto ou sem evidência monetária", () => {
    expect(detectDocumentMultiplicity("")).toBe("unknown");
    expect(detectDocumentMultiplicity("abc")).toBe("unknown");
    expect(detectDocumentMultiplicity("Documento sem informações financeiras legíveis.")).toBe(
      "unknown",
    );
  });
});
