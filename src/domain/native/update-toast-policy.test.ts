import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  UPDATE_DISMISSED_SESSION_KEY,
  dismissUpdateForSession,
  isUpdateDismissedForSession,
  resetUpdateDismissedForSession,
} from "./update-toast-policy";

describe("update-toast-policy — Política e Persistência de Dispensa de Atualização (§4.3)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetUpdateDismissedForSession();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetUpdateDismissedForSession();
  });

  it("retorna falso quando nenhuma dispensa foi gravada", () => {
    expect(isUpdateDismissedForSession()).toBe(false);
  });

  it("grava flag no sessionStorage ao dispensar", () => {
    dismissUpdateForSession();

    expect(sessionStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBe("true");
    expect(isUpdateDismissedForSession()).toBe(true);
  });

  it("reconhece dispensa quando o sessionStorage contém 'true'", () => {
    sessionStorage.setItem(UPDATE_DISMISSED_SESSION_KEY, "true");
    expect(isUpdateDismissedForSession()).toBe(true);
  });

  it("permite reexibição ao iniciar nova sessão (sessionStorage limpo)", () => {
    dismissUpdateForSession();
    expect(isUpdateDismissedForSession()).toBe(true);

    // Simula encerramento e nova inicialização de sessão
    sessionStorage.clear();
    resetUpdateDismissedForSession();
    expect(isUpdateDismissedForSession()).toBe(false);
  });

  it("limpa storage adequadamente com resetUpdateDismissedForSession", () => {
    dismissUpdateForSession();
    expect(isUpdateDismissedForSession()).toBe(true);

    resetUpdateDismissedForSession();
    expect(isUpdateDismissedForSession()).toBe(false);
    expect(sessionStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBeNull();
  });
});
