import { describe, expect, it } from "vitest";
import { resolvePaymentMethod } from "./payment-method-resolver";

describe("payment-method-resolver — Motor Puro de Resolução de Métodos (§Plano 09 — Fase 3)", () => {
  describe("Cartão de Crédito (credit_card)", () => {
    it("resolve compras no crédito com tokens explícitos", () => {
      const res = resolvePaymentMethod("Compra de R$ 13,55 no crédito realizada com sucesso.", "Pague Menos");
      expect(res.method).toBe("credit_card");
      expect(res.nature).toBe("expense");
    });

    it("resolve parcelamento como cartão de crédito", () => {
      const res = resolvePaymentMethod("Compra de R$ 900,00 em 3x no Cartao Nubank", "Compra aprovada");
      expect(res.method).toBe("credit_card");
      expect(res.nature).toBe("expense");
    });

    it("resolve carteira Google Pay com cartão como credit_card", () => {
      const res = resolvePaymentMethod(
        "R$ 13,55 com Nomad Infinite ••7756",
        "PAGUE MENOS 1094",
        "com.google.android.apps.walletnfcrel",
      );
      expect(res.method).toBe("credit_card");
      expect(res.nature).toBe("expense");
    });

    it("resolve cartões com sufixo ou bandeira (Infinite, Black, Platinum)", () => {
      const res = resolvePaymentMethod("R$ 150,00 com XP Infinite ••1234", "POSTO IPIRANGA 05");
      expect(res.method).toBe("credit_card");
      expect(res.nature).toBe("expense");
    });

    it("resolve Itaucard e Ourocard como credit_card", () => {
      const res = resolvePaymentMethod("Compra aprovada no cartão final 4321 - RESTAURANTE FOGAO R$ 58,00", "Itaucard");
      expect(res.method).toBe("credit_card");
    });

    it("resolve cartão virtual", () => {
      const res = resolvePaymentMethod("Compra de R$ 42,90 na Droga Raia no cartão virtual", "Compra aprovada");
      expect(res.method).toBe("credit_card");
    });
  });

  describe("Cartão de Débito (debit)", () => {
    it("resolve compra no débito", () => {
      const res = resolvePaymentMethod("Você pagou R$ 22,00 no débito em Padaria Bela Vista", "Compra no débito");
      expect(res.method).toBe("debit");
      expect(res.nature).toBe("expense");
    });

    it("resolve purchase internacional da Nomad sem indicação de crédito como débito", () => {
      const res = resolvePaymentMethod(
        "Purchase of $ 15.00 at Starbucks Store 4432 approved",
        "Nomad",
      );
      expect(res.method).toBe("debit");
      expect(res.nature).toBe("expense");
    });
  });

  describe("Trava Anti-Falso Crédito: 'Crédito em Conta' é Renda", () => {
    it("não confunde 'crédito em conta' com cartão de crédito", () => {
      const res = resolvePaymentMethod("Crédito em conta no valor de R$ 1.500,00 referente a proventos", "Banco do Brasil");
      expect(res.method).not.toBe("credit_card");
      expect(res.nature).toBe("income");
    });

    it("resolve valor creditado na conta como renda", () => {
      const res = resolvePaymentMethod("R$ 250,00 creditado na sua conta com sucesso", "Inter");
      expect(res.nature).toBe("income");
    });
  });

  describe("Auto-Depósitos, Pix Recebido e Rendas (nature: 'income')", () => {
    it("resolve auto-depósito do Mercado Pago como renda", () => {
      const res = resolvePaymentMethod(
        "Você depositou R$ 3.244,24 via Pix e o valor já está rendendo na sua conta.",
        "Seu dinheiro já está disponível",
      );
      expect(res.method).toBe("pix");
      expect(res.nature).toBe("income");
      expect(res.subtype).toBe("own_deposit");
      expect(res.suggestedCategorySlug).toBe("transferencias_recebidas");
    });

    it("resolve adicionar dinheiro no PicPay como renda", () => {
      const res = resolvePaymentMethod(
        "Você adicionou R$ 500,00 via Pix à sua carteira.",
        "Dinheiro na conta!",
      );
      expect(res.method).toBe("pix");
      expect(res.nature).toBe("income");
      expect(res.subtype).toBe("own_deposit");
    });

    it("resolve Pix recebido de terceiros como renda", () => {
      const res = resolvePaymentMethod(
        "Você recebeu um Pix de Gabriel Sales no valor de R$ 250,00",
        "Pix recebido",
      );
      expect(res.method).toBe("pix");
      expect(res.nature).toBe("income");
    });

    it("resolve salário como renda", () => {
      const res = resolvePaymentMethod("Depósito de salário creditado no valor de R$ 5.000,00", "Itaú");
      expect(res.nature).toBe("income");
      expect(res.suggestedCategorySlug).toBe("salario");
    });
  });

  describe("Pix Enviado / Compra Pix (pix / expense)", () => {
    it("resolve Pix enviado como despesa", () => {
      const res = resolvePaymentMethod("Você enviou um Pix de R$ 80,00 para Marcos Silva", "Pix enviado");
      expect(res.method).toBe("pix");
      expect(res.nature).toBe("expense");
    });

    it("resolve pagamento via Pix QR Code", () => {
      const res = resolvePaymentMethod("Pagamento via Pix QR Code de R$ 45,00 realizado", "Inter");
      expect(res.method).toBe("pix");
      expect(res.nature).toBe("expense");
    });
  });

  describe("TED / DOC (transfer)", () => {
    it("resolve TED enviada como transfer", () => {
      const res = resolvePaymentMethod("TED enviada no valor de R$ 1.200,00 para Imobiliária Aliança", "Transferência");
      expect(res.method).toBe("transfer");
      expect(res.nature).toBe("expense");
    });

    it("resolve TED recebida como renda", () => {
      const res = resolvePaymentMethod("TED recebida no valor de R$ 800,00 de João Santos", "Transferência");
      expect(res.method).toBe("transfer");
      expect(res.nature).toBe("income");
    });
  });

  describe("Boletos, Concessionárias & Tributos (other)", () => {
    it("resolve pagamento de boleto Enel como other", () => {
      const res = resolvePaymentMethod("Pagamento do boleto Enel Distribuição R$ 145,20 realizado", "Boleto pago");
      expect(res.method).toBe("other");
      expect(res.nature).toBe("expense");
      expect(res.subtype).toBe("bill");
      expect(res.suggestedCategorySlug).toBe("gastos_fixos");
    });

    it("resolve débito automático da Sabesp como other / concessionária (não cartão)", () => {
      const res = resolvePaymentMethod("Débito automático efetuado Sabesp R$ 82,30", "Débito em conta");
      expect(res.method).toBe("other");
      expect(res.subtype).toBe("concessionaire");
      expect(res.suggestedCategorySlug).toBe("gastos_fixos");
    });

    it("resolve tributos IPVA/IPTU/DARF", () => {
      const res = resolvePaymentMethod("Pagamento do DARF tributo federal R$ 320,00 efetuado", "Tributo");
      expect(res.method).toBe("other");
      expect(res.subtype).toBe("tax");
    });
  });

  describe("Saque em Dinheiro (cash)", () => {
    it("resolve saque em caixa eletrônico Banco24Horas como cash", () => {
      const res = resolvePaymentMethod("Saque realizado no terminal Banco24Horas no valor de R$ 200,00", "Banco do Brasil");
      expect(res.method).toBe("cash");
      expect(res.nature).toBe("expense");
      expect(res.label).toBe("Saque em Dinheiro");
    });
  });
});
