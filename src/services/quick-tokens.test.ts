import { describe, expect, it } from "vitest";
import {
  computeTokenHash,
  generateNewQuickToken,
  getQuickExpenseWebhookUrl,
} from "./quick-tokens";

describe("quick-tokens service", () => {
  it("gera token com prefixo axq_ e tamanho adequado", async () => {
    const { rawToken, tokenHash, tokenPrefix } = await generateNewQuickToken();

    expect(rawToken.startsWith("axq_")).toBe(true);
    expect(rawToken.length).toBe(52); // "axq_" (4) + 48 hex
    expect(tokenHash.length).toBe(64); // SHA-256 hex é 64 chars
    expect(tokenPrefix.startsWith("axq_")).toBe(true);
    expect(tokenPrefix.includes("…")).toBe(true);
  });

  it("calcula hash SHA-256 de forma determinística", async () => {
    const token = "axq_test_token_1234567890abcdef";
    const hash1 = await computeTokenHash(token);
    const hash2 = await computeTokenHash(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("retorna URL válida para o webhook", () => {
    const url = getQuickExpenseWebhookUrl();
    expect(url.includes("/functions/v1/quick-expense")).toBe(true);
  });
});
