import { beforeEach, describe, expect, it } from "vitest";
import {
  buildReferralLink,
  clearStoredReferralCode,
  getStoredReferralCode,
  sanitizeReferralCode,
  storeReferralCode,
} from "./referral";

describe("referral service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sanitiza códigos de parceiros em uppercase sem caracteres especiais", () => {
    expect(sanitizeReferralCode(" axis-promo ")).toBe("AXIS-PROMO");
    expect(sanitizeReferralCode("gabriel#30%")).toBe("GABRIEL30");
  });

  it("armazena e recupera código de indicação do localStorage", () => {
    storeReferralCode("AXIS-TESTE");
    expect(getStoredReferralCode()).toBe("AXIS-TESTE");
  });

  it("limpa o código de indicação armazenado", () => {
    storeReferralCode("AXIS-TESTE");
    clearStoredReferralCode();
    expect(getStoredReferralCode()).toBeNull();
  });

  it("monta o link de cadastro com parâmetro ref", () => {
    const link = buildReferralLink("AXIS-1234");
    expect(link).toContain("/cadastrar?ref=AXIS-1234");
  });
});
