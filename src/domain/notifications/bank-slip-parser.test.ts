import { describe, expect, it } from "vitest";
import {
  extractBankSlipBeneficiary,
  extractBankSlipDueDate,
  extractDigitableLine,
  isBankSlipReceipt,
  parseBankSlipReceipt,
} from "./bank-slip-parser";

describe("bank-slip-parser — Parser Especializado de Boletos e Tributos (Tarefa 2.4)", () => {
  it("detecta comprovante de boleto com marcadores inequívocos", () => {
    expect(
      isBankSlipReceipt("Comprovante de pagamento de boleto de cobrança"),
    ).toBe(true);
    expect(
      isBankSlipReceipt("Comprovante de Pagamento de Título Santander"),
    ).toBe(true);
    expect(
      isBankSlipReceipt("Comprovante de Pagamento - DARF Receita Federal"),
    ).toBe(true);
    expect(isBankSlipReceipt("Comprovante de transferência Pix")).toBe(false);
  });

  it("extrai linha digitável de boleto bancário Febraban e concessionárias", () => {
    const rawFebraban =
      "Linha digitável: 00190.00009 01234.567802 01234.567802 1 89010000015000";
    expect(extractDigitableLine(rawFebraban)).toContain("00190.00009");

    const rawUtility =
      "Código de barras: 84670000001-4 23450067008-9 12345678901-2 34567890123-4";
    expect(extractDigitableLine(rawUtility)).toContain("84670000001-4");
  });

  it("extrai data de vencimento quando informada no comprovante", () => {
    const raw = "Data de vencimento: 15/11/2026\nData de pagamento: 10/11/2026";
    expect(extractBankSlipDueDate(raw)).toBe("2026-11-15");
  });

  it("extrai beneficiários de tributos federais e concessionárias", () => {
    expect(extractBankSlipBeneficiary("PAGAMENTO DE DARF")).toBe(
      "Receita Federal (DARF)",
    );
    expect(extractBankSlipBeneficiary("GUIA DA PREVIDENCIA SOCIAL - GPS")).toBe(
      "Previdência Social (GPS)",
    );
    expect(
      extractBankSlipBeneficiary("Beneficiário: ENEL DISTRIBUICAO SP"),
    ).toBe("ENEL DISTRIBUICAO SP");
  });

  it("parseia comprovante completo de boleto bancário", () => {
    const raw = `
      Banco Santander (Brasil) S.A.
      Comprovante de Pagamento de Título
      Data do pagamento: 25/10/2026
      Data de vencimento: 28/10/2026
      
      Beneficiário: Condomínio Residencial Parque
      CNPJ: 11.222.333/0001-44
      Pagador: Gabriel Sales
      
      Linha digitável: 03399.12345 67890.123456 78901.234567 1 89010000045000
      Valor do documento: R$ 450,00
      Valor pago: R$ 450,00
    `;

    const parsed = parseBankSlipReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("bank_slip_payment");
    expect(parsed?.nature).toBe("expense");
    expect(parsed?.amountCents).toBe(45000);
    expect(parsed?.date).toBe("2026-10-25");
    expect(parsed?.dueDate).toBe("2026-10-28");
    expect(parsed?.merchantOrBeneficiary).toContain(
      "Condomínio Residencial Parque",
    );
    expect(parsed?.payerOrSource).toBe("Gabriel Sales");
    expect(parsed?.taxId).toBe("11222333000144");
    expect(parsed?.barcodeOrDigitableLine).toContain("03399.12345");
    expect(parsed?.paymentMethod).toBe("other");
  });

  it("parseia comprovante de concessionária de energia elétrica", () => {
    const raw = `
      Banco Bradesco
      Comprovante de Pagamento de Concessionária
      Data: 20/10/2026
      Empresa: ENEL DISTRIBUICAO SP
      Valor: R$ 185,90
      Código de barras: 83670000001-8 23450067008-1 12345678901-2 34567890123-4
    `;

    const parsed = parseBankSlipReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(18590);
    expect(parsed?.merchantOrBeneficiary).toContain("ENEL");
    expect(parsed?.date).toBe("2026-10-20");
  });

  it("rejeita texto sem valor financeiro", () => {
    expect(parseBankSlipReceipt("Boleto bancário emitido")).toBeNull();
  });
});
