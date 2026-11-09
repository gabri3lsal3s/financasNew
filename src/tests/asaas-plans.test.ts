import { describe, expect, it } from "vitest";
import { resolveTierFromPayment } from "../../supabase/functions/_shared/asaas-plans";

describe("resolveTierFromPayment — catálogo determinístico Asaas", () => {
  it("mapeia PIX exclusivamente quando o valor casa com o plano anual", () => {
    expect(resolveTierFromPayment({ billingType: "PIX", value: 143.88 })).toBe("pro_annual");
    expect(resolveTierFromPayment({ billingType: "PIX", value: "143.88" })).toBe("pro_annual");
  });

  it("rejeita PIX com valor nulo, indefinido, NaN ou incorreto (anti-bypass)", () => {
    expect(resolveTierFromPayment({ billingType: "PIX" })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: null })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: undefined })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: NaN })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: "invalido" })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: 1.0 })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "PIX", value: 19.99 })).toBeNull();
  });

  it("mapeia valores do catálogo mensal e anual", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 19.99 })).toBe("pro_monthly");
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 143.88 })).toBe("pro_annual");
  });

  it("rejeita heurística insegura (value > 50 sem casar catálogo)", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 59 })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "BOLETO", value: 100 })).toBeNull();
  });

  it("tolera arredondamento mínimo de float", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 19.99001 })).toBe("pro_monthly");
  });
});
