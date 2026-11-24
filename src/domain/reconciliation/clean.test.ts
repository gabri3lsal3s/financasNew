import { describe, expect, it } from "vitest";
import {
  classifyTransactionNature,
  cleanDescription,
  isInvoicePayment,
} from "./clean";

describe("reconciliation/clean — Higienização de Linhas de Extrato Bancário", () => {
  it("remove prefixos de adquirentes e maquininhas", () => {
    expect(cleanDescription("PAG*Padaria Estrela")).toBe("Padaria Estrela");
    expect(cleanDescription("MP*Mercado Livre")).toBe("Mercado Livre");
    expect(cleanDescription("IFOOD *RESTAURANTE")).toBe("RESTAURANTE");
  });

  it("remove códigos de parcelamento", () => {
    expect(cleanDescription("Lojas Americanas (01/03)")).toBe("Lojas Americanas");
    expect(cleanDescription("Magazine Luiza PARC 02/05")).toBe("Magazine Luiza");
    expect(cleanDescription("Casas Bahia em 10x")).toBe("Casas Bahia");
  });

  it("remove identificadores de terminais POS, NSU e horários", () => {
    expect(cleanDescription("Restaurante Fogão POS 12345 13:45")).toBe("Restaurante Fogão");
    expect(cleanDescription("Farmacia Central NSU 987654")).toBe("Farmacia Central");
  });

  it("remove sufixos de cidades padrão", () => {
    expect(cleanDescription("Supermercado Dia - SAO PAULO BR")).toBe("Supermercado Dia");
  });

  it("lida com strings vazias e textos já limpos", () => {
    expect(cleanDescription("")).toBe("");
    expect(cleanDescription("Padaria Estrela")).toBe("Padaria Estrela");
  });

  describe("Classificação de Pagamentos de Fatura e Boletos no Cartão", () => {
    it("identifica termos incondicionais de pagamento de fatura independente do sinal", () => {
      expect(isInvoicePayment("PAGAMENTO DE NOMINAIS", false)).toBe(true);
      expect(isInvoicePayment("PAGAMENTO DE NOMINAIS", true)).toBe(true);
      expect(isInvoicePayment("PAGTO TIT NOMINAL", false)).toBe(true);
      expect(isInvoicePayment("PAGAMENTO DE FATURA", false)).toBe(true);
      expect(isInvoicePayment("PGTO FATURA", false)).toBe(true);
      expect(isInvoicePayment("PAGAMENTO RECEBIDO", true)).toBe(true);
      expect(isInvoicePayment("DEB AUT CARTAO", false)).toBe(true);
    });

    it("identifica quitação apenas em crédito para termos de compensação ambíguos", () => {
      // Quando é crédito (isCredit = true), trata-se de pagamento de fatura
      expect(isInvoicePayment("FICHA DE COMPENSACAO", true)).toBe(true);
      expect(isInvoicePayment("LIQUIDACAO DE TITULO", true)).toBe(true);
      expect(isInvoicePayment("PAGAMENTO DE TITULO", true)).toBe(true);

      // Quando é débito regular (isCredit = false), é compra/pagamento de boleto no cartão
      expect(isInvoicePayment("FICHA DE COMPENSACAO", false)).toBe(false);
      expect(isInvoicePayment("LIQUIDACAO DE TITULO", false)).toBe(false);
      expect(isInvoicePayment("PAGAMENTO DE TITULO", false)).toBe(false);
    });

    it("preserva boletos de concessionárias e serviços pagos no cartão como despesa/compra", () => {
      expect(isInvoicePayment("PAGTO TITULO ENEL", false)).toBe(false);
      expect(isInvoicePayment("RECARGAPAY*CONTA LUZ", false)).toBe(false);
      expect(isInvoicePayment("PICPAY*BOLETO", false)).toBe(false);

      const nature = classifyTransactionNature({
        rawDescription: "PAGTO TITULO ENEL",
        isCredit: false,
        isPayment: false,
        isRefund: false,
      });
      expect(nature).toBe("purchase");
    });

    it("classifica corretamente as 6 naturezas canônicas", () => {
      expect(
        classifyTransactionNature({
          rawDescription: "COMPRA PADARIA",
          isCredit: false,
          isPayment: false,
          isRefund: false,
        }),
      ).toBe("purchase");

      expect(
        classifyTransactionNature({
          rawDescription: "PAGAMENTO DE NOMINAIS",
          isCredit: false,
          isPayment: true,
          isRefund: false,
        }),
      ).toBe("invoice_payment");

      expect(
        classifyTransactionNature({
          rawDescription: "ESTORNO COMPRA CANCELADA",
          isCredit: true,
          isPayment: false,
          isRefund: true,
        }),
      ).toBe("refund");

      expect(
        classifyTransactionNature({
          rawDescription: "IOF INTERNACIONAL",
          isCredit: false,
          isPayment: false,
          isRefund: false,
          hasChargeKind: true,
        }),
      ).toBe("fee_or_tax");

      expect(
        classifyTransactionNature({
          rawDescription: "CARTAO ADICIONAL FINAL 1234",
          isCredit: false,
          isPayment: false,
          isRefund: false,
        }),
      ).toBe("subcard_header");

      expect(
        classifyTransactionNature({
          rawDescription: "COTACAO USD: 5.42",
          isCredit: false,
          isPayment: false,
          isRefund: false,
        }),
      ).toBe("fx_detail");
    });
  });
});
