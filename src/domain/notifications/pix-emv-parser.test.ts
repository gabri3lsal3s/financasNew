import { describe, expect, it } from "vitest";
import {
  parseEMVAmountToCents,
  parseEMVTLV,
  parsePixEMVPayload,
} from "./pix-emv-parser";

describe("pix-emv-parser — Decodificador de Pix Copia e Cola (EMVCo / BR Code)", () => {
  it("converte valores em string da tag 54 para centavos corretamente", () => {
    expect(parseEMVAmountToCents("10.00")).toBe(1000);
    expect(parseEMVAmountToCents("150.50")).toBe(15050);
    expect(parseEMVAmountToCents("5.5")).toBe(550);
    expect(parseEMVAmountToCents("1234")).toBe(123400);
    expect(parseEMVAmountToCents("")).toBeNull();
    expect(parseEMVAmountToCents("abc")).toBeNull();
  });

  it("deserializa tags EMV TLV corretamente", () => {
    const sample = "00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540545.905802BR5915PADARIA ESTRELA6009SAO PAULO62070503***6304ABCD";
    const tags = parseEMVTLV(sample);

    expect(tags["00"]).toBe("01");
    expect(tags["53"]).toBe("986");
    expect(tags["54"]).toBe("45.90");
    expect(tags["58"]).toBe("BR");
    expect(tags["59"]).toBe("PADARIA ESTRELA");
    expect(tags["60"]).toBe("SAO PAULO");
  });

  it("decodifica payload Pix completo extraindo valor, favorecido e inferindo categoria", () => {
    const payload = "00020126360014br.gov.bcb.pix0114+55119999999995204000053039865406120.005802BR5920SUPERMERCADO ALIANCA6009SAO PAULO6304ABCD";

    const result = parsePixEMVPayload(payload);

    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(12000);
    expect(result?.merchant).toBe("SUPERMERCADO ALIANCA");
    expect(result?.description).toBe("Pix: SUPERMERCADO ALIANCA");
    expect(result?.paymentMethod).toBe("pix");
    expect(result?.nature).toBe("expense");
    expect(result?.categorySlug).toBe("mercado");
  });

  it("retorna null para textos genéricos que não são códigos Pix", () => {
    expect(parsePixEMVPayload("Bom dia, segue o comprovante de pagamento")).toBeNull();
    expect(parsePixEMVPayload("")).toBeNull();
  });
});
