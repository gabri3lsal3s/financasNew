import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SPLIT_PREFERENCES,
  getStoredSplitPreferences,
  storeSplitPreferences,
} from "./split-preferences";

vi.mock("@/data/repositories/user-preferences", () => ({
  updateCustomSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("split-preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna as preferências padrão quando nada estiver salvo", () => {
    const prefs = getStoredSplitPreferences("test-user");
    expect(prefs).toEqual(DEFAULT_SPLIT_PREFERENCES);
    expect(prefs.merchantCity).toBe("");
    expect(prefs.defaultPeopleCount).toBe(2);
  });

  it("salva e recupera as preferências com sanitização correta incluindo cidades com nomes grandes", () => {
    storeSplitPreferences(
      {
        pixKey: "usuario@teste.com",
        pixKeyType: "email",
        merchantName: "Gabriel",
        merchantCity: "Nossa Senhora da Glória",
        remainderPolicy: "balanced",
        defaultPeopleCount: 4,
      },
      "test-user",
    );

    const updated = getStoredSplitPreferences("test-user");
    expect(updated.pixKey).toBe("usuario@teste.com");
    expect(updated.pixKeyType).toBe("email");
    expect(updated.merchantName).toBe("Gabriel");
    expect(updated.merchantCity).toBe("NOSSA SENHORA DA GLÓRIA");
    expect(updated.remainderPolicy).toBe("balanced");
    expect(updated.defaultPeopleCount).toBe(4);
  });

  it("garante fallback seguro para cidade vazia ou contagem inválida", () => {
    storeSplitPreferences(
      {
        merchantCity: "   ",
        defaultPeopleCount: 1, // menor que 2
      },
      "test-user",
    );

    const updated = getStoredSplitPreferences("test-user");
    expect(updated.merchantCity).toBe("");
    expect(updated.defaultPeopleCount).toBe(2);
  });
});
