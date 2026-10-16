import { describe, expect, it } from "vitest";
import { checkPasswordRequirements, getPasswordStrength } from "./password";

describe("Password Validation Domain", () => {
  it("valida requisitos individuais de senha", () => {
    expect(checkPasswordRequirements("abc")).toEqual({
      minLength: false,
      hasUppercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });

    expect(checkPasswordRequirements("Senha123!")).toEqual({
      minLength: true,
      hasUppercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
  });

  it("calcula corretamente a força da senha", () => {
    expect(getPasswordStrength("")).toBe("empty");
    expect(getPasswordStrength("curta")).toBe("weak");
    expect(getPasswordStrength("Senha123")).toBe("medium");
    expect(getPasswordStrength("Senha123!")).toBe("strong");
  });
});
