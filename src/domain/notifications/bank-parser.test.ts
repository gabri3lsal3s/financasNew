import { describe, expect, it } from "vitest";
import {
  detectPaymentMethod,
  detectTransactionType,
  extractCentsFromText,
  extractMerchantOrRecipient,
  parseBankNotification,
  parsePixShareText,
  resolveBankName,
} from "./bank-parser";

describe("bank-parser (Domínio de Notificações Bancárias)", () => {
  describe("extractCentsFromText", () => {
    it("extrai centavos de valores com prefixo R$", () => {
      expect(extractCentsFromText("Compra aprovada de R$ 42,90 no cartão")).toBe(4290);
      expect(extractCentsFromText("R$ 1.250,00 transferido")).toBe(125000);
      expect(extractCentsFromText("Valor: R$0,99")).toBe(99);
    });

    it("extrai centavos de valores sem prefixo R$", () => {
      expect(extractCentsFromText("Você pagou 15,30 na padaria")).toBe(1530);
      expect(extractCentsFromText("Pix de 2.500,75 realizado")).toBe(250075);
    });

    it("retorna null para textos sem valor monetário válido ou zero", () => {
      expect(extractCentsFromText("Seu limite aumentou!")).toBeNull();
      expect(extractCentsFromText("R$ 0,00")).toBeNull();
      expect(extractCentsFromText("")).toBeNull();
    });
  });

  describe("resolveBankName", () => {
    it("resolve banco pelo packageName com prioridade", () => {
      expect(resolveBankName("com.nu.production")).toBe("Nubank");
      expect(resolveBankName("com.itau")).toBe("Itaú");
      expect(resolveBankName("br.com.intermedium")).toBe("Inter");
      expect(resolveBankName("com.c6bank.app")).toBe("C6 Bank");
      expect(resolveBankName("com.bradesco")).toBe("Bradesco");
      expect(resolveBankName("com.santander.app")).toBe("Santander");
      expect(resolveBankName("com.mercadopago.wallet")).toBe("Mercado Pago");
      expect(resolveBankName("br.gov.caixa.tem")).toBe("Caixa Tem");
      expect(resolveBankName("br.com.bb.android")).toBe("Banco do Brasil");
    });

    it("resolve banco pelo título ou texto quando packageName não mapeado", () => {
      expect(resolveBankName(undefined, "Nubank", "Compra de R$ 20,00")).toBe("Nubank");
      expect(resolveBankName(undefined, "Alerta", "Seu cartão Itaú foi utilizado")).toBe("Itaú");
      expect(resolveBankName(undefined, "Inter", "Pix recebido")).toBe("Inter");
      expect(resolveBankName(undefined, "C6 Bank", "Fatura")).toBe("C6 Bank");
      expect(resolveBankName(undefined, "App Desconhecido", "Mensagem")).toBe("Banco");
    });
  });

  describe("detectTransactionType", () => {
    it("identifica receitas a partir de palavras-chave", () => {
      expect(detectTransactionType("Você recebeu uma transferência de R$ 100", "Nubank")).toBe("income");
      expect(detectTransactionType("Pix recebido no valor de R$ 50,00", "Inter")).toBe("income");
      expect(detectTransactionType("Crédito em conta realizado", "Itaú")).toBe("income");
      expect(detectTransactionType("Depósito recebido", "Bradesco")).toBe("income");
    });

    it("identifica despesas por padrão", () => {
      expect(detectTransactionType("Compra aprovada no valor de R$ 85,00", "Nubank")).toBe("expense");
      expect(detectTransactionType("Pix enviado com sucesso de R$ 30,00", "Mercado Pago")).toBe("expense");
    });
  });

  describe("detectPaymentMethod", () => {
    it("detecta pix, crédito e débito", () => {
      expect(detectPaymentMethod("Pix enviado para João", "Inter")).toBe("pix");
      expect(detectPaymentMethod("Compra no cartão de crédito aprovada", "Nubank")).toBe("credit_card");
      expect(detectPaymentMethod("Compra no débito de R$ 25,00", "Bradesco")).toBe("debit");
      expect(detectPaymentMethod("Transferência realizada", "Banco")).toBe("other");
    });
  });

  describe("extractMerchantOrRecipient", () => {
    it("extrai estabelecimento após 'em'", () => {
      expect(extractMerchantOrRecipient("Compra de R$ 50,00 em Padaria Estrela aprovada")).toBe("Padaria Estrela");
      expect(extractMerchantOrRecipient("Pagamento em Posto Shell realizada")).toBe("Posto Shell");
    });

    it("extrai beneficiário após 'para' ou 'de'", () => {
      expect(extractMerchantOrRecipient("Pix enviado para Carlos Silva com sucesso")).toBe("Carlos Silva");
      expect(extractMerchantOrRecipient("Transferência recebida de Maria Oliveira via Pix")).toBe("Maria Oliveira");
    });

    it("retorna string vazia quando não encontra padrão", () => {
      expect(extractMerchantOrRecipient("Compra aprovada de R$ 90,00")).toBe("");
    });
  });

  describe("parseBankNotification", () => {
    it("converte notificação do Nubank em transação estruturada", () => {
      const parsed = parseBankNotification({
        packageName: "com.nu.production",
        title: "Nubank",
        text: "Compra de R$ 74,50 em Supermercado Central aprovada no cartão de crédito",
        timestamp: 1729000000000,
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Nubank");
      expect(parsed?.amountCents).toBe(7450);
      expect(parsed?.type).toBe("expense");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.description).toBe("Supermercado Central");
      expect(parsed?.id).toMatch(/^sug_/);
    });

    it("converte notificação de Pix recebido em receita", () => {
      const parsed = parseBankNotification({
        packageName: "br.com.intermedium",
        title: "Inter",
        text: "Você recebeu um Pix de R$ 250,00 de Roberto Santos",
        timestamp: 1729000000000,
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Inter");
      expect(parsed?.amountCents).toBe(25000);
      expect(parsed?.type).toBe("income");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.description).toBe("Roberto Santos");
    });

    it("retorna null para notificação sem valor", () => {
      const parsed = parseBankNotification({
        packageName: "com.nu.production",
        title: "Nubank",
        text: "Sua fatura fechou. Acesse o app para pagar.",
      });

      expect(parsed).toBeNull();
    });

    it("retorna null para payload vazio", () => {
      expect(parseBankNotification({ title: "", text: "" })).toBeNull();
    });
  });

  describe("parsePixShareText", () => {
    it("extrai dados de comprovante compartilhado", () => {
      const sampleShare = `
        Comprovante de Pagamento Pix - Nubank
        Valor: R$ 120,50
        Beneficiário: Farmácia Popular
        Data: 15/10/2026
      `;

      const parsed = parsePixShareText(sampleShare);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(12050);
      expect(parsed?.bankName).toBe("Nubank");
      expect(parsed?.paymentMethod).toBe("pix");
      expect(parsed?.description).toBe("Pix: Farmácia Popular");
      expect(parsed?.type).toBe("expense");
    });

    it("extrai comprovante de pix recebido", () => {
      const sampleShare = `
        Transferência recebida via Pix
        Você recebeu R$ 300,00
        Nome do recebedor: Gabriel Sales
        Pagador: Mariana Lima
      `;

      const parsed = parsePixShareText(sampleShare);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(30000);
      expect(parsed?.type).toBe("income");
      expect(parsed?.paymentMethod).toBe("pix");
    });

    it("retorna null para texto sem valor", () => {
      expect(parsePixShareText("Olá, tudo bem?")).toBeNull();
      expect(parsePixShareText("")).toBeNull();
    });
  });
});
