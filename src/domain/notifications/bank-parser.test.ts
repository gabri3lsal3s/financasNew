import { describe, expect, it } from "vitest";
import {
  areMerchantsCompatible,
  cleanMerchantName,
  DEDUPLICATION_WINDOW_MS,
  detectCurrency,
  detectPaymentMethod,
  detectTransactionNature,
  detectTransactionType,
  extractCardBrand,
  extractCardLastDigits,
  extractCentsFromText,
  extractInstallmentInfo,
  extractInvestmentAsset,
  extractIssuerBank,
  extractMerchantOrRecipient,
  extractNomadExchangeMetadata,
  isBlacklistedNotification,
  isCardBrand,
  isDigitalWallet,
  isRefundTransaction,
  isWithinTemporalWindow,
  mergeWalletWithBank,
  parseBankNotification,
  type ParsedBankTransaction,
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

    it("permite notificações legítimas de compras, rendas e investimentos", () => {
      expect(isBlacklistedNotification("Compra de R$ 42,90 em Padaria Estrela aprovada", "Nubank")).toBe(false);
      expect(isBlacklistedNotification("Você recebeu um Pix de R$ 150,00 de Marcos Silva", "Inter")).toBe(false);
      expect(isBlacklistedNotification("Salário creditado de R$ 4.500,00", "Itaú")).toBe(false);
      expect(isBlacklistedNotification("Investimento realizado em CDB 100% CDI", "Banco")).toBe(false);
      expect(isBlacklistedNotification("Aplicação realizada com sucesso: R$ 10.000,00 no Fundo BTG", "BTG Investimentos")).toBe(false);
      expect(isBlacklistedNotification("Ordem de compra de BTC executada: R$ 250,00", "Binance")).toBe(false);
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

    it("limpa prefixos operacionais bancários e terminais POS", () => {
      expect(cleanMerchantName("COMPRA APROVADA - Padaria Estrela POS 12345")).toBe("Padaria Estrela");
      expect(cleanMerchantName("PAGTO ELETRON COBRANCA MERCADO CENTRAL 14/05")).toBe("MERCADO CENTRAL");
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

    it("decodifica código Pix Copia e Cola EMVCo compartilhado", () => {
      const payload = "00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540550.005802BR5915PADARIA ESTRELA6009SAO PAULO6304ABCD";
      const parsed = parsePixShareText(payload);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(5000);
      expect(parsed?.merchant).toBe("PADARIA ESTRELA");
      expect(parsed?.description).toBe("Pix: PADARIA ESTRELA");
    });

    it("identifica transação como estorno/reembolso quando aplicável", () => {
      const refundText = "Comprovante de Devolução Pix: Valor R$ 40,00 Pago para: Padaria Estrela";
      const parsed = parsePixShareText(refundText);
      expect(parsed?.isRefund).toBe(true);
    });

    it("parseia comprovante real do Nubank com CNPJ e EndToEndId determinístico", () => {
      const receipt = `
        Comprovante de transferência Pix
        Valor: R$ 45,00
        Data e Hora: 21/10/2026 - 14:32:10
        Origem: Gabriel Sales
        Instituição: NU PAGAMENTOS S.A.
        Destino: Padaria e Confeitaria Central Ltda
        CNPJ: 12.345.678/0001-90
        Instituição: BANCO ITAU UNIBANCO S.A.
        ID da Transação: E18236120202610211732abcdef12345
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(4500);
      expect(parsed?.bankName).toBe("Nubank");
      expect(parsed?.type).toBe("expense");
      expect(parsed?.status).toBe("completed");
      expect(parsed?.merchant).toBe("Padaria e Confeitaria Central Ltda");
      expect(parsed?.taxId).toBe("12345678000190");
      expect(parsed?.txId).toBe("E18236120202610211732abcdef12345");
      expect(parsed?.id).toBe("pix_E18236120202610211732abcdef12345");
      expect(parsed?.date).toBe("2026-10-21");
    });

    it("parseia comprovante real do Banco Inter com blocos estruturados", () => {
      const receipt = `
        COMPROVANTE DE PAGAMENTO PIX
        Data/Hora da Operação: 21/10/2026 10:15:30
        Valor: R$ 89,90
        Dados do Pagador:
        Nome: Gabriel Sales
        CPF: ***.789.012-**
        Instituição: BANCO INTER S.A.
        Dados do Recebedor:
        Nome: Supermercados BH S.A.
        CNPJ: 01.234.567/0001-89
        ID da Transação: E00416968202610211315abcdef
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(8990);
      expect(parsed?.bankName).toBe("Inter");
      expect(parsed?.type).toBe("expense");
      expect(parsed?.status).toBe("completed");
      expect(parsed?.merchant).toBe("Supermercados BH S.A");
      expect(parsed?.taxId).toBe("01234567000189");
      expect(parsed?.txId).toBe("E00416968202610211315abcdef");
      expect(parsed?.date).toBe("2026-10-21");
    });

    it("parseia comprovante real do Itaú", () => {
      const receipt = `
        Comprovante de Pagamento - Pix - Itaú
        Operação realizada em 21/10/2026 às 11:42
        Valor: R$ 130,00
        Quem pagou: Gabriel Sales
        Quem recebeu: Posto Ipiranga Auto Ltda
        CNPJ: 45.678.901/0001-23
        Instituição: BANCO SANTANDER (BRASIL) S.A.
        ID da transação: E60701190202610211442abcdef
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(13000);
      expect(parsed?.bankName).toBe("Itaú");
      expect(parsed?.type).toBe("expense");
      expect(parsed?.merchant).toBe("Posto Ipiranga Auto Ltda");
      expect(parsed?.taxId).toBe("45678901000123");
      expect(parsed?.txId).toBe("E60701190202610211442abcdef");
      expect(parsed?.date).toBe("2026-10-21");
    });

    it("parseia comprovante real do Santander", () => {
      const receipt = `
        Comprovante de Transferência PIX - Santander
        Data/Hora: 21/10/2026 - 09:20:15
        Valor: R$ 75,50
        Dados de quem recebeu:
        Nome / Razão Social: Restaurante Sabor de Minas EIRELI
        CPF/CNPJ: 33.444.555/0001-66
        Instituição: BANCO C6 S.A.
        Dados de quem pagou:
        Nome: Gabriel Sales
        Código da Operação: 2026102109201500000000
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(7550);
      expect(parsed?.bankName).toBe("Santander");
      expect(parsed?.merchant).toBe("Restaurante Sabor de Minas EIRELI");
      expect(parsed?.taxId).toBe("33444555000166");
      expect(parsed?.txId).toBe("2026102109201500000000");
    });

    it("parseia comprovante real do Bradesco", () => {
      const receipt = `
        Comprovante de Transação Bancária - Pix - Bradesco
        Data: 21/10/2026 - 16:05:00
        Valor da transferência: R$ 210,00
        Favorecido: Drogaria Sao Paulo S.A.
        CNPJ: 61.412.110/0001-55
        Instituição: BANCO DO BRASIL S.A.
        Pagador: Gabriel Sales
        Autenticação: 8877665544332211
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(21000);
      expect(parsed?.bankName).toBe("Bradesco");
      expect(parsed?.merchant).toBe("Drogaria Sao Paulo S.A");
      expect(parsed?.taxId).toBe("61412110000155");
      expect(parsed?.txId).toBe("8877665544332211");
    });

    it("parseia comprovante real do C6 Bank", () => {
      const receipt = `
        Comprovante Pix
        Valor: R$ 55,20
        Data: 21/10/2026 - 18:30:00
        Status: Concluído
        Para: Uber do Brasil Tecnologia Ltda
        CNPJ: 17.895.646/0001-87
        De: Gabriel Sales
        Banco: BANCO C6 S.A.
        ID da transação: E31872495202610212130abcdef
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(5520);
      expect(parsed?.bankName).toBe("C6 Bank");
      expect(parsed?.merchant).toBe("Uber");
      expect(parsed?.taxId).toBe("17895646000187");
      expect(parsed?.txId).toBe("E31872495202610212130abcdef");
    });

    it("parseia comprovante real do Mercado Pago", () => {
      const receipt = `
        Comprovante de transferência Pix
        Você transferiu R$ 32,00
        Data: 21/10/2026 às 12:00
        Para: Lanchonete Bom Café
        CNPJ: 22.333.444/0001-55
        Instituição: MERCADO PAGO IP LTDA
        Código da operação: 1234567890
      `;
      const parsed = parsePixShareText(receipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(3200);
      expect(parsed?.bankName).toBe("Mercado Pago");
      expect(parsed?.merchant).toBe("Lanchonete Bom Café");
      expect(parsed?.taxId).toBe("22333444000155");
      expect(parsed?.txId).toBe("1234567890");
    });

    it("identifica corretamente agendamento Pix com data futura e status scheduled", () => {
      const scheduledReceipt = `
        Comprovante de Agendamento Pix
        Situação: Agendado
        Data do pagamento: 28/10/2026
        Valor: R$ 350,00
        Beneficiário: Imobiliária Alvorada Ltda
        CNPJ: 11.222.333/0001-44
        Instituição: ITAÚ UNIBANCO S.A.
        Pagador: Gabriel Sales
      `;
      const parsed = parsePixShareText(scheduledReceipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.status).toBe("scheduled");
      expect(parsed?.isScheduled).toBe(true);
      expect(parsed?.scheduledFor).toBe("2026-10-28");
      expect(parsed?.date).toBe("2026-10-28");
      expect(parsed?.amountCents).toBe(35000);
      expect(parsed?.type).toBe("expense");
      expect(parsed?.merchant).toBe("Imobiliária Alvorada Ltda");
      expect(parsed?.description).toBe("Pix Agendado: Imobiliária Alvorada Ltda");
    });

    it("identifica Pix recebido como renda/income e extrai pagador e CNPJ", () => {
      const incomeReceipt = `
        Comprovante de Pix Recebido
        Valor: R$ 1.500,00
        Data: 21/10/2026 às 15:00
        Quem te enviou: Mariana Alves Consultoria ME
        CNPJ: 99.888.777/0001-66
        Instituição de Origem: BANCO INTER S.A.
        Recebido por: Gabriel Sales
      `;
      const parsed = parsePixShareText(incomeReceipt);
      expect(parsed).not.toBeNull();
      expect(parsed?.nature).toBe("income");
      expect(parsed?.type).toBe("income");
      expect(parsed?.amountCents).toBe(150000);
      expect(parsed?.payerName).toBe("Mariana Alves Consultoria ME");
      expect(parsed?.merchant).toBe("Mariana Alves Consultoria ME");
      expect(parsed?.description).toBe("Pix Recebido: Mariana Alves Consultoria ME");
      expect(parsed?.taxId).toBe("99888777000166");
    });
  });

  describe("isRefundTransaction (Detecção de Estornos e Reversões)", () => {
    it("detecta termos de estorno, reembolso e devolução", () => {
      expect(isRefundTransaction("Estorno de R$ 50,00 aprovado no cartão Nubank")).toBe(true);
      expect(isRefundTransaction("Reembolso recebido no valor de R$ 30,00")).toBe(true);
      expect(isRefundTransaction("Devolução Pix no valor de R$ 10,00")).toBe(true);
      expect(isRefundTransaction("Compra cancelada de R$ 90,00")).toBe(true);
      expect(isRefundTransaction("Compra de R$ 45,00 aprovada na padaria")).toBe(false);
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

  describe("extractCardLastDigits (Detecção de Dígitos Finais do Cartão)", () => {
    it("extrai 4 dígitos com padrão final 1234", () => {
      expect(
        extractCardLastDigits(
          "Compra de R$ 45,90 em Starbucks com Cartão Nubank final 1234",
        ),
      ).toBe("1234");
      expect(
        extractCardLastDigits(
          "Pagamento aprovado: R$ 42,00 em Posto Ipiranga com cartão final 7890",
        ),
      ).toBe("7890");
    });

    it("extrai 4 dígitos com marcadores de pontuação e máscaras", () => {
      expect(extractCardLastDigits("Compra no cartão final: 5678 aprovada")).toBe("5678");
      expect(extractCardLastDigits("Cartão final 9999 aprovado")).toBe("9999");
      expect(extractCardLastDigits("Cartão terminado em 4321")).toBe("4321");
      expect(extractCardLastDigits("Cartão final n. 6543")).toBe("6543");
    });

    it("não confunde valores monetários de 4 dígitos com número de cartão", () => {
      expect(extractCardLastDigits("Transferência Pix de R$ 1.234,00 realizada")).toBeUndefined();
      expect(extractCardLastDigits("Compra de R$ 2500,50 no supermercado")).toBeUndefined();
    });

    it("retorna undefined quando não há menção a dígitos de cartão", () => {
      expect(extractCardLastDigits("Pagamento aprovado: R$ 85,50 em Outback Steakhouse")).toBeUndefined();
      expect(extractCardLastDigits("Pix de R$ 100,00 realizado com sucesso")).toBeUndefined();
    });
  });

  describe("extractIssuerBank (Detecção de Banco Emissor para Carteiras Digitais)", () => {
    it("extrai o banco emissor associado ao cartão na notificação de carteira", () => {
      expect(
        extractIssuerBank(
          "Compra de R$ 45,90 em Starbucks com Cartão Nubank final 1234",
        ),
      ).toBe("Nubank");

      expect(
        extractIssuerBank(
          "Pagamento aprovado de R$ 100,00 no Cartão Itaú final 5678",
        ),
      ).toBe("Itaú");

      expect(
        extractIssuerBank(
          "Compra com Cartão Bradesco final 4321",
        ),
      ).toBe("Bradesco");

      expect(
        extractIssuerBank(
          "Compra com Cartão Santander final 6543",
        ),
      ).toBe("Santander");

      expect(
        extractIssuerBank(
          "Compra de R$ 25,00 no Cartão Inter final 1111",
        ),
      ).toBe("Inter");

      expect(
        extractIssuerBank(
          "Compra no cartão C6 Bank final 2222",
        ),
      ).toBe("C6 Bank");
    });

    it("retorna undefined quando a notificação de carteira não especifica o banco emissor", () => {
      expect(
        extractIssuerBank("Pagamento aprovado: R$ 85,50 em Outback Steakhouse"),
      ).toBeUndefined();

      expect(
        extractIssuerBank("Compra de R$ 30,00 no cartão final 1234"),
      ).toBeUndefined();
    });
  });

  describe("Carteiras Digitais (Google Wallet / Samsung Pay)", () => {
    it("processa notificação do Google Pay com banco emissor e dígitos de cartão", () => {
      const parsed = parseBankNotification({
        packageName: "com.google.android.apps.walletnfcrel",
        title: "Google Pay",
        text: "Compra de R$ 45,90 em Starbucks com Cartão Nubank final 1234",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(4590);
      expect(parsed?.merchant).toBe("Starbucks");
      expect(parsed?.issuerBank).toBe("Nubank");
      expect(parsed?.cardLastDigits).toBe("1234");
      expect(parsed?.paymentMethod).toBe("credit_card");
      expect(parsed?.type).toBe("expense");
    });

    it("processa notificação do Google Pay sem packageName mas com prefixo no título", () => {
      const parsed = parseBankNotification({
        title: "Google Pay",
        text: "R$ 35,00 em Livraria Cultura com Cartão Bradesco final 4321",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(3500);
      expect(parsed?.merchant).toBe("Livraria Cultura");
      expect(parsed?.issuerBank).toBe("Bradesco");
      expect(parsed?.cardLastDigits).toBe("4321");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação do Samsung Pay com estabelecimento e sem banco emissor", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Samsung Pay",
        text: "Pagamento aprovado: R$ 85,50 em Outback Steakhouse",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(8550);
      expect(parsed?.merchant).toBe("Outback Steakhouse");
      expect(parsed?.issuerBank).toBeUndefined();
      expect(parsed?.cardLastDigits).toBeUndefined();
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação do Samsung Pay com banco emissor e cartão", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.raja.spay",
        title: "Samsung Pay",
        text: "Compra de R$ 99,00 aprovada em Zara com Cartão Santander final 6543",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(9900);
      expect(parsed?.merchant).toBe("Zara");
      expect(parsed?.issuerBank).toBe("Santander");
      expect(parsed?.cardLastDigits).toBe("6543");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação de Samsung Pay com cartão Itaú em posto de combustível", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Pagamento aprovado",
        text: "Pagamento aprovado: R$ 42,00 em Posto Ipiranga com cartão Itaú final 7890",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(4200);
      expect(parsed?.merchant).toBe("Posto Ipiranga");
      expect(parsed?.issuerBank).toBe("Itaú");
      expect(parsed?.cardLastDigits).toBe("7890");
    });

    it("processa padrão canônico do Google Pay: 'Compra de R$ XX,XX em Estabelecimento Y com Cartão Banco Z final 1234'", () => {
      const parsed = parseBankNotification({
        packageName: "com.google.android.apps.walletnfcrel",
        title: "Google Pay",
        text: "Compra de R$ 42,90 em Padaria Estrela com Cartão Nubank final 1234",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(4290);
      expect(parsed?.merchant).toBe("Padaria Estrela");
      expect(parsed?.issuerBank).toBe("Nubank");
      expect(parsed?.cardLastDigits).toBe("1234");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa padrão canônico do Samsung Pay: 'Pagamento aprovado: R$ XX,XX em Estabelecimento Y'", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Samsung Pay",
        text: "Pagamento aprovado: R$ 150,00 em Droga Raia",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(15000);
      expect(parsed?.merchant).toBe("Droga Raia");
      expect(parsed?.issuerBank).toBeUndefined();
      expect(parsed?.cardLastDigits).toBeUndefined();
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("extrai bandeira Mastercard em compra aprovada no Google Pay", () => {
      const parsed = parseBankNotification({
        packageName: "com.google.android.apps.walletnfcrel",
        title: "Google Pay",
        text: "Compra aprovada de R$ 120,00 em Mercado Livre com Mastercard final 9999",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(12000);
      expect(parsed?.merchant).toBe("Mercado Livre");
      expect(parsed?.issuerBank).toBe("Mastercard");
      expect(parsed?.cardLastDigits).toBe("9999");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação resumida GPay com final de cartão", () => {
      const parsed = parseBankNotification({
        title: "GPay",
        text: "GPay: R$ 35,50 em Starbucks final 4321",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(3550);
      expect(parsed?.merchant).toBe("Starbucks");
      expect(parsed?.cardLastDigits).toBe("4321");
      expect(parsed?.issuerBank).toBeUndefined();
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("detecta pagamento em débito explicitado em notificação de Carteira Google", () => {
      const parsed = parseBankNotification({
        packageName: "com.google.android.apps.walletnfcrel",
        title: "Carteira Google",
        text: "Compra no débito de R$ 30,00 em Padaria Central com Cartão Inter final 5555",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Carteira Google");
      expect(parsed?.amountCents).toBe(3000);
      expect(parsed?.merchant).toBe("Padaria Central");
      expect(parsed?.issuerBank).toBe("Inter");
      expect(parsed?.cardLastDigits).toBe("5555");
      expect(parsed?.paymentMethod).toBe("debit");
    });

    it("processa Samsung Pay com estabelecimento Pão de Açúcar e final de cartão", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Samsung Pay",
        text: "Samsung Pay: R$ 52,00 em Supermercado Pão de Açúcar final 1234",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(5200);
      expect(parsed?.merchant).toBe("Supermercado Pão de Açúcar");
      expect(parsed?.cardLastDigits).toBe("1234");
      expect(parsed?.issuerBank).toBeUndefined();
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação com cartão e banco citados antes do estabelecimento", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Pagamento aprovado",
        text: "Pagamento aprovado no Cartão Bradesco final 2222: R$ 80,00 em Posto Shell",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(8000);
      expect(parsed?.merchant).toBe("Posto Shell");
      expect(parsed?.issuerBank).toBe("Bradesco");
      expect(parsed?.cardLastDigits).toBe("2222");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação do Samsung Wallet com cartão Caixa e cinema", () => {
      const parsed = parseBankNotification({
        title: "Samsung Wallet",
        text: "Pagamento de R$ 60,00 aprovado no Cartão Caixa final 4444 em Cinema Cinemark",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(6000);
      expect(parsed?.merchant).toBe("Cinema Cinemark");
      expect(parsed?.issuerBank).toBe("Caixa");
      expect(parsed?.cardLastDigits).toBe("4444");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });

    it("processa notificação com traço separando cartão e valor", () => {
      const parsed = parseBankNotification({
        packageName: "com.samsung.android.spay",
        title: "Samsung Pay",
        text: "Samsung Pay: Cartão Inter final 3333 - R$ 45,00 em Restaurante Silva",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.bankName).toBe("Samsung Pay");
      expect(parsed?.amountCents).toBe(4500);
      expect(parsed?.merchant).toBe("Restaurante Silva");
      expect(parsed?.issuerBank).toBe("Inter");
      expect(parsed?.cardLastDigits).toBe("3333");
      expect(parsed?.paymentMethod).toBe("credit_card");
    });
  });

  describe("Corretoras, Cripto & Contas Globais (Binance, Rico, Nomad, BTG Investimentos) (Fase 2 — Tarefa 2.2)", () => {
    describe("Auxiliares de Câmbio, Moeda e Ativos", () => {
      it("detectCurrency identifica USD e BRL corretamente", () => {
        expect(detectCurrency("Compra de US$ 45,00 na Apple")).toBe("USD");
        expect(detectCurrency("Pagamento de USD 10,00 aprovado")).toBe("USD");
        expect(detectCurrency("Câmbio de R$ 5.000,00 para US$ 980,00")).toBe("BRL");
        expect(detectCurrency("Compra de R$ 42,90")).toBe("BRL");
      });

      it("extractNomadExchangeMetadata extrai cotação, IOF e montante em moeda estrangeira", () => {
        const meta1 = extractNomadExchangeMetadata(
          "Câmbio concluído: você converteu R$ 5.000,00 para US$ 980,40 (Cotação: R$ 5,02 | IOF: R$ 55,00)",
        );
        expect(meta1.currency).toBe("BRL");
        expect(meta1.exchangeRate).toBe(5.02);
        expect(meta1.iofCents).toBe(5500);
        expect(meta1.foreignAmountCents).toBe(98040);

        const meta2 = extractNomadExchangeMetadata(
          "Conversão realizada: R$ 1.500,00 em US$ 290,00. Cotação comercial 5,10, IOF R$ 16,50",
        );
        expect(meta2.currency).toBe("BRL");
        expect(meta2.exchangeRate).toBe(5.1);
        expect(meta2.iofCents).toBe(1650);
        expect(meta2.foreignAmountCents).toBe(29000);
      });

      it("extractInvestmentAsset extrai tickers B3, criptoativos e fundos", () => {
        expect(extractInvestmentAsset("Você recebeu proventos de R$ 142,50 de HGLG11")).toBe("HGLG11");
        expect(extractInvestmentAsset("Dividendos recebidos: R$ 85,20 de PETR4")).toBe("PETR4");
        expect(extractInvestmentAsset("Sua ordem de compra de BTC foi executada")).toBe("BTC");
        expect(extractInvestmentAsset("Ordem de venda executada: R$ 450,00 em USDT")).toBe("USDT");
        expect(
          extractInvestmentAsset("Aplicação realizada com sucesso: R$ 10.000,00 no Fundo BTG Pactual Tesouro Selic"),
        ).toBe("BTG Pactual Tesouro Selic");
        expect(
          extractInvestmentAsset("Investimento realizado: R$ 5.000,00 em CDB BTG Pactual 110% CDI"),
        ).toBe("BTG Pactual 110% CDI");
      });

      it("detectTransactionNature classifica proventos, trades, resgates e aportes", () => {
        expect(detectTransactionNature("Você recebeu dividendos de R$ 50,00", "XP", "XP Investimentos")).toEqual({
          nature: "investment",
          subtype: "dividend",
        });
        expect(detectTransactionNature("Sua ordem de compra de BTC foi executada", "Binance", "Binance")).toEqual({
          nature: "investment",
          subtype: "trade",
        });
        expect(detectTransactionNature("Liquidação de título creditada", "BTG", "BTG Investimentos")).toEqual({
          nature: "investment",
          subtype: "redemption",
        });
        expect(detectTransactionNature("Depósito de R$ 500,00 recebido via Pix", "Binance", "Binance")).toEqual({
          nature: "investment",
          subtype: "contribution",
        });
        expect(detectTransactionNature("Compra aprovada de US$ 45,00 na Apple", "Nomad", "Nomad")).toEqual({
          nature: "expense",
        });
      });
    });

    describe("Binance (com.binance.dev)", () => {
      it("parseia depósito BRL via Pix com natureza de investimento e aporte", () => {
        const parsed = parseBankNotification({
          packageName: "com.binance.dev",
          title: "Binance",
          text: "Depósito de R$ 500,00 recebido com sucesso via Pix",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Binance");
        expect(parsed?.amountCents).toBe(50000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
        expect(parsed?.paymentMethod).toBe("pix");
        expect(parsed?.description).toBe("Depósito via Pix (Binance)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia ordem de compra Spot de BTC com extração de ticker", () => {
        const parsed = parseBankNotification({
          packageName: "com.binance.dev",
          title: "Ordem executada",
          text: "Sua ordem de compra de BTC foi executada: R$ 250,00",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Binance");
        expect(parsed?.amountCents).toBe(25000);
        expect(parsed?.type).toBe("expense");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("trade");
        expect(parsed?.assetTicker).toBe("BTC");
        expect(parsed?.description).toBe("Compra Spot BTC (Binance)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia ordem de venda Spot de ETH com entrada de receita/caixa", () => {
        const parsed = parseBankNotification({
          title: "Binance",
          text: "Sua ordem de venda de ETH foi executada: R$ 800,00",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Binance");
        expect(parsed?.amountCents).toBe(80000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("trade");
        expect(parsed?.assetTicker).toBe("ETH");
        expect(parsed?.description).toBe("Venda Spot ETH (Binance)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia transferência de cripto confirmada em SOL", () => {
        const parsed = parseBankNotification({
          title: "Binance",
          text: "Transferência de cripto confirmada: R$ 300,00 em SOL",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Binance");
        expect(parsed?.amountCents).toBe(30000);
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.assetTicker).toBe("SOL");
      });
    });

    describe("Rico & XP (br.com.rico / com.xpinc.investments)", () => {
      it("parseia recebimento de proventos e dividendos com ticker de FII (HGLG11)", () => {
        const parsed = parseBankNotification({
          packageName: "br.com.rico",
          title: "Proventos recebidos",
          text: "Você recebeu proventos de R$ 142,50 de HGLG11",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Rico");
        expect(parsed?.amountCents).toBe(14250);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("dividend");
        expect(parsed?.assetTicker).toBe("HGLG11");
        expect(parsed?.description).toBe("Dividendos HGLG11 (Rico)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia recebimento de JCP na Rico com ticker de ação (ITUB4)", () => {
        const parsed = parseBankNotification({
          title: "Rico",
          text: "JCP creditado: R$ 45,00 de ITUB4",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Rico");
        expect(parsed?.amountCents).toBe(4500);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("dividend");
        expect(parsed?.assetTicker).toBe("ITUB4");
        expect(parsed?.description).toBe("Dividendos ITUB4 (Rico)");
      });

      it("parseia aporte para investimento na Rico", () => {
        const parsed = parseBankNotification({
          title: "Rico",
          text: "Depósito de R$ 2.000,00 recebido para investimentos na Rico",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Rico");
        expect(parsed?.amountCents).toBe(200000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
        expect(parsed?.description).toBe("Aporte para Investimento (Rico)");
      });

      it("parseia nota de corretagem de compra de ação na Rico (WEGE3)", () => {
        const parsed = parseBankNotification({
          packageName: "br.com.rico.investimentos",
          title: "Nota de corretagem",
          text: "Nota de corretagem disponível: Compra de 100 WEGE3 por R$ 3.800,00",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Rico");
        expect(parsed?.amountCents).toBe(380000);
        expect(parsed?.type).toBe("expense");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("trade");
        expect(parsed?.assetTicker).toBe("WEGE3");
        expect(parsed?.description).toBe("Compra Spot WEGE3 (Rico)");
      });

      it("parseia ordem de venda executada na XP Investimentos (VALE3)", () => {
        const parsed = parseBankNotification({
          packageName: "com.xpinc.investments",
          title: "XP Investimentos",
          text: "Ordem de venda executada: R$ 2.300,00 em VALE3",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("XP Investimentos");
        expect(parsed?.amountCents).toBe(230000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("trade");
        expect(parsed?.assetTicker).toBe("VALE3");
        expect(parsed?.description).toBe("Venda Spot VALE3 (XP Investimentos)");
      });
    });

    describe("Nomad (com.nomadfinancial.app)", () => {
      it("parseia conversão cambial USD -> BRL com cotação e IOF detectados", () => {
        const parsed = parseBankNotification({
          packageName: "com.nomadfinancial.app",
          title: "Nomad",
          text: "Câmbio concluído: você converteu R$ 5.000,00 para US$ 980,40 (Cotação: R$ 5,02 | IOF: R$ 55,00)",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Nomad");
        expect(parsed?.amountCents).toBe(500000);
        expect(parsed?.currency).toBe("BRL");
        expect(parsed?.exchangeRate).toBe(5.02);
        expect(parsed?.iofCents).toBe(5500);
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
        expect(parsed?.type).toBe("expense");
        expect(parsed?.description).toBe("Câmbio USD (Nomad)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia conversão cambial alternativa com formato comercial de taxa", () => {
        const parsed = parseBankNotification({
          title: "Nomad",
          text: "Conversão realizada: R$ 1.500,00 em US$ 290,00. Cotação comercial 5,10, IOF R$ 16,50",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Nomad");
        expect(parsed?.amountCents).toBe(150000);
        expect(parsed?.exchangeRate).toBe(5.1);
        expect(parsed?.iofCents).toBe(1650);
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
      });

      it("parseia compra no débito internacional Nomad com Apple Store em dólares", () => {
        const parsed = parseBankNotification({
          packageName: "com.nomadfinancial.app",
          title: "Nomad",
          text: "Compra aprovada de US$ 45,00 na Apple Store com seu cartão Nomad final 1234",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Nomad");
        expect(parsed?.amountCents).toBe(4500);
        expect(parsed?.currency).toBe("USD");
        expect(parsed?.type).toBe("expense");
        expect(parsed?.nature).toBe("expense");
        expect(parsed?.paymentMethod).toBe("debit");
        expect(parsed?.merchant).toBe("Apple Store");
        expect(parsed?.cardLastDigits).toBe("1234");
        expect(parsed?.description).toBe("Apple Store");
      });

      it("parseia compra no débito em dólares com Starbucks Miami", () => {
        const parsed = parseBankNotification({
          packageName: "com.nomadfinancial.app",
          title: "Compra no débito",
          text: "Compra aprovada no débito: US$ 12,50 em Starbucks Miami",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("Nomad");
        expect(parsed?.amountCents).toBe(1250);
        expect(parsed?.currency).toBe("USD");
        expect(parsed?.merchant).toBe("Starbucks Miami");
        expect(parsed?.paymentMethod).toBe("debit");
      });
    });

    describe("BTG Investimentos (com.btgpactual.investimentos)", () => {
      it("parseia aporte em fundo de investimento Tesouro Selic", () => {
        const parsed = parseBankNotification({
          packageName: "com.btgpactual.investimentos",
          title: "Aplicação realizada",
          text: "Aplicação realizada com sucesso: R$ 10.000,00 no Fundo BTG Pactual Tesouro Selic",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("BTG Investimentos");
        expect(parsed?.amountCents).toBe(1000000);
        expect(parsed?.type).toBe("expense");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
        expect(parsed?.assetTicker).toBe("BTG Pactual Tesouro Selic");
        expect(parsed?.description).toBe("Aplicação BTG Pactual Tesouro Selic");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia investimento em CDB com rentabilidade CDI", () => {
        const parsed = parseBankNotification({
          title: "BTG Investimentos",
          text: "Investimento realizado: R$ 5.000,00 em CDB BTG Pactual 110% CDI",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("BTG Investimentos");
        expect(parsed?.amountCents).toBe(500000);
        expect(parsed?.type).toBe("expense");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("contribution");
        expect(parsed?.assetTicker).toBe("BTG Pactual 110% CDI");
      });

      it("parseia liquidação de título com entrada de recursos na conta", () => {
        const parsed = parseBankNotification({
          packageName: "com.btgpactual.investimentos",
          title: "Liquidação de título",
          text: "Liquidação de título: R$ 12.450,00 creditado na sua conta BTG",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("BTG Investimentos");
        expect(parsed?.amountCents).toBe(1245000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("redemption");
        expect(parsed?.description).toBe("Liquidação de Título (BTG Investimentos)");
        expect(parsed?.categorySlug).toBe("investimentos");
      });

      it("parseia resgate confirmado de fundo de investimento", () => {
        const parsed = parseBankNotification({
          title: "BTG Investimentos",
          text: "Resgate confirmado de R$ 4.000,00 do Fundo BTG Pactual",
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.bankName).toBe("BTG Investimentos");
        expect(parsed?.amountCents).toBe(400000);
        expect(parsed?.type).toBe("income");
        expect(parsed?.nature).toBe("investment");
        expect(parsed?.investmentSubtype).toBe("redemption");
      });
    });
  });

  describe("Fusão Temporal, Deduplicação e Bandeiras de Cartão (§2.4)", () => {
    describe("extractCardBrand & isCardBrand", () => {
      it("extrai bandeiras Mastercard, Visa, Elo, Amex e Hipercard", () => {
        expect(extractCardBrand("Compra com Mastercard final 1234")).toBe("Mastercard");
        expect(extractCardBrand("Pagamento via Cartão Visa aprovado")).toBe("Visa");
        expect(extractCardBrand("Transação no Elo final 4444")).toBe("Elo");
        expect(extractCardBrand("Compra no American Express final 3333")).toBe("American Express");
        expect(extractCardBrand("Uso do Amex aprovado")).toBe("American Express");
        expect(extractCardBrand("Hipercard compra aprovada")).toBe("Hipercard");
        expect(extractCardBrand("Compra comum sem bandeira")).toBeUndefined();
      });

      it("valida identificadores de bandeiras com isCardBrand", () => {
        expect(isCardBrand("Mastercard")).toBe(true);
        expect(isCardBrand("visa")).toBe(true);
        expect(isCardBrand("elo")).toBe(true);
        expect(isCardBrand("American Express")).toBe(true);
        expect(isCardBrand("amex")).toBe(true);
        expect(isCardBrand("Hipercard")).toBe(true);
        expect(isCardBrand("Nubank")).toBe(false);
        expect(isCardBrand("Itaú")).toBe(false);
        expect(isCardBrand(undefined)).toBe(false);
      });
    });

    describe("isDigitalWallet", () => {
      it("identifica carteiras digitais proxy NFC", () => {
        expect(isDigitalWallet("Carteira Google")).toBe(true);
        expect(isDigitalWallet("Google Pay")).toBe(true);
        expect(isDigitalWallet("Google Wallet")).toBe(true);
        expect(isDigitalWallet("Samsung Pay")).toBe(true);
        expect(isDigitalWallet("Samsung Wallet")).toBe(true);
        expect(isDigitalWallet("Nubank")).toBe(false);
        expect(isDigitalWallet("Itaú")).toBe(false);
        expect(isDigitalWallet("Banco Inter")).toBe(false);
        expect(isDigitalWallet(undefined)).toBe(false);
      });
    });

    describe("areMerchantsCompatible", () => {
      const base: ParsedBankTransaction = {
        id: "sug_base",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 5000,
        description: "Padaria Estrela",
        merchant: "Padaria Estrela",
        date: "2026-10-20",
        rawText: "texto",
        timestamp: Date.now(),
      };

      it("considera compatíveis estabelecimentos com match exato ou substring", () => {
        expect(
          areMerchantsCompatible(base, {
            ...base,
            merchant: "PADARIA ESTRELA LTDA",
          }),
        ).toBe(true);

        expect(
          areMerchantsCompatible(base, {
            ...base,
            merchant: "Padaria Estrela",
          }),
        ).toBe(true);
      });

      it("distingue comércios diferentes mesmo com prefixos comerciais idênticos", () => {
        expect(
          areMerchantsCompatible(base, {
            ...base,
            merchant: "Padaria Central",
          }),
        ).toBe(false);

        expect(
          areMerchantsCompatible(
            { ...base, merchant: "Posto Shell" },
            { ...base, merchant: "Posto Ipiranga" },
          ),
        ).toBe(false);
      });

      it("compara merchant contra description quando um deles não tiver merchant explícito", () => {
        expect(
          areMerchantsCompatible(base, {
            ...base,
            merchant: undefined,
            description: "Compra na Padaria Estrela aprovada",
          }),
        ).toBe(true);
      });
    });

    describe("isWithinTemporalWindow", () => {
      const t0 = 1729000000000;
      const txA: ParsedBankTransaction = {
        id: "a",
        bankName: "Google Pay",
        nature: "expense",
        type: "expense",
        amountCents: 1000,
        description: "Teste",
        date: "2026-10-20",
        rawText: "raw",
        timestamp: t0,
      };

      it("valida constante de tolerância de 5 minutos", () => {
        expect(DEDUPLICATION_WINDOW_MS).toBe(300_000);
      });

      it("retorna true dentro de 5 minutos e false após 5 minutos", () => {
        expect(isWithinTemporalWindow(txA, { ...txA, timestamp: t0 + 500 })).toBe(true);
        expect(isWithinTemporalWindow(txA, { ...txA, timestamp: t0 + 4 * 60 * 1000 })).toBe(true);
        expect(isWithinTemporalWindow(txA, { ...txA, timestamp: t0 + 5 * 60 * 1000 })).toBe(true);
        expect(isWithinTemporalWindow(txA, { ...txA, timestamp: t0 + 5 * 60 * 1000 + 1 })).toBe(false);
        expect(isWithinTemporalWindow(txA, { ...txA, timestamp: t0 + 6 * 60 * 1000 })).toBe(false);
      });
    });

    describe("mergeWalletWithBank", () => {
      it("funde sugestão da carteira com a do banco oficial preservando bandeira e dígitos", () => {
        const wallet: ParsedBankTransaction = {
          id: "sug_wallet",
          bankName: "Carteira Google",
          nature: "expense",
          type: "expense",
          amountCents: 4500,
          description: "Padaria Estrela",
          merchant: "Padaria Estrela",
          cardBrand: "Mastercard",
          cardLastDigits: "1234",
          issuerBank: "Nubank",
          date: "2026-10-20",
          paymentMethod: "credit_card",
          rawText: "Compra de R$ 45,00 em Padaria Estrela com Cartão Nubank final 1234",
          timestamp: 1000,
        };

        const bank: ParsedBankTransaction = {
          id: "sug_bank",
          bankName: "Nubank",
          nature: "expense",
          type: "expense",
          amountCents: 4500,
          description: "Compra aprovada em Padaria Estrela",
          merchant: "Padaria Estrela",
          date: "2026-10-20",
          paymentMethod: "credit_card",
          rawText: "Compra de R$ 45,00 aprovada no Nubank em Padaria Estrela",
          timestamp: 1500,
        };

        const merged = mergeWalletWithBank(wallet, bank);

        expect(merged.bankName).toBe("Nubank");
        expect(merged.cardBrand).toBe("Mastercard");
        expect(merged.cardLastDigits).toBe("1234");
        expect(merged.amountCents).toBe(4500);
        expect(merged.merchant).toBe("Padaria Estrela");
      });
    });
  });
});
