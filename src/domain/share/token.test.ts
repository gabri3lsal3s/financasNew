import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_TOKEN_LENGTH,
  generateShareToken,
  isValidShareToken,
  MAX_SHARE_TOKEN_LENGTH,
  MIN_SHARE_TOKEN_LENGTH,
  sanitizeShareToken,
} from "./token";

describe("generateShareToken", () => {
  it("gera token com tamanho padrao de 10 caracteres", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(DEFAULT_SHARE_TOKEN_LENGTH);
    expect(isValidShareToken(token)).toBe(true);
  });

  it("gera token com comprimento customizado valido", () => {
    const token8 = generateShareToken(8);
    expect(token8).toHaveLength(8);

    const token16 = generateShareToken(16);
    expect(token16).toHaveLength(16);

    const tokenMax = generateShareToken(MAX_SHARE_TOKEN_LENGTH);
    expect(tokenMax).toHaveLength(MAX_SHARE_TOKEN_LENGTH);
  });

  it("lanca erro quando o comprimento e menor que o minimo ou maior que o maximo", () => {
    expect(() => generateShareToken(MIN_SHARE_TOKEN_LENGTH - 1)).toThrow();
    expect(() => generateShareToken(MAX_SHARE_TOKEN_LENGTH + 1)).toThrow();
    expect(() => generateShareToken(NaN)).toThrow();
    expect(() => generateShareToken(10.5)).toThrow();
  });

  it("gera tokens unicos e sem colisao em lote", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const token = generateShareToken();
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
    expect(tokens.size).toBe(200);
  });

  it("contem apenas caracteres seguros para URL", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateShareToken();
      expect(token).toMatch(/^[2-9a-km-zA-HJ-NP-Z]+$/);
    }
  });
});

describe("isValidShareToken", () => {
  it("valida tokens validos", () => {
    expect(isValidShareToken("abcde12345")).toBe(true);
    expect(isValidShareToken("token-valido_123")).toBe(true);
    expect(isValidShareToken(generateShareToken())).toBe(true);
  });

  it("rejeita entradas invalidas", () => {
    expect(isValidShareToken(null)).toBe(false);
    expect(isValidShareToken(undefined)).toBe(false);
    expect(isValidShareToken(1234567890)).toBe(false);
    expect(isValidShareToken({})).toBe(false);
    expect(isValidShareToken("")).toBe(false);
    expect(isValidShareToken("12345")).toBe(false); // < 6
    expect(isValidShareToken("a".repeat(65))).toBe(false); // > 64
    expect(isValidShareToken("token com espaco")).toBe(false);
    expect(isValidShareToken("token!@#$")).toBe(false);
  });
});

describe("sanitizeShareToken", () => {
  it("preserva tokens validos intactos", () => {
    expect(sanitizeShareToken("5nLtbjCtrj")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("tok-valido_123")).toBe("tok-valido_123");
  });

  it("remove pontuacao acidental colada pelo WhatsApp/Telegram", () => {
    expect(sanitizeShareToken("5nLtbjCtrj.")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj,")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj;")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj:")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj!")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj...")).toBe("5nLtbjCtrj");
  });

  it("remove barras acidentais de URL", () => {
    expect(sanitizeShareToken("/5nLtbjCtrj/")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj/")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("///5nLtbjCtrj///")).toBe("5nLtbjCtrj");
  });

  it("remove query strings e hashes anexados ao token", () => {
    expect(sanitizeShareToken("5nLtbjCtrj?source=whatsapp")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj#section")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("5nLtbjCtrj?foo=bar#hash")).toBe("5nLtbjCtrj");
  });

  it("trata espacos ao redor e caracteres espurios", () => {
    expect(sanitizeShareToken("  5nLtbjCtrj  ")).toBe("5nLtbjCtrj");
    expect(sanitizeShareToken("  5nLtbjCtrj.\n")).toBe("5nLtbjCtrj");
  });

  it("retorna string vazia para entradas invalidas ou insuficientes", () => {
    expect(sanitizeShareToken(null)).toBe("");
    expect(sanitizeShareToken(undefined)).toBe("");
    expect(sanitizeShareToken("")).toBe("");
    expect(sanitizeShareToken("12345")).toBe(""); // < 6 caracteres
    expect(sanitizeShareToken("   ")).toBe("");
  });
});
