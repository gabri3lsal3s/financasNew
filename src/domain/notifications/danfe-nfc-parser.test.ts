import { describe, expect, it } from "vitest";
import {
  detectDanfePaymentMethod,
  extractDanfeAccessKey,
  isDanfeNfcReceipt,
  parseDanfeNfcReceipt,
} from "./danfe-nfc-parser";

describe("danfe-nfc-parser — Parser Especializado de Cupons Fiscais (NFC-e / SAT) (Tarefa 2.4)", () => {
  it("detecta cupom fiscal NFC-e e Extrato SAT com marcadores característicos", () => {
    expect(
      isDanfeNfcReceipt(
        "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica",
      ),
    ).toBe(true);
    expect(isDanfeNfcReceipt("Extrato SAT CF-e Cupom Fiscal Eletrônico")).toBe(
      true,
    );
    expect(isDanfeNfcReceipt("Comprovante de transferência Pix")).toBe(false);
  });

  it("extrai chave de acesso de 44 dígitos mesmo espaçada", () => {
    const raw =
      "CHAVE DE ACESSO: 3526 1047 5084 1100 0156 6500 1000 0123 4510 0987 6543";
    expect(extractDanfeAccessKey(raw)).toBe(
      "35261047508411000156650010000123451009876543",
    );
  });

  it("detecta forma de pagamento a partir do texto do cupom", () => {
    expect(detectDanfePaymentMethod("FORMA DE PAGAMENTO: CARTAO DE CREDITO")).toBe(
      "credit_card",
    );
    expect(detectDanfePaymentMethod("PAGAMENTO: DEBITO")).toBe("debit");
    expect(detectDanfePaymentMethod("PAGO EM DINHEIRO")).toBe("cash");
    expect(detectDanfePaymentMethod("PAGAMENTO VIA PIX")).toBe("pix");
  });

  it("parseia cupom fiscal eletrônico completo", () => {
    const raw = `
      SUPERMERCADOS BH LTDA
      CNPJ: 04.641.376/0001-36
      DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      
      QTD TOTAL DE ITENS: 12
      VALOR TOTAL R$ 248,90
      VALOR A PAGAR R$ 248,90
      FORMA DE PAGAMENTO: CARTAO DE CREDITO
      
      EMISSAO: 24/10/2026 18:30:00
      CHAVE DE ACESSO:
      3126 1004 6413 7600 0136 6500 1000 0543 2110 0123 4567
    `;

    const parsed = parseDanfeNfcReceipt(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("invoice_danfe");
    expect(parsed?.nature).toBe("expense");
    expect(parsed?.amountCents).toBe(24890);
    expect(parsed?.paymentMethod).toBe("credit_card");
    expect(parsed?.date).toBe("2026-10-24");
    expect(parsed?.merchantOrBeneficiary).toContain("SUPERMERCADOS BH");
    expect(parsed?.taxId).toBe("04641376000136");
    expect(parsed?.nfeAccessKey).toBe(
      "31261004641376000136650010000543211001234567",
    );
  });

  it("rejeita texto sem valor financeiro", () => {
    expect(parseDanfeNfcReceipt("DANFE NFC-e Emitida")).toBeNull();
  });
});
