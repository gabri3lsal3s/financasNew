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

  it("rejeita transações inválidas ou de falha", () => {
    const failedText = "Pix não realizado. Saldo insuficiente na conta corrente.";
    expect(parsePixReceipt(failedText)).toBeNull();
  });
});
