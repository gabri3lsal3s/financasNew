import { describe, it, expect, beforeEach } from "vitest";
import {
  getActiveUserId,
  setActiveUserId,
  subscribeActiveUserId,
  getUserStorageKey,
  getUserStorageItem,
  setUserStorageItem,
  removeUserStorageItem,
  sanitizeLegacyStorage,
} from "./user-storage";

describe("user-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveUserId(null);
  });

  it("gera chaves com namespace do usuário ativo ou guest", () => {
    expect(getActiveUserId()).toBeNull();
    expect(getUserStorageKey("theme")).toBe("financas_guest_theme");

    setActiveUserId("user-123");
    expect(getActiveUserId()).toBe("user-123");
    expect(getUserStorageKey("theme")).toBe("financas_user-123_theme");

    expect(getUserStorageKey("theme", "user-456")).toBe("financas_user-456_theme");
    expect(getUserStorageKey("theme", null)).toBe("financas_guest_theme");
  });

  it("grava e lê itens associados ao usuário ativo", () => {
    setActiveUserId("user-a");
    setUserStorageItem("theme", "dark");
    expect(getUserStorageItem("theme")).toBe("dark");
    expect(window.localStorage.getItem("financas_user-a_theme")).toBe("dark");

    // Muda para usuário B -> não deve ver a configuração do usuário A
    setActiveUserId("user-b");
    expect(getUserStorageItem("theme")).toBeNull();

    setUserStorageItem("theme", "light");
    expect(getUserStorageItem("theme")).toBe("light");
    expect(window.localStorage.getItem("financas_user-b_theme")).toBe("light");
  });

  it("remove itens isolados por usuário", () => {
    setActiveUserId("user-1");
    setUserStorageItem("density", "compact");
    expect(getUserStorageItem("density")).toBe("compact");

    removeUserStorageItem("density");
    expect(getUserStorageItem("density")).toBeNull();
  });

  it("notifica assinantes quando o usuário ativo muda", () => {
    let notifiedUser: string | null = null;
    const unsub = subscribeActiveUserId((uid) => {
      notifiedUser = uid;
    });

    setActiveUserId("user-xyz");
    expect(notifiedUser).toBe("user-xyz");

    setActiveUserId(null);
    expect(notifiedUser).toBeNull();

    unsub();
  });

  it("limpa chaves legadas e despadronizadas sem namespace", () => {
    window.localStorage.setItem("financas:theme", "dark");
    window.localStorage.setItem("financas_density", "compact");
    window.localStorage.setItem("financas_accent_theme", "rose");
    window.localStorage.setItem("financas_user-keep_theme", "oled");

    sanitizeLegacyStorage();

    expect(window.localStorage.getItem("financas:theme")).toBeNull();
    expect(window.localStorage.getItem("financas_density")).toBeNull();
    expect(window.localStorage.getItem("financas_accent_theme")).toBeNull();
    // Chave com namespace de usuário não é apagada
    expect(window.localStorage.getItem("financas_user-keep_theme")).toBe("oled");
  });
});
