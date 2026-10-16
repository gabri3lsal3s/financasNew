import { describe, expect, it } from "vitest";
import {
  isBlacklistedNotification,
  parseBankNotification,
  parsePixShareText,
} from "./bank-parser";
import { inferCategoryKeyword } from "./category-inference";

describe("Suíte E2E de Notificações Bancárias & Matriz dos 10 Maiores Bancos (Fase 13 — Tarefa 29)", () => {
  describe("1. Matriz dos 10 Maiores Bancos do Brasil", () => {
    describe("Nubank (com.nu.production)", () => {
      it("parseia compra à vista no débito com inferência de categoria", () => {
        const result = parseBankNotification({
          packageName: "com.nu.production",
          title: "Compra no débito",
          text: "Compra de R$ 35,50 aprovada no débito em PADARIA REAL",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Nubank");
        expect(result?.amountCents).toBe(3550);
        expect(result?.type).toBe("expense");
        expect(result?.paymentMethod).toBe("debit");
        expect(result?.merchant).toBe("PADARIA REAL");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("alimentacao");
      });

      it("parseia compra parcelada no cartão com cálculo correto de parcelas", () => {
        const result = parseBankNotification({
          packageName: "com.nu.production",
          title: "Compra aprovada",
          text: "Compra de R$ 900,00 em 3x no Cartao Nubank em MAGAZINE LUIZA",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(90000);
        expect(result?.installments).toBe(3);
        expect(result?.installmentAmountCents).toBe(30000);
        expect(result?.type).toBe("expense");
        expect(result?.paymentMethod).toBe("credit_card");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("compras");
      });

      it("parseia recebimento Pix com inferência de salário/renda", () => {
        const result = parseBankNotification({
          packageName: "com.nu.production",
          title: "Transferência recebida",
          text: "Você recebeu uma transferência Pix de R$ 3.500,00 de EMPRESA XPTO SALARIO",
        });

        expect(result).not.toBeNull();
        expect(result?.type).toBe("income");
        expect(result?.amountCents).toBe(350000);
        expect(result?.paymentMethod).toBe("pix");
        expect(result?.categorySlug).toBe("salario");
      });
    });

    describe("Itaú (com.itau / com.itau.personnalite)", () => {
      it("parseia compra no cartão com delimitador de travessão e adquirente UBER", () => {
        const result = parseBankNotification({
          packageName: "com.itau",
          title: "Itaucard",
          text: "Itaucartao: Compra aprovada - UBER *TRIP - R$ 28,90 em 16/10",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Itaú");
        expect(result?.amountCents).toBe(2890);
        expect(result?.merchant).toBe("Uber");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("transporte");
      });

      it("parseia compra parcelada de grande porte com 10 parcelas", () => {
        const result = parseBankNotification({
          packageName: "com.itau.personnalite",
          title: "Itau Personnalité",
          text: "Compra aprovada - FAST SHOP - R$ 1.500,00 em 10x",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Itaú Personnalité");
        expect(result?.amountCents).toBe(150000);
        expect(result?.installments).toBe(10);
        expect(result?.installmentAmountCents).toBe(15000);
        expect(result?.merchant).toBe("FAST SHOP");
      });

      it("parseia envio de Pix", () => {
        const result = parseBankNotification({
          packageName: "com.itau",
          title: "Itaú",
          text: "Itau: Pix de R$ 150,00 realizado para Pedro Souza",
        });

        expect(result).not.toBeNull();
        expect(result?.type).toBe("expense");
        expect(result?.amountCents).toBe(15000);
        expect(result?.paymentMethod).toBe("pix");
      });
    });

    describe("Bradesco (com.bradesco / com.bradesco.cartoes)", () => {
      it("parseia compra em drogaria e limpa final de cartão", () => {
        const result = parseBankNotification({
          packageName: "com.bradesco.cartoes",
          title: "Bradesco Cartões",
          text: "Bradesco Cartoes: Compra aprovada no cartao final 1234 - DROGASIL - R$ 74,30",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Bradesco");
        expect(result?.amountCents).toBe(7430);
        expect(result?.merchant).toBe("DROGASIL");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("saude");
      });

      it("parseia formato de parcelas 'Nx de R$ Y'", () => {
        const result = parseBankNotification({
          packageName: "com.bradesco",
          title: "Bradesco",
          text: "Compra aprovada no cartao final 5678 - PONTO FRIO - 5x de R$ 80,00",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(40000);
        expect(result?.installments).toBe(5);
        expect(result?.installmentAmountCents).toBe(8000);
      });
    });

    describe("Santander (com.santander.app / br.com.santander.way)", () => {
      it("parseia compra em supermercado no Santander Way", () => {
        const result = parseBankNotification({
          packageName: "br.com.santander.way",
          title: "Santander Way",
          text: "Santander Way: Compra aprovada de R$ 115,00 no cartao final 4321 em SUPERMERCADO EXTRA",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Santander");
        expect(result?.amountCents).toBe(11500);
        expect(result?.merchant).toBe("SUPERMERCADO EXTRA");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("mercado");
      });

      it("parseia compra parcelada em 6x", () => {
        const result = parseBankNotification({
          packageName: "com.santander.app",
          title: "Santander",
          text: "Santander: Compra aprovada de R$ 600,00 em 6x em RENNER",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(60000);
        expect(result?.installments).toBe(6);
        expect(result?.installmentAmountCents).toBe(10000);
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("compras");
      });
    });

    describe("Banco do Brasil (br.com.bb.android)", () => {
      it("parseia compra Ourocard com delimitadores por vírgula", () => {
        const result = parseBankNotification({
          packageName: "br.com.bb.android",
          title: "BB",
          text: "BB: Compra no cartao final 9876, R$ 58,00, POSTO IPIRANGA, em 16/10",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Banco do Brasil");
        expect(result?.amountCents).toBe(5800);
        expect(result?.merchant).toBe("POSTO IPIRANGA");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("transporte");
      });

      it("parseia compra parcelada BB", () => {
        const result = parseBankNotification({
          packageName: "br.com.bb.android",
          title: "Banco do Brasil",
          text: "BB: Compra no cartao final 9876 em 4x de R$ 125,00, CASAS BAHIA",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(50000);
        expect(result?.installments).toBe(4);
        expect(result?.installmentAmountCents).toBe(12500);
      });
    });

    describe("Banco Inter (br.com.intermedium)", () => {
      it("parseia compra em farmácia no cartão de crédito", () => {
        const result = parseBankNotification({
          packageName: "br.com.intermedium",
          title: "Inter",
          text: "Inter: Compra aprovada no cartao de credito de R$ 45,90 em FARMACIA PAGUEMENOS",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Inter");
        expect(result?.amountCents).toBe(4590);
        expect(result?.paymentMethod).toBe("credit_card");
        expect(result?.merchant).toBe("FARMACIA PAGUEMENOS");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("saude");
      });

      it("parseia compra parcelada no Inter", () => {
        const result = parseBankNotification({
          packageName: "br.com.intermedium",
          title: "Inter",
          text: "Inter: Compra aprovada em 3x de R$ 100,00 em AMAZON BR",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(30000);
        expect(result?.installments).toBe(3);
        expect(result?.installmentAmountCents).toBe(10000);
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("compras");
      });
    });

    describe("C6 Bank (com.c6bank.app)", () => {
      it("parseia compra no iFood com sanitização de adquirente", () => {
        const result = parseBankNotification({
          packageName: "com.c6bank.app",
          title: "C6 Bank",
          text: "C6 Bank: Compra aprovada de R$ 89,00 no cartao Mastercard em IFOOD *RESTAURANTE SABOR",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("C6 Bank");
        expect(result?.amountCents).toBe(8900);
        expect(result?.merchant).toBe("RESTAURANTE SABOR");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("alimentacao");
      });

      it("parseia compra de alto valor em 12 parcelas", () => {
        const result = parseBankNotification({
          packageName: "com.c6bank.app",
          title: "C6 Bank",
          text: "C6 Bank: Compra aprovada de R$ 1.200,00 em 12x em APPLE STORE",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(120000);
        expect(result?.installments).toBe(12);
        expect(result?.installmentAmountCents).toBe(10000);
      });
    });

    describe("Mercado Pago (com.mercadopago.wallet)", () => {
      it("parseia pagamento de mercado à vista", () => {
        const result = parseBankNotification({
          packageName: "com.mercadopago.wallet",
          title: "Mercado Pago",
          text: "Mercado Pago: Voce pagou R$ 42,00 no MERCADO CARREFOUR",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Mercado Pago");
        expect(result?.amountCents).toBe(4200);
        expect(result?.merchant).toBe("MERCADO CARREFOUR");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("mercado");
      });

      it("parseia compra no Mercado Livre parcelada em 2x", () => {
        const result = parseBankNotification({
          packageName: "com.mercadopago.wallet",
          title: "Mercado Pago",
          text: "Mercado Pago: Compra aprovada em 2x de R$ 75,00 em MERCADO LIVRE",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(15000);
        expect(result?.installments).toBe(2);
        expect(result?.installmentAmountCents).toBe(7500);
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("compras");
      });
    });

    describe("Caixa Econômica (br.gov.caixa.tem / br.com.gabba.Caixa)", () => {
      it("parseia compra no cartão Caixa Tem em hortifruti", () => {
        const result = parseBankNotification({
          packageName: "br.gov.caixa.tem",
          title: "Caixa Tem",
          text: "CAIXA: Compra aprovada no cartao Elo de R$ 65,00 em HORTIFRUTI",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Caixa Tem");
        expect(result?.amountCents).toBe(6500);
        expect(result?.merchant).toBe("HORTIFRUTI");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("mercado");
      });

      it("parseia compra parcelada Caixa em 4x", () => {
        const result = parseBankNotification({
          packageName: "br.com.gabba.Caixa",
          title: "Caixa",
          text: "CAIXA: Compra aprovada de R$ 400,00 em 4x em LOJAS AMERICANAS",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("Caixa");
        expect(result?.amountCents).toBe(40000);
        expect(result?.installments).toBe(4);
        expect(result?.installmentAmountCents).toBe(10000);
      });
    });

    describe("PicPay (com.picpay)", () => {
      it("parseia pagamento no cartão PicPay Card", () => {
        const result = parseBankNotification({
          packageName: "com.picpay",
          title: "PicPay",
          text: "PicPay: Pagamento de R$ 32,50 aprovado com cartao PicPay Card em PADARIA CENTRAL",
        });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe("PicPay");
        expect(result?.amountCents).toBe(3250);
        expect(result?.paymentMethod).toBe("credit_card");
        expect(result?.merchant).toBe("PADARIA CENTRAL");
        expect(inferCategoryKeyword(result?.merchant || "")).toBe("alimentacao");
      });

      it("parseia compra parcelada PicPay Card", () => {
        const result = parseBankNotification({
          packageName: "com.picpay",
          title: "PicPay",
          text: "PicPay: Compra aprovada de R$ 300,00 em 3x no PicPay Card em KALUNGA",
        });

        expect(result).not.toBeNull();
        expect(result?.amountCents).toBe(30000);
        expect(result?.installments).toBe(3);
        expect(result?.installmentAmountCents).toBe(10000);
      });
    });
  });

  describe("2. Estresse da Blacklist Semântica (35 Formatos Reais de Falsos Positivos)", () => {
    const falsePositives = [
      // Faturas Fechadas / Abertas / Resumos
      { title: "Nubank", text: "Sua fatura Nubank fechou em R$ 1.450,20" },
      { title: "Itaú", text: "Fatura Itaú: seu fechamento foi de R$ 2.300,00. Pague até 25/10" },
      { title: "Bradesco Cartões", text: "Bradesco Cartoes: Fatura fechada no valor de R$ 890,50" },
      { title: "Santander Way", text: "Santander Way: O fechamento da sua fatura ocorreu hoje. Valor total: R$ 3.120,00" },
      { title: "Inter", text: "Inter: Sua fatura de R$ 650,00 esta disponivel para pagamento" },
      { title: "C6 Bank", text: "C6 Bank: Resumo da fatura fechada: R$ 1.100,00" },
      { title: "Mercado Pago", text: "Mercado Pago: Sua fatura fechou. Pague o valor minimo de R$ 150,00" },
      { title: "Banco do Brasil", text: "BB: Fatura do cartao Ourocard fechada no valor de R$ 420,00" },

      // Pagamentos de Fatura (evitar duplicidade de despesas já lançadas)
      { title: "Nubank", text: "Pagamento de fatura de R$ 1.450,20 confirmado no Nubank" },
      { title: "Itaú", text: "Itau: Pagamento de fatura recebido no valor de R$ 2.300,00" },
      { title: "Bradesco", text: "Bradesco: Pagamento efetuado da sua fatura no valor de R$ 890,50" },
      { title: "Santander", text: "Santander: Pagamento da fatura confirmado: R$ 3.120,00" },
      { title: "Inter", text: "Inter: Recebemos o pagamento da fatura de R$ 650,00" },
      { title: "C6 Bank", text: "C6 Bank: Pagamento de fatura processado: R$ 1.100,00" },
      { title: "Nubank", text: "Confirmamos o pagamento da sua fatura de R$ 500,00" },
      { title: "Itaú", text: "Sua fatura paga com sucesso" },

      // Transações Negadas, Recusas, Cancelamentos e Bloqueios
      { title: "Nubank", text: "Compra de R$ 450,00 nao autorizada por saldo insuficiente" },
      { title: "Itaú", text: "Itaucartao: Compra recusada de R$ 1.200,00 por limite insuficiente" },
      { title: "Bradesco", text: "Bradesco: Transacao negada por seguranca no valor de R$ 90,00" },
      { title: "Nubank", text: "Nubank: Compra cancelada no valor de R$ 85,00" },
      { title: "Santander", text: "Santander: Transacao nao aprovada de R$ 300,00" },
      { title: "Inter", text: "Inter: Compra negada em LOJA VIRTUAL no valor de R$ 120,00" },
      { title: "C6 Bank", text: "Cartao bloqueado temporariamente por suspeita de fraude" },
      { title: "Bradesco", text: "Estorno negado pelo estabelecimento no valor de R$ 50,00" },

      // Ofertas de Crédito, Empréstimo Pré-Aprovado e Limite
      { title: "Nubank", text: "Voce tem R$ 15.000,00 de emprestimo pre-aprovado no Nubank" },
      { title: "Itaú", text: "Itau: Limite pre-aprovado de credito pessoal disponivel: R$ 5.000,00" },
      { title: "Bradesco", text: "Bradesco: Contrate agora seu credito pre-aprovado de ate R$ 20.000,00" },
      { title: "Santander", text: "Santander: Oferta especial de emprestimo de R$ 10.000,00 com taxa reduzida" },
      { title: "Inter", text: "Inter: Liberamos R$ 8.000,00 de credito para voce aproveitar" },
      { title: "Nubank", text: "Seu novo limite do cartao Nubank e de R$ 4.500,00" },
      { title: "C6 Bank", text: "Aumento de limite concedido: agora voce tem R$ 7.000,00 no C6" },
      { title: "Bradesco", text: "Bradesco: Seu limite foi ajustado para R$ 12.000,00" },
      { title: "PicPay", text: "PicPay: Aproveite 10% de cashback nas compras com PicPay Card" },

      // Tokens, Segurança e 2FA
      { title: "Nubank", text: "Nubank: Use o codigo 489215 para autorizar o acesso a sua conta" },
      { title: "Itaú", text: "Itau: Seu token de seguranca e 821943. Valido por 5 minutos" },
      { title: "Banco do Brasil", text: "BB: Codigo de seguranca BB 302918 para confirmar operacao" },
      { title: "Santander", text: "Santander: Codigo de autorizacao SMS: 918273" },
      { title: "Inter", text: "Seu codigo 2FA de acesso e 654321" },

      // Agendamentos Futuros
      { title: "Inter", text: "Inter: Seu Pix de R$ 200,00 foi agendado para 20/10" },
      { title: "Itaú", text: "Itau: Agendamento de TED de R$ 500,00 confirmado para amanha" },
      { title: "Caixa", text: "Boleto agendado no valor de R$ 180,00 com sucesso" },
    ];

    falsePositives.forEach(({ title, text }, index) => {
      it(`[Falso Positivo #${index + 1}] descarta "${text.slice(0, 50)}..."`, () => {
        // 1. isBlacklistedNotification deve acusar imediatamente
        expect(isBlacklistedNotification(text, title)).toBe(true);

        // 2. parseBankNotification deve retornar estritamente null
        const parsed = parseBankNotification({
          packageName: "com.nu.production",
          title,
          text,
        });
        expect(parsed).toBeNull();
      });
    });
  });

  describe("3. Compartilhamento de Comprovante Pix (Android Share Target)", () => {
    it("parseia texto bruto de comprovante Pix compartilhado", () => {
      const shareText = `
        Comprovante de Transferência Pix
        Valor: R$ 250,00
        Para: Clinica Medica Bem Estar
        Chave Pix: contato@bemestar.med.br
        Data: 16/10/2026
        Instituição: Banco Nubank S.A.
      `;

      const result = parsePixShareText(shareText);
      expect(result).not.toBeNull();
      expect(result?.amountCents).toBe(25000);
      expect(result?.type).toBe("expense");
      expect(result?.paymentMethod).toBe("pix");
      expect(result?.merchant).toBe("Clinica Medica Bem Estar");
      expect(inferCategoryKeyword(result?.merchant || "")).toBe("saude");
    });
  });
});
