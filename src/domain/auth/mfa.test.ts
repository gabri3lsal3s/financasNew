import { describe, expect, it } from "vitest";
import {
  formatTotpDisplay,
  hasSufficientAal,
  isMfaEnforcedForRole,
  isValidTotpCode,
} from "./mfa";

describe("MFA / 2FA domain engine (§F47)", () => {
  it("valida código TOTP de 6 dígitos numéricos", () => {
    expect(isValidTotpCode("123456")).toBe(true);
    expect(isValidTotpCode("000000")).toBe(true);
    expect(isValidTotpCode(" 123456 ")).toBe(true);

    expect(isValidTotpCode("12345")).toBe(false);
    expect(isValidTotpCode("1234567")).toBe(false);
    expect(isValidTotpCode("abcdef")).toBe(false);
    expect(isValidTotpCode("12345a")).toBe(false);
    expect(isValidTotpCode("")).toBe(false);
  });

  it("verifica obrigatoriedade de MFA por cargo", () => {
    expect(isMfaEnforcedForRole("superadmin")).toBe(true);
    expect(isMfaEnforcedForRole("admin")).toBe(true);
    expect(isMfaEnforcedForRole("user")).toBe(false);
  });

  it("avalia suficiência de nível de garantia (AAL1 vs AAL2)", () => {
    // Usuário comum sem TOTP
    expect(hasSufficientAal("aal1", false, "user")).toBe(true);
    // Usuário comum com TOTP em AAL1 (pode navegar se não for admin)
    expect(hasSufficientAal("aal1", true, "user")).toBe(true);

    // Admin com TOTP precisa de AAL2
    expect(hasSufficientAal("aal1", true, "admin")).toBe(false);
    expect(hasSufficientAal("aal2", true, "admin")).toBe(true);

    // Superadmin com TOTP precisa de AAL2
    expect(hasSufficientAal("aal1", true, "superadmin")).toBe(false);
    expect(hasSufficientAal("aal2", true, "superadmin")).toBe(true);
  });

  it("formata exibição de código TOTP com espaçamento", () => {
    expect(formatTotpDisplay("123456")).toBe("123 456");
    expect(formatTotpDisplay("12")).toBe("12");
    expect(formatTotpDisplay("123")).toBe("123");
    expect(formatTotpDisplay("1234")).toBe("123 4");
  });
});
