import { describe, expect, it } from "vitest";
import { resolveTierFromPayment } from "../../supabase/functions/_shared/asaas-plans";

describe("resolveTierFromPayment — catálogo determinístico Asaas", () => {
  it("mapeia PIX para plano anual", () => {
    expect(resolveTierFromPayment({ billingType: "PIX", value: 178.8 })).toBe("pro_annual");
    expect(resolveTierFromPayment({ billingType: "PIX", value: 178.8 })).toBe("pro_annual");
  });

  it("mapeia valores do catálogo mensal e anual", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 19.9 })).toBe("pro_monthly");
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 178.8 })).toBe("pro_annual");
  });

  it("rejeita heurística insegura (value > 50 sem casar catálogo)", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 59 })).toBeNull();
    expect(resolveTierFromPayment({ billingType: "BOLETO", value: 100 })).toBeNull();
  });

  it("tolera arredondamento mínimo de float", () => {
    expect(resolveTierFromPayment({ billingType: "CREDIT_CARD", value: 19.90001 })).toBe("pro_monthly");
  });
});
