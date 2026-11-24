import { describe, expect, it } from "vitest";
import {
  cleanCep,
  cleanPhoneBR,
  formatCep,
  formatPhoneBR,
  isValidCep,
  isValidPhoneBR,
} from "./contact";

describe("services/masks/contact — Telefone BR e CEP", () => {
  describe("Telefone BR", () => {
    it("cleanPhoneBR remove não-dígitos e limita a 11 dígitos", () => {
      expect(cleanPhoneBR("(11) 98765-432199")).toBe("11987654321");
      expect(cleanPhoneBR(null)).toBe("");
      expect(cleanPhoneBR("")).toBe("");
    });

    it("formatPhoneBR formata fixo (10 dígitos) e celular (11 dígitos)", () => {
      expect(formatPhoneBR("")).toBe("");
      expect(formatPhoneBR("11")).toBe("11");
      expect(formatPhoneBR("113265")).toBe("(11) 3265");
      expect(formatPhoneBR("1132654321")).toBe("(11) 3265-4321");
      expect(formatPhoneBR("11987654321")).toBe("(11) 98765-4321");
    });

    it("isValidPhoneBR valida tamanho, DDD e rejeita dígitos repetidos", () => {
      expect(isValidPhoneBR("(11) 98765-4321")).toBe(true);
      expect(isValidPhoneBR("(11) 3265-4321")).toBe(true);
      expect(isValidPhoneBR("(10) 98765-4321")).toBe(false);
      expect(isValidPhoneBR("(00) 98765-4321")).toBe(false);
      expect(isValidPhoneBR("11111111111")).toBe(false);
      expect(isValidPhoneBR("119876543")).toBe(false);
      expect(isValidPhoneBR("")).toBe(false);
    });
  });

  describe("CEP", () => {
    it("cleanCep remove não-dígitos e limita a 8 dígitos", () => {
      expect(cleanCep("01310-10099")).toBe("01310100");
      expect(cleanCep(undefined)).toBe("");
    });

    it("formatCep formata corretamente com hífen após o 5º dígito", () => {
      expect(formatCep("")).toBe("");
      expect(formatCep("01310")).toBe("01310");
      expect(formatCep("01310100")).toBe("01310-100");
    });

    it("isValidCep exige 8 dígitos e rejeita sequências idênticas", () => {
      expect(isValidCep("01310-100")).toBe(true);
      expect(isValidCep("01310100")).toBe(true);
      expect(isValidCep("00000-000")).toBe(false);
      expect(isValidCep("11111111")).toBe(false);
      expect(isValidCep("0131010")).toBe(false);
      expect(isValidCep("")).toBe(false);
    });
  });
});
