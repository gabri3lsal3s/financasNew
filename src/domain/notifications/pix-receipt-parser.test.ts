import { describe, expect, it } from "vitest";
import {
  extractPixEndToEndId,
  extractPixKey,
  isPixReceipt,
  parsePixReceipt,
} from "./pix-receipt-parser";

describe("pix-receipt-parser — Parser Especializado de Comprovantes Pix (Tarefa 2.4)", () => {
  it("detecta comprovante Pix com marcadores explícitos", () => {
    expect(isPixReceipt("Comprovante de transferência Pix Nubank")).toBe(true);
    expect(isPixReceipt("Comprovante de pagamento via Pix Inter")).toBe(true);
    expect(isPixReceipt("Comprovante de agendamento Pix")).toBe(true);
    expect(isPixReceipt("Extrato bancário comum")).toBe(false);
  });

  it("extrai chave Pix de email, telefone, CPF e chave aleatória UUID", () => {
    expect(extractPixKey("Chave Pix: financeiro@empresa.com.br")).toBe(
      "financeiro@empresa.com.br",
    );
    expect(
      extractPixKey("Chave: a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(extractPixKey("Sem chave")).toBeUndefined();
  });

  it("extrai EndToEndId no padrão oficial do Banco Central", () => {
    const text = "ID da transação: E00416968202610251830s8f7e6d5c4b";
    expect(extractPixEndToEndId(text)).toBe("E00416968202610251830s8f7e6d5c4b");
  });

  it("faz o parsing de comprovante Pix de saída (despesa) com todos os campos", () => {
    const raw = `
      Nubank
      Comprovante de transferência Pix
      Valor: R$ 150,00
      Data da transferência: 25/10/2026
      
      Destino:
      Nome: Padaria Central LTDA
      CNPJ: 12.345.678/0001-90
      Instituição: Itaú Unibanco S.A.
      Chave Pix: 12345678000190
      
      Origem:
      Nome: Gabriel Sales
      CPF: ***.123.456-**
      ID da transação: E18236120202610251830a1b2c3d4e5f
    `;

    const parsed = parsePixReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("pix");
    expect(parsed?.nature).toBe("expense");
    expect(parsed?.amountCents).toBe(15000);
    expect(parsed?.date).toBe("2026-10-25");
    expect(parsed?.merchantOrBeneficiary).toContain("Padaria Central");
    expect(parsed?.payerOrSource).toBe("Gabriel Sales");
    expect(parsed?.taxId).toBe("12345678000190");
    expect(parsed?.pixKey).toBe("12345678000190");
    expect(parsed?.txId).toBe("E18236120202610251830a1b2c3d4e5f");
    expect(parsed?.paymentMethod).toBe("pix");
  });

  it("faz o parsing de comprovante Pix de entrada (renda / recebido)", () => {
    const raw = `
      Banco Inter
      Pix Recebido
      Valor: R$ 1.250,00
      Data: 25/10/2026
      
      Quem te enviou
      Nome: Carlos Alberto Silva
      CPF: ***.987.654-**
      Instituição de Origem: Banco Bradesco S.A.

      Dados de quem recebeu
      Nome: Gabriel Sales
    `;

    const parsed = parsePixReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("pix");
    expect(parsed?.nature).toBe("income");
    expect(parsed?.amountCents).toBe(125000);
    expect(parsed?.date).toBe("2026-10-25");
    expect(parsed?.description).toContain("Carlos Alberto Silva");
    expect(parsed?.payerOrSource).toBe("Carlos Alberto Silva");
  });

  it("identifica Pix Agendado com data de liquidação futura", () => {
    const raw = `
      Itaú Unibanco
      Comprovante de Agendamento Pix
      Valor: R$ 320,00
      Data do débito: 05/11/2026
      
      Favorecido: Companhia de Saneamento
      CNPJ: 01.234.567/0001-89
    `;

    const parsed = parsePixReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.isScheduled).toBe(true);
    expect(parsed?.scheduledFor).toBe("2026-11-05");
    expect(parsed?.date).toBe("2026-11-05");
    expect(parsed?.description).toContain("Pix Agendado");
    expect(parsed?.merchantOrBeneficiary).toContain("Companhia de Saneamento");
  });

  describe("Matriz Universal de Comprovantes Pix dos 11 Bancos (Tarefa 7.1)", () => {
    it("parseia comprovante Pix Bradesco com dados do favorecido e instituição destinatária", () => {
      const raw = `
        Banco Bradesco S.A.
        Comprovante de Transação Pix
        Valor: R$ 250,00
        Data: 14/05/2026 10:15:32
        
        Dados do Favorecido:
        Nome: AUTO POSTO BRASIL LTDA
        CNPJ: 11.222.333/0001-44
        Instituição: Banco Santander (Brasil) S.A.
        Chave Pix: autoposto@brasil.com.br
        
        ID da transação: E60746948202605141015abc123def45
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(25000);
      expect(parsed?.merchantOrBeneficiary).toContain("AUTO POSTO");
      expect(parsed?.taxId).toBe("11222333000144");
      expect(parsed?.destinationBank).toBe("Santander");
      expect(parsed?.pixKey).toBe("autoposto@brasil.com.br");
      expect(parsed?.txId).toBe("E60746948202605141015abc123def45");
    });

    it("parseia comprovante Pix Santander com instituição destinatária e chave telefone", () => {
      const raw = `
        Santander
        Comprovante de Pix
        Valor transferido: R$ 78,50
        Data e hora: 18/06/2026 - 16:40:00
        
        Destinatário:
        Nome: CLINICA MEDICA POPULAR
        CNPJ: 22.333.444/0001-55
        Instituição destinatária: Banco Inter S.A.
        Chave vinculada: +5511998877665
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(7850);
      expect(parsed?.merchantOrBeneficiary).toContain("CLINICA MEDICA POPULAR");
      expect(parsed?.destinationBank).toBe("Inter");
      expect(parsed?.pixKey).toBe("+5511998877665");
    });

    it("parseia comprovante Pix Banco do Brasil", () => {
      const raw = `
        Banco do Brasil
        Comprovante Pix
        Valor: R$ 500,00
        Data: 20/07/2026
        
        Beneficiário:
        Nome: JOAO DA SILVA
        CPF: ***.456.789-**
        Banco destinatário: Caixa Econômica Federal
        Chave: joao.silva@email.com
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(50000);
      expect(parsed?.merchantOrBeneficiary).toBe("JOAO DA SILVA");
      expect(parsed?.destinationBank).toBe("Caixa");
      expect(parsed?.pixKey).toBe("joao.silva@email.com");
    });

    it("parseia comprovante Pix Caixa Econômica Federal", () => {
      const raw = `
        Caixa Econômica Federal
        Comprovante de Envio Pix
        Valor da operação: R$ 130,00
        Data: 02/08/2026
        
        Recebedor:
        Nome: MERCADINHO DO BAIRRO
        CNPJ: 33.444.555/0001-66
        Instituição: Nu Pagamentos S.A.
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(13000);
      expect(parsed?.merchantOrBeneficiary).toContain("MERCADINHO DO BAIRRO");
      expect(parsed?.destinationBank).toBe("Nubank");
    });

    it("parseia comprovante Pix BTG Pactual", () => {
      const raw = `
        BTG Pactual
        Comprovante Pix BTG
        Valor debitado: R$ 1.500,00
        Data da efetivação: 15/09/2026
        
        Dados do beneficiário:
        Nome: ESCOLA INFANTIL APRENDER
        CNPJ: 44.555.666/0001-77
        Instituição: Itaú Unibanco S.A.
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(150000);
      expect(parsed?.merchantOrBeneficiary).toContain("ESCOLA INFANTIL APRENDER");
      expect(parsed?.destinationBank).toBe("Itaú");
    });

    it("parseia comprovante Pix Mercado Pago", () => {
      const raw = `
        Mercado Pago
        Comprovante de Transferência Pix
        Valor: R$ 45,00
        Data: 05/10/2026
        
        Recebedor:
        Nome: RESTAURANTE SABOR BRASIL
        Instituição Financeira: Nu Pagamentos S.A.
        Chave Pix: saborbrasil@gmail.com
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(4500);
      expect(parsed?.merchantOrBeneficiary).toContain("RESTAURANTE SABOR");
      expect(parsed?.destinationBank).toBe("Nubank");
      expect(parsed?.pixKey).toBe("saborbrasil@gmail.com");
    });

    it("parseia comprovante Pix PicPay", () => {
      const raw = `
        PicPay
        Comprovante de Pagamento Pix PicPay
        Valor pago: R$ 62,00
        Data: 22/10/2026
        
        Para:
        Nome: DROGARIA SAO PAULO
        CNPJ: 61.412.110/0001-55
        Instituição de destino: Banco Bradesco S.A.
        ID da transação: E22896431202610221945xyz789abc12
      `;
      const parsed = parsePixReceipt(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.amountCents).toBe(6200);
      expect(parsed?.merchantOrBeneficiary).toContain("DROGARIA SAO PAULO");
      expect(parsed?.destinationBank).toBe("Bradesco");
      expect(parsed?.txId).toBe("E22896431202610221945xyz789abc12");
    });
  });

  it("rejeita transações inválidas ou de falha", () => {
    const failedText = "Pix não realizado. Saldo insuficiente na conta corrente.";
    expect(parsePixReceipt(failedText)).toBeNull();
  });
});
