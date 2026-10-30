import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  UPDATE_DISMISSED_SESSION_KEY,
  TWELVE_HOURS_MS,
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

  it("grava flag no sessionStorage e timestamp no localStorage ao dispensar", () => {
    const fixedNow = 1700000000000;
    dismissUpdateForSession(fixedNow);

    expect(sessionStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBe("true");
    expect(localStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBe(String(fixedNow));
    expect(isUpdateDismissedForSession(fixedNow)).toBe(true);
  });

  it("reconhece dispensa quando apenas o sessionStorage contém 'true'", () => {
    sessionStorage.setItem(UPDATE_DISMISSED_SESSION_KEY, "true");
    expect(isUpdateDismissedForSession()).toBe(true);
  });

  it("reconhece dispensa quando localStorage tem timestamp dentro da janela de 12 horas", () => {
    const fixedNow = 1700000000000;
    const sixHoursAgo = fixedNow - 6 * 60 * 60 * 1000;
    localStorage.setItem(UPDATE_DISMISSED_SESSION_KEY, String(sixHoursAgo));

    expect(isUpdateDismissedForSession(fixedNow)).toBe(true);
  });

  it("expira e retorna falso quando o timestamp no localStorage for superior a 12 horas", () => {
    const fixedNow = 1700000000000;
    const thirteenHoursAgo = fixedNow - (TWELVE_HOURS_MS + 1000);
    localStorage.setItem(UPDATE_DISMISSED_SESSION_KEY, String(thirteenHoursAgo));

    expect(isUpdateDismissedForSession(fixedNow)).toBe(false);
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
