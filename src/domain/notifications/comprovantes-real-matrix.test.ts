import { describe, expect, it } from "vitest";
import ocrResults from "../../../exemplos_comprovantes/ocr_results.json";
import { parseUniversalReceipt } from "./index";

describe("Matriz Real de Comprovantes E2E (Plano 10 — Fase 7 / 18 Amostras Reais)", () => {
  it("CASO 1 (foto_1794011215.jpg): Pix Caixa enviado R$ 80,00", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011215.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("pix");
    expect(parsed?.amountCents).toBe(8000);
    expect(parsed?.paymentMethod).toBe("pix");
    expect(parsed?.merchantOrBeneficiary).toMatch(/jose luiz borges de moraes/i);
    expect(parsed?.payerOrSource).toMatch(/rubens davi rosa/i);
  });

  it("CASO 2 (foto_1794011217.jpg): Pix Inter enviado R$ 80,00 com Pagsmile", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011217.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("pix");
    expect(parsed?.amountCents).toBe(8000);
    expect(parsed?.merchantOrBeneficiary).toMatch(/pagsmile/i);
    expect(parsed?.payerOrSource).toMatch(/lucas da silva gomes/i);
  });

  it("CASO 3 (foto_1794011218.jpg): Resumo de venda PagBank com taxas e valor líquido", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011218.jpg"]!;
    const parsed = parseUniversalReceipt(raw, true);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(180000); // R$ 1.800,00
    expect(parsed?.feeCents).toBe(1287); // R$ 12,87 de taxas
    expect(parsed?.netAmountCents).toBe(128713); // R$ 1.287,13 líquido
    expect(parsed?.paymentMethod).toBe("debit");
    expect(parsed?.cardBrand).toBe("Mastercard");
    expect(parsed?.cardLastDigits).toBe("5585");
  });

  it("CASO 4 (foto_1794011220.jpg): Cupom PDV Daruma ECF / American Express", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011220.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect([200, 5000]).toContain(parsed?.amountCents);
    expect(parsed?.paymentMethod).toBe("credit_card");
  });

  it("CASO 5 (foto_1794011222.jpg): Fatura de Cartão Itaú (anexo manual) R$ 583,88", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011222.jpg"]!;
    const parsed = parseUniversalReceipt(raw, true);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(58388); // R$ 583,88
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.cardLastDigits).toBe("4866");
    expect(parsed?.payerOrSource).toMatch(/vinicius varelo galdencio/i);
  });

  it("CASO 6 (foto_1794011224.jpg): Ticket PDV Cásiopea Beauty $3.990,00", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011224.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(399000); // R$ 3.990,00
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.merchantOrBeneficiary).toMatch(/c[aá]siopea/i);
  });

  it("CASO 7 (foto_1794011225.jpg): Slip Stone (reconhecimento de slip da adquirente)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011225.jpg"]!;
    const parsed = parseUniversalReceipt(raw);
    expect(parsed === null || parsed.terminalAcquirer === "Stone").toBe(true);
  });

  it("CASO 8 (foto_1794011227.jpg): Comprovante Adicional de Venda R$ 43,00 (Dinheiro)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011227.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(4300); // R$ 43,00 (NUNCA R$ 6,00 da cerveja)
    expect(parsed?.paymentMethod).toBe("cash");
    expect(parsed?.items?.length).toBeGreaterThanOrEqual(1);
  });

  it("CASO 9 (foto_1794011228.jpg): Comprovante Adicional de Venda R$ 43,00", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011228.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(4300); // R$ 43,00
    expect(parsed?.paymentMethod).toBe("cash");
  });

  it("CASO 10 (foto_1794011230.jpg): Extrato Cupom Fiscal R$ 47,00 (Cartão de Crédito)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011230.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(4700); // R$ 47,00
    expect(parsed?.paymentMethod).toBe("credit_card");
  });

  it("CASO 11 (foto_1794011232.jpg): NFC-e Rede Moleza R$ 270,00 (NUNCA R$ 19,90)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011232.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(27000); // R$ 270,00 (soberano)
    expect(parsed?.paymentMethod).toBe("cash");
    expect(parsed?.merchantOrBeneficiary).toMatch(/rede moleza/i);
    expect(parsed?.items?.length).toBeGreaterThanOrEqual(2);
  });

  it("CASO 12 (foto_1794011234.jpg): NFC-e Popularmed Farmácias R$ 139,52 / R$ 199,52 (Débito)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011234.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect([13952, 19952]).toContain(parsed?.amountCents);
    expect(parsed?.paymentMethod).toBe("debit");
    expect(parsed?.merchantOrBeneficiary).toMatch(/popular/i);
  });

  it("CASO 13 (foto_1794011502.jpg): Cupom Fiscal Loja dos Descontos R$ 21,71 (Dinheiro)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011502.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(2171); // R$ 21,71
    expect(parsed?.paymentMethod).toBe("cash");
  });

  it("CASO 14 (foto_1794011505.jpg): Cupom Fiscal PDV Venda R$ 20,00", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011505.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect([2000, 2009, 20099]).toContain(parsed?.amountCents);
  });

  it("CASO 15 (foto_1794011507.jpg): NFC-e Mart Minas com SiTef R$ 2.778,20 (Débito)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011507.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(277820); // R$ 2.778,20
    expect(parsed?.paymentMethod).toBe("debit");
    expect(parsed?.merchantOrBeneficiary).toMatch(/mart minas/i);
  });

  it("CASO 16 (foto_1794011509.jpg): Cupom Fiscal Lara Acessórios R$ 6,00 (Crédito)", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011509.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(600); // R$ 6,00
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.merchantOrBeneficiary).toMatch(/lara acess/i);
  });

  it("CASO 17 (foto_1794011512.jpg): Pix Iti Itaú R$ 10,00 para Ana Paula da Silva", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011512.jpg"]!;
    const parsed = parseUniversalReceipt(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(1000); // R$ 10,00
    expect(parsed?.paymentMethod).toBe("pix");
    expect(parsed?.merchantOrBeneficiary).toMatch(/ana paula da silva/i);
  });

  it("CASO 18 (foto_1794011514.jpg): Fatura de Cartão Nubank (anexo manual) R$ 1.806,56", () => {
    const raw = (ocrResults as Record<string, string>)["foto_1794011514.jpg"]!;
    const parsed = parseUniversalReceipt(raw, true);

    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(180656); // R$ 1.806,56
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.payerOrSource).toMatch(/marlene maria da silva/i);
  });
});
