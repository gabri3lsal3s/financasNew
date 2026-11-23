import { describe, expect, it } from "vitest";
import {
  extractSovereignReceiptAmountCents,
  scoreSovereignReceiptAmount,
} from "./receipt-amount-scorer";

describe("receipt-amount-scorer (Seleção Soberana de Valor Financeiro)", () => {
  it("prioriza Valor Pago sobre Saldo, Valor do Documento, Desconto, Tarifa e Juros (G5)", () => {
    const raw = `
      Banco do Brasil - Comprovante de Pagamento
      Saldo disponível em conta: R$ 3.500,00
      Limite diário Pix: R$ 2.000,00
      Valor do documento: R$ 100,00
      Desconto concedido: R$ 15,00
      Tarifa bancária: R$ 2,50
      Juros e multa: R$ 0,00
      Valor Pago: R$ 85,00
    `;

    const scored = scoreSovereignReceiptAmount(raw);
    expect(scored).not.toBeNull();
    expect(scored?.amountCents).toBe(8500);
    expect(scored?.confidence).toBe("high");
    expect(scored?.score).toBe(100);
    expect(extractSovereignReceiptAmountCents(raw)).toBe(8500);
  });

  it("retorna null quando todos os valores do texto pertencem a saldos ou limites desqualificados", () => {
    const raw = `
      Extrato Rápido
      Saldo atual: R$ 3.500,00
      Saldo restante após transação: R$ 1.200,00
      Limite disponível: R$ 5.000,00
      Tributos aproximados Lei 12.741: R$ 12,40
    `;

    expect(scoreSovereignReceiptAmount(raw)).toBeNull();
    expect(extractSovereignReceiptAmountCents(raw)).toBeNull();
  });

  it("associa rótulo da linha anterior quando o valor está isolado na linha seguinte", () => {
    const raw = `
      Comprovante Pix
      Desconto
      R$ 15,00
      Valor do Pix
      R$ 245,90
    `;

    expect(extractSovereignReceiptAmountCents(raw)).toBe(24590);
  });

  it("não confunde múltiplos valores na mesma linha e suporta ruído OCR / PDV 3 decimais / en-US", () => {
    expect(
      extractSovereignReceiptAmountCents(
        "Desconto: R$ 15,00 | Valor Pago: R$ 85,00",
      ),
    ).toBe(8500);

    expect(extractSovereignReceiptAmountCents("Valor Pago: R$ 45 , 00")).toBe(4500);
    expect(extractSovereignReceiptAmountCents("Total a Pagar: R$ 45.00")).toBe(4500);
    expect(extractSovereignReceiptAmountCents("Líquido: R$ 43,000")).toBe(4300);
  });

  it("prioriza Valor Total acima de linhas individuais de itens e parcelas isoladas", () => {
    const raw = `
      ITEM 1 CANETA R$ 12,00
      ITEM 2 CADERNO R$ 38,00
      Valor da Parcela: R$ 25,00
      Total a pagar: R$ 50,00
    `;

    const scored = scoreSovereignReceiptAmount(raw);
    expect(scored?.amountCents).toBe(5000);
    expect(scored?.score).toBe(100);
  });
});
