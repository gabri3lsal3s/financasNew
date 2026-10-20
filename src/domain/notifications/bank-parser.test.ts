import { describe, expect, it } from "vitest";
import {
  cleanMerchantName,
  detectPaymentMethod,
  detectTransactionType,
  extractCentsFromText,
  extractInstallmentInfo,
  extractMerchantOrRecipient,
  isBlacklistedNotification,
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

  describe("isBlacklistedNotification (Blacklist Semântica Anti-Falsos Positivos)", () => {
    it("rejeita notificações de faturas fechadas e resumos", () => {
      expect(isBlacklistedNotification("Sua fatura fechou. Acesse o app para pagar.", "Nubank")).toBe(true);
      expect(isBlacklistedNotification("Fechamento da fatura: R$ 1.540,20", "Itaú")).toBe(true);
      expect(isBlacklistedNotification("Resumo da fatura disponível no aplicativo", "Bradesco")).toBe(true);
      expect(isBlacklistedNotification("Sua fatura está fechada", "Inter")).toBe(true);
    });

    it("rejeita notificações de confirmação de pagamento de fatura", () => {
      expect(isBlacklistedNotification("Pagamento da fatura recebido com sucesso de R$ 850,00", "Nubank")).toBe(true);
      expect(isBlacklistedNotification("Fatura paga: R$ 420,00", "Santander")).toBe(true);
      expect(isBlacklistedNotification("Confirmamos o pagamento da sua fatura", "C6 Bank")).toBe(true);
    });

    it("rejeita recusas, bloqueios e falhas de transação", () => {
      expect(isBlacklistedNotification("Compra de R$ 90,00 recusada por saldo insuficiente", "Nubank")).toBe(true);
      expect(isBlacklistedNotification("Transação de R$ 150,00 não autorizada", "Bradesco")).toBe(true);
      expect(isBlacklistedNotification("Compra não aprovada: limite insuficiente", "Itaú")).toBe(true);
      expect(isBlacklistedNotification("Cartão bloqueado temporariamente por segurança", "Inter")).toBe(true);
      expect(isBlacklistedNotification("Transação cancelada", "Mercado Pago")).toBe(true);
    });

    it("rejeita ofertas de crédito, marketing e aumento de limite", () => {
      expect(isBlacklistedNotification("Seu limite aumentou para R$ 5.000,00!", "Nubank")).toBe(true);
      expect(isBlacklistedNotification("Você tem um empréstimo pré-aprovado de R$ 10.000,00", "Inter")).toBe(true);
      expect(isBlacklistedNotification("Dinheiro extra disponível na sua conta", "C6 Bank")).toBe(true);
      expect(isBlacklistedNotification("Aproveite a oferta e ganhe cashback", "PicPay")).toBe(true);
      expect(isBlacklistedNotification("Investimento realizado em CDB 100% CDI", "Banco")).toBe(true);
    });

    it("rejeita tokens, códigos de segurança e 2FA", () => {
      expect(isBlacklistedNotification("Seu código de segurança é 489201", "Banco do Brasil")).toBe(true);
      expect(isBlacklistedNotification("Seu token de acesso para autorização é 9823", "Bradesco")).toBe(true);
      expect(isBlacklistedNotification("Código 2FA para confirmação: 123456", "Caixa")).toBe(true);
    });

    it("rejeita agendamentos futuros e lembretes de vencimento", () => {
      expect(isBlacklistedNotification("Transferência agendada no valor de R$ 200,00 para 25/10", "Itaú")).toBe(true);
      expect(isBlacklistedNotification("Lembrete de vencimento: sua fatura vence em 3 dias", "Nubank")).toBe(true);
      expect(isBlacklistedNotification("Agendamento confirmado para amanhã", "Inter")).toBe(true);
    });

    it("permite notificações legítimas de compras e rendas", () => {
      expect(isBlacklistedNotification("Compra de R$ 42,90 em Padaria Estrela aprovada", "Nubank")).toBe(false);
      expect(isBlacklistedNotification("Você recebeu um Pix de R$ 150,00 de Marcos Silva", "Inter")).toBe(false);
      expect(isBlacklistedNotification("Salário creditado de R$ 4.500,00", "Itaú")).toBe(false);
    });
  });

  describe("extractInstallmentInfo (Detecção e Cálculo de Parcelas)", () => {
    it("detecta compra com valor total e multiplicador (ex: R$ 300,00 em 3x)", () => {
      const info = extractInstallmentInfo("Compra de R$ 300,00 em 3x no cartão Nubank", 30000);
      expect(info).not.toBeNull();
      expect(info?.installments).toBe(3);
      expect(info?.totalAmountCents).toBe(30000);
      expect(info?.installmentAmountCents).toBe(10000);
      expect(info?.currentInstallment).toBeUndefined();
    });

    it("calcula total quando notificação informa valor da parcela (ex: em 3x de R$ 50,00)", () => {
      const info = extractInstallmentInfo("Compra aprovada em 3x de R$ 50,00 no cartão C6", null);
      expect(info).not.toBeNull();
      expect(info?.installments).toBe(3);
      expect(info?.installmentAmountCents).toBe(5000);
      expect(info?.totalAmountCents).toBe(15000);
    });

    it("detecta parcela isolada de controle mensal (ex: Parcela 2/10 de R$ 45,00)", () => {
      const info = extractInstallmentInfo("Parcela 2/10 de R$ 45,00 aprovada no cartão", 4500);
      expect(info).not.toBeNull();
      expect(info?.currentInstallment).toBe(2);
      expect(info?.installments).toBe(10);
      expect(info?.installmentAmountCents).toBe(4500);
      expect(info?.totalAmountCents).toBe(4500);
    });

    it("retorna null para transações à vista", () => {
      expect(extractInstallmentInfo("Compra de R$ 42,90 à vista na padaria", 4290)).toBeNull();
    });
  });

  describe("cleanMerchantName (Higienização e Ruído de Adquirentes)", () => {
    it("limpa prefixos de maquininhas (PAG*, MP*, STONE*, etc.)", () => {
      expect(cleanMerchantName("PAG*Padaria Estrela")).toBe("Padaria Estrela");
      expect(cleanMerchantName("MP*Livraria Saraiva")).toBe("Livraria Saraiva");
      expect(cleanMerchantName("STONE*Restaurante Central")).toBe("Restaurante Central");
      expect(cleanMerchantName("CIELO*Farmacia Vida")).toBe("Farmacia Vida");
    });

    it("normaliza Uber e iFood", () => {
      expect(cleanMerchantName("UBER *TRIP HELP")).toBe("Uber");
      expect(cleanMerchantName("UBER *TRIP")).toBe("Uber");
      expect(cleanMerchantName("IFOOD *PEDIDO")).toBe("iFood");
      expect(cleanMerchantName("IFOOD *RESTAURANTE SABOR")).toBe("RESTAURANTE SABOR");
    });

    it("normaliza Mercado Livre", () => {
      expect(cleanMerchantName("MP*MERCADOLIVRE")).toBe("Mercado Livre");
    });

    it("remove sufixos de cidades e estados (geolocalização)", () => {
      expect(cleanMerchantName("DROGASIL SAO PAULO BR")).toBe("DROGASIL");
      expect(cleanMerchantName("POSTO IPIRANGA RIO DE JANEI BRA")).toBe("POSTO IPIRANGA");
    });

    it("remove resíduos de cartão (final 1234)", () => {
      expect(cleanMerchantName("POSTO IPIRANGA, cartao final 1234")).toBe("POSTO IPIRANGA");
      expect(cleanMerchantName("LOJA XYZ - final 5678")).toBe("LOJA XYZ");
    });
  });

  describe("extractMerchantOrRecipient (Extrator Multibanco)", () => {
    it("extrai estabelecimentos com preposições contraídas ('no', 'na', 'em')", () => {
      expect(extractMerchantOrRecipient("Compra de R$ 35,00 no Restaurante Fogão de Lenha aprovada")).toBe(
        "Restaurante Fogão de Lenha",
      );
      expect(extractMerchantOrRecipient("Compra de R$ 80,00 na Droga Raia aprovada")).toBe("Droga Raia");
      expect(extractMerchantOrRecipient("Compra de R$ 42,90 em Padaria Central realizada")).toBe("Padaria Central");
    });

    it("extrai beneficiário/pagador com 'para', 'de' e 'pela'", () => {
      expect(extractMerchantOrRecipient("Pix enviado para Carlos Silva com sucesso")).toBe("Carlos Silva");
      expect(extractMerchantOrRecipient("Transferência recebida de Maria Oliveira via Pix")).toBe("Maria Oliveira");
      expect(extractMerchantOrRecipient("Salário creditado de R$ 4.500,00 pela Tech Corp")).toBe("Tech Corp");
    });

    it("extrai estabelecimentos no formato delimitado por travessão (Itaú e Bradesco)", () => {
      expect(extractMerchantOrRecipient("ITAUCARD final 1234 - LOJAS AMERICANAS R$ 89,90")).toBe("LOJAS AMERICANAS");
      expect(extractMerchantOrRecipient("Itaucard: Compra aprovada - EXTRA HIPER - R$ 120,00")).toBe("EXTRA HIPER");
      expect(
        extractMerchantOrRecipient("Bradesco Cartões: Compra aprovada R$ 54,00 no cartão final 1234 - SUPERMERCADO DIA"),
      ).toBe("SUPERMERCADO DIA");
    });

    it("extrai estabelecimentos no formato delimitado por vírgula (BB e Santander)", () => {
      expect(extractMerchantOrRecipient("BB: Compra no cartao final 1234, R$ 45,00, DROGASIL")).toBe("DROGASIL");
      expect(
        extractMerchantOrRecipient("Santander Way: Compra aprovada R$ 32,50, FARMACIA PAGUE MENOS, Cartao final 5678"),
      ).toBe("FARMACIA PAGUE MENOS");
    });
  });

  describe("resolveBankName (Suporte aos Maiores Bancos Brasileiros)", () => {
    it("resolve bancos através dos pacotes mapeados", () => {
      expect(resolveBankName("com.nu.production")).toBe("Nubank");
      expect(resolveBankName("com.itau")).toBe("Itaú");
      expect(resolveBankName("com.itau.personnalite")).toBe("Itaú Personnalité");
      expect(resolveBankName("br.com.intermedium")).toBe("Inter");
      expect(resolveBankName("com.c6bank.app")).toBe("C6 Bank");
      expect(resolveBankName("com.bradesco")).toBe("Bradesco");
      expect(resolveBankName("com.santander.app")).toBe("Santander");
      expect(resolveBankName("com.mercadopago.wallet")).toBe("Mercado Pago");
      expect(resolveBankName("com.picpay")).toBe("PicPay");
      expect(resolveBankName("br.com.uol.ps.myaccount")).toBe("PagBank");
      expect(resolveBankName("br.com.neon")).toBe("Neon");
      expect(resolveBankName("br.com.bradesco.next")).toBe("Next");
      expect(resolveBankName("com.btg.pactual.banking")).toBe("BTG Pactual");
      expect(resolveBankName("br.com.xp.carteira")).toBe("XP Investimentos");
      expect(resolveBankName("com.nomadfinancial.app")).toBe("Nomad");
      expect(resolveBankName("com.transferwise.android")).toBe("Wise");
      expect(resolveBankName("br.gov.caixa.tem")).toBe("Caixa Tem");
      expect(resolveBankName("br.com.bb.android")).toBe("Banco do Brasil");
    });

    it("resolve bancos por palavras-chave no texto", () => {
      expect(resolveBankName(undefined, "Alerta Nubank", "Compra aprovada")).toBe("Nubank");
      expect(resolveBankName(undefined, "Notificação", "Cartão XP utilizado")).toBe("XP Investimentos");
      expect(resolveBankName(undefined, "PicPay", "Você pagou R$ 30,00")).toBe("PicPay");
      expect(resolveBankName(undefined, "Ourocard", "Compra no cartão")).toBe("Banco do Brasil");
    });
  });

  describe("detectTransactionType (Dicionário Expandido de Receitas)", () => {
    it("identifica receitas a partir de palavras-chave expandidas", () => {
      expect(detectTransactionType("Você recebeu uma transferência de R$ 100", "Nubank")).toBe("income");
      expect(detectTransactionType("Pix recebido no valor de R$ 50,00", "Inter")).toBe("income");
      expect(detectTransactionType("Salário depositado no valor de R$ 4.500,00", "Itaú")).toBe("income");
      expect(detectTransactionType("Reembolso aprovado de R$ 85,00", "Bradesco")).toBe("income");
      expect(detectTransactionType("Estorno no cartão de R$ 120,00 realizado", "Nubank")).toBe("income");
      expect(detectTransactionType("Devolução Pix recebida de R$ 40,00", "Santander")).toBe("income");
      expect(detectTransactionType("TED recebida no valor de R$ 1.200,00", "BTG Pactual")).toBe("income");
      expect(detectTransactionType("DOC recebido de R$ 350,00", "Caixa")).toBe("income");
      expect(detectTransactionType("Proventos creditados de R$ 75,20", "XP")).toBe("income");
      expect(detectTransactionType("Cashback recebido de R$ 15,00", "PicPay")).toBe("income");
    });

    it("identifica despesas por padrão", () => {
      expect(detectTransactionType("Compra aprovada no valor de R$ 85,00", "Nubank")).toBe("expense");
      expect(detectTransactionType("Pix enviado com sucesso de R$ 30,00", "Mercado Pago")).toBe("expense");
    });
  });

  describe("detectPaymentMethod (Alinhamento com PAYMENT_METHODS)", () => {
    it("detecta pix, débito, crédito e transferências", () => {
      expect(detectPaymentMethod("Pix enviado para João", "Inter")).toBe("pix");
      expect(detectPaymentMethod("Compra no cartão de crédito aprovada", "Nubank")).toBe("credit_card");
      expect(detectPaymentMethod("Compra de R$ 300,00 em 3x", "Itaú")).toBe("credit_card");
      expect(detectPaymentMethod("Compra no débito de R$ 25,00", "Bradesco")).toBe("debit");
      expect(detectPaymentMethod("Cartão de débito utilizado", "Caixa")).toBe("debit");
      expect(detectPaymentMethod("TED enviada com sucesso", "Banco")).toBe("transfer");
      expect(detectPaymentMethod("DOC realizado entre contas", "Banco")).toBe("transfer");
      expect(detectPaymentMethod("Pagamento de boleto realizado", "Banco")).toBe("other");
    });
  });

  describe("parseBankNotification (Fluxos Completos dos 10 Maiores Bancos & Parcelamento)", () => {
    it("processa compra parcelada com cálculo automático (em 3x de R$ 50,00 -> R$ 150,00)", () => {
      const parsed = parseBankNotification({
        packageName: "com.nu.production",
        title: "Nubank",
        text: "Compra aprovada em 3x de R$ 50,00 na Tok&Stok",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(15000);
      expect(parsed?.installments).toBe(3);
      expect(parsed?.installmentAmountCents).toBe(5000);
      expect(parsed?.description).toBe("Tok&Stok");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.type).toBe("expense");
    });

    it("processa compra parcelada com total informado (R$ 300,00 em 3x)", () => {
      const parsed = parseBankNotification({
        packageName: "com.itau",
        title: "Itaú",
        text: "Compra aprovada de R$ 300,00 em 3x em Magazine Luiza",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(30000);
      expect(parsed?.installments).toBe(3);
      expect(parsed?.installmentAmountCents).toBe(10000);
      expect(parsed?.description).toBe("Magazine Luiza");
    });

    it("processa parcela isolada de controle mensal (Parcela 2/10 de R$ 45,00)", () => {
      const parsed = parseBankNotification({
        packageName: "com.santander.app",
        title: "Santander",
        text: "Parcela 2/10 de R$ 45,00 em Lojas Renner aprovada",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(4500);
      expect(parsed?.currentInstallment).toBe(2);
      expect(parsed?.installments).toBe(10);
      expect(parsed?.installmentAmountCents).toBe(4500);
      expect(parsed?.description).toBe("Lojas Renner");
    });

    it("descarta notificações de falsos positivos da blacklist", () => {
      expect(
        parseBankNotification({
          packageName: "com.nu.production",
          title: "Nubank",
          text: "Sua fatura fechou. Acesse o app para pagar R$ 1.250,00.",
        }),
      ).toBeNull();

      expect(
        parseBankNotification({
          packageName: "com.itau",
          title: "Itaú",
          text: "Pagamento da fatura recebido no valor de R$ 800,00 com sucesso.",
        }),
      ).toBeNull();

      expect(
        parseBankNotification({
          packageName: "br.com.intermedium",
          title: "Inter",
          text: "Compra de R$ 350,00 recusada por limite insuficiente.",
        }),
      ).toBeNull();

      expect(
        parseBankNotification({
          packageName: "com.picpay",
          title: "PicPay",
          text: "Você tem um empréstimo pré-aprovado de R$ 5.000,00!",
        }),
      ).toBeNull();
    });

    it("processa notificação do Banco do Brasil com vírgula e sanitiza ruídos", () => {
      const parsed = parseBankNotification({
        packageName: "br.com.bb.android",
        title: "Banco do Brasil",
        text: "BB: Compra no cartao final 1234, R$ 45,00, PAG*DROGASIL SAO PAULO BR",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Banco do Brasil");
      expect(parsed?.amountCents).toBe(4500);
      expect(parsed?.description).toBe("DROGASIL");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação do Bradesco com travessão e Uber", () => {
      const parsed = parseBankNotification({
        packageName: "com.bradesco",
        title: "Bradesco Cartões",
        text: "Compra aprovada R$ 28,50 no cartão final 5678 - UBER *TRIP HELP",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Bradesco");
      expect(parsed?.amountCents).toBe(2850);
      expect(parsed?.description).toBe("Uber");
    });
  });

  describe("parsePixShareText", () => {
    it("extrai dados de comprovante compartilhado com sanitização", () => {
      const sampleShare = `
        Comprovante de Pagamento Pix - Nubank
        Valor: R$ 120,50
        Beneficiário: PAG*Farmácia Popular
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

    it("rejeita texto compartilhado se contiver termo da blacklist", () => {
      const fakeReceipt = "Comprovante Pix cancelado e transação recusada de R$ 50,00";
      expect(parsePixShareText(fakeReceipt)).toBeNull();
    });
  });

  describe("Anti-falsos positivos estritos (caso Calçados Tobias & apps não homologados)", () => {
    it("rejeita notificações de apps desconhecidos sem banco homologado", () => {
      const parsed = parseBankNotification({
        packageName: "com.whatsapp",
        title: "Mensagem de Contato",
        text: "Paguei R$ 55,80 na Calçados Tobias BLTDA",
      });
      expect(parsed).toBeNull();
    });

    it("rejeita notificações promocionais ou de pedidos sem prova de transação aprovada", () => {
      const parsed = parseBankNotification({
        packageName: "com.nu.production",
        title: "Nubank",
        text: "Seu pedido 5580 na Calçados Tobias BLTDA foi enviado para transporte",
      });
      expect(parsed).toBeNull();
    });

    it("retorna null em resolveBankName para pacotes não bancários", () => {
      expect(resolveBankName("com.loja.calcados")).toBeNull();
      expect(resolveBankName("com.whatsapp")).toBeNull();
      expect(resolveBankName("com.google.android.apps.messaging")).toBeNull();
      expect(resolveBankName(undefined, "Calçados Tobias", "Promoção de calçados")).toBeNull();
    });
  });
});
