import { describe, expect, it } from "vitest";
import {
  detectCardPaymentMethod,
  detectCardSlipModality,
  extractAuthorizationCode,
  extractCardSlipMerchant,
  extractTerminalAcquirer,
  isCardSlipReceipt,
  parseCardSlipReceipt,
} from "./card-slip-parser";

describe("card-slip-parser", () => {
  const sampleCieloCreditSlip = `
    CIELO
    SUPERMERCADO ALVORADA
    CNPJ: 12.345.678/0001-90
    VIA CLIENTE
    DATA: 28/10/2026 14:35
    MASTERCARD CREDITO A VISTA
    CARTAO: **** **** **** 4821
    AUT: 987654
    DOC: 123456
    VALOR: R$ 150,00
  `;

  const sampleStoneInstallmentsSlip = `
    STONE PAGAMENTOS
    DROGARIA SAO PAULO
    VIA CONSUMIDOR
    DATA: 15/09/2026
    VISA CREDITO PARCELADO
    CARTAO: FINAL 3341
    PARC: 03
    AUTORIZACAO: 445566
    VALOR TOTAL R$ 300,00
  `;

  const sampleRedeDebitSlip = `
    REDE CARD
    PADARIA CENTRAL
    VIA DO CLIENTE
    DATA: 10/10/2026
    ELO DEBITO A VISTA
    CARTAO: **** 1122
    AUT: 112233
    VALOR: R$ 35,50
  `;

  it("identifica adquirentes conhecidas (Cielo, Stone, Rede)", () => {
    expect(extractTerminalAcquirer(sampleCieloCreditSlip)).toBe("Cielo");
    expect(extractTerminalAcquirer(sampleStoneInstallmentsSlip)).toBe("Stone");
    expect(extractTerminalAcquirer(sampleRedeDebitSlip)).toBe("Rede");
  });

  it("detecta modalidade credito vs debito", () => {
    expect(detectCardPaymentMethod(sampleCieloCreditSlip)).toBe("credit_card");
    expect(detectCardPaymentMethod(sampleStoneInstallmentsSlip)).toBe("credit_card");
    expect(detectCardPaymentMethod(sampleRedeDebitSlip)).toBe("debit");
  });

  it("extrai estabelecimento comercial e autorizacao", () => {
    expect(extractCardSlipMerchant(sampleCieloCreditSlip)).toBe("SUPERMERCADO ALVORADA");
    expect(extractAuthorizationCode(sampleCieloCreditSlip)).toBe("987654");
  });

  it("reconhece se o texto possui marcadores característicos de slip de POS", () => {
    expect(isCardSlipReceipt(sampleCieloCreditSlip)).toBe(true);
    expect(isCardSlipReceipt(sampleStoneInstallmentsSlip)).toBe(true);
    expect(isCardSlipReceipt(sampleRedeDebitSlip)).toBe(true);
    expect(isCardSlipReceipt("Comprovante Pix Nubank enviado R$ 50")).toBe(false);
  });

  it("faz parsing completo de slip de cartao a vista", () => {
    const parsed = parseCardSlipReceipt(sampleCieloCreditSlip);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("card_slip");
    expect(parsed?.amountCents).toBe(15000);
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.cardBrand).toBe("Mastercard");
    expect(parsed?.cardLastDigits).toBe("4821");
    expect(parsed?.terminalAcquirer).toBe("Cielo");
    expect(parsed?.merchantOrBeneficiary).toBe("SUPERMERCADO ALVORADA");
    expect(parsed?.date).toBe("2026-10-28");
  });

  it("faz parsing completo de slip de cartao parcelado", () => {
    const parsed = parseCardSlipReceipt(sampleStoneInstallmentsSlip);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("card_slip");
    expect(parsed?.amountCents).toBe(30000);
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.cardBrand).toBe("Visa");
    expect(parsed?.cardLastDigits).toBe("3341");
    expect(parsed?.terminalAcquirer).toBe("Stone");
    expect(parsed?.installments?.count).toBe(3);
    expect(parsed?.installments?.installmentAmountCents).toBe(10000);
    expect(parsed?.cardModality).toBe("credit_store_installments");
  });

  describe("Aprimoramento de Slips POS/TEF (Tarefa 7.2)", () => {
    it("distingue modalidades de cartao (a vista, parcelado loja, parcelado emissor, debito)", () => {
      expect(detectCardSlipModality("MASTERCARD CREDITO A VISTA")).toBe("credit_sight");
      expect(detectCardSlipModality("VISA CREDITO PARCELADO LOJA")).toBe("credit_store_installments");
      expect(detectCardSlipModality("ELO CREDITO PARCELADO ADM")).toBe("credit_issuer_installments");
      expect(detectCardSlipModality("PARC EMISSOR 4X")).toBe("credit_issuer_installments");
      expect(detectCardSlipModality("DEBITO A VISTA")).toBe("debit");
    });

    it("faz parsing de slip PagBank Elo com parcelamento e modalidade loja", () => {
      const pagBankSlip = `
        PAGBANK PAGSEGURO
        AUTO PECAS ZONA SUL
        VIA CLIENTE
        DATA: 04/11/2026
        ELO CREDITO PARCELADO LOJA
        CARTAO: **** **** **** 9012
        PARC: 06
        AUT: 778899
        VALOR TOTAL R$ 600,00
      `;

      const parsed = parseCardSlipReceipt(pagBankSlip);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(60000);
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.cardBrand).toBe("Elo");
      expect(parsed?.cardLastDigits).toBe("9012");
      expect(parsed?.terminalAcquirer).toBe("PagBank");
      expect(parsed?.cardModality).toBe("credit_store_installments");
      expect(parsed?.installments?.count).toBe(6);
      expect(parsed?.installments?.installmentAmountCents).toBe(10000);
    });

    it("faz parsing de slip Getnet com modalidade emissor / adm e sintaxe 3X", () => {
      const getnetSlip = `
        GETNET
        OTICA MODERNA
        VIA DO CLIENTE
        DATA: 10/11/2026
        AMEX CREDITO PARC ADM
        CARTAO: FINAL 5544
        3X
        AUT: 332211
        VALOR: R$ 450,00
      `;

      const parsed = parseCardSlipReceipt(getnetSlip);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(45000);
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.cardBrand).toBe("American Express");
      expect(parsed?.cardLastDigits).toBe("5544");
      expect(parsed?.terminalAcquirer).toBe("Getnet");
      expect(parsed?.cardModality).toBe("credit_issuer_installments");
      expect(parsed?.installments?.count).toBe(3);
      expect(parsed?.installments?.installmentAmountCents).toBe(15000);
    });

    it("faz parsing de resumo de venda PagBank com taxas e valor líquido (Tarefa 3.4)", () => {
      const pagBankSummary = `
        PagBank
        Resumo da venda
        Valor da venda R$ 1.800,00
        Taxas (-) R$ 12,87
        Valor líquido (=) R$ 1.287,13
        Forma de pagamento
        MasterCard - final 5585
        Tipo de compra
        Débito à vista
        Código de transação: CBED9EDCOF7449BC859D264346A286E3
      `;

      const parsed = parseCardSlipReceipt(pagBankSummary);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(180000);
      expect(parsed?.feeCents).toBe(1287);
      expect(parsed?.netAmountCents).toBe(128713);
      expect(parsed?.paymentMethod).toBe("debit");
      expect(parsed?.cardBrand).toBe("Mastercard");
      expect(parsed?.cardLastDigits).toBe("5585");
      expect(parsed?.terminalAcquirer).toBe("PagBank");
    });

    it("faz parsing de slip Stone parcelado com 5 parcelas de R$ 5.000,00", () => {
      const stoneInstallments = `
        STONE
        LOJA DE ELETRONICOS
        MASTERCARD ****1111
        CRÉDITO R$ 25.000,00
        5X SEM JUROS DE R$ 5.000,00
        AUT: 654321
        VIA CLIENTE
      `;

      const parsed = parseCardSlipReceipt(stoneInstallments);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(2500000);
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.cardBrand).toBe("Mastercard");
      expect(parsed?.cardLastDigits).toBe("1111");
      expect(parsed?.installments?.count).toBe(5);
      expect(parsed?.installments?.installmentAmountCents).toBe(500000);
      expect(parsed?.terminalAcquirer).toBe("Stone");
    });
  });
});
