import { beforeEach, describe, expect, it, vi } from "vitest";

describe("session-policy — modo computador compartilhado", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  it("mantem modo compartilhado em memoria mesmo se sessionStorage falhar no setItem", async () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });

    const { isSharedDeviceSession, setSharedDeviceSession, getEffectiveIdleLogoutPolicy } = await import(
      "./session-policy"
    );

    setSharedDeviceSession(true);
    expect(isSharedDeviceSession()).toBe(true);
    expect(getEffectiveIdleLogoutPolicy()).toBe("30m");

    setSpy.mockRestore();
    getSpy.mockRestore();
  });

  it("assume modo efemero (fail-closed) no cold start se sessionStorage lancar SecurityError", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    const { isSharedDeviceSession } = await import("./session-policy");
    expect(isSharedDeviceSession()).toBe(true);

    getSpy.mockRestore();
  });
});
