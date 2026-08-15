/**
 * Bloqueio estrito de orientação mobile (portrait only).
 * Cobre: chamada a lockPortrait com fallback seguro, eventos de gesto e ciclo de vida.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initOrientationLock, lockPortrait } from "./orientation-lock";

function stubOrientationLock(supported: boolean, mockLock?: ReturnType<typeof vi.fn>): void {
  const orientation = supported
    ? { lock: mockLock ?? vi.fn().mockResolvedValue(undefined) }
    : {};
  Object.defineProperty(window, "screen", {
    writable: true,
    configurable: true,
    value: { orientation },
  });
}

describe("lockPortrait — screen.orientation.lock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("é no-op silencioso quando a API não existe (iOS Safari, navegadores sem suporte)", () => {
    stubOrientationLock(false);
    expect(() => lockPortrait()).not.toThrow();
  });

  it("chama lock('portrait-primary') quando a API existe", () => {
    const mockLock = vi.fn().mockResolvedValue(undefined);
    stubOrientationLock(true, mockLock);
    lockPortrait();
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");
  });

  it("tenta 'portrait' como fallback se 'portrait-primary' for rejeitado", async () => {
    const mockLock = vi.fn().mockImplementation((target: string) => {
      if (target === "portrait-primary") return Promise.reject(new Error("Not supported"));
      return Promise.resolve();
    });
    stubOrientationLock(true, mockLock);
    lockPortrait();
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");
    // Aguarda microtasks
    await Promise.resolve();
    expect(mockLock).toHaveBeenCalledWith("portrait");
  });

  it("suporta navegadores com prefixos legados (lockOrientation)", () => {
    const mockLegacyLock = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, "screen", {
      writable: true,
      configurable: true,
      value: { lockOrientation: mockLegacyLock },
    });
    lockPortrait();
    expect(mockLegacyLock).toHaveBeenCalledWith("portrait-primary");
  });
});

describe("initOrientationLock — ciclo de vida e ativação por gestos", () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    stubOrientationLock(true);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    vi.restoreAllMocks();
  });

  it("bloqueia orientação no bootstrap", () => {
    const mockLock = vi.fn().mockResolvedValue(undefined);
    stubOrientationLock(true, mockLock);
    cleanup = initOrientationLock();
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");
  });

  it("reaplica o lock em eventos de toque/clique do usuário", () => {
    const mockLock = vi.fn().mockResolvedValue(undefined);
    stubOrientationLock(true, mockLock);
    cleanup = initOrientationLock();
    mockLock.mockClear();

    window.dispatchEvent(new Event("pointerdown"));
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");

    mockLock.mockClear();
    window.dispatchEvent(new Event("touchstart"));
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");

    mockLock.mockClear();
    window.dispatchEvent(new Event("click"));
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");
  });

  it("reaplica o lock ao retornar à visibilidade", () => {
    const mockLock = vi.fn().mockResolvedValue(undefined);
    stubOrientationLock(true, mockLock);
    cleanup = initOrientationLock();
    mockLock.mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockLock).toHaveBeenCalledWith("portrait-primary");
  });

  it("cleanup remove os listeners de eventos", () => {
    const mockLock = vi.fn().mockResolvedValue(undefined);
    stubOrientationLock(true, mockLock);
    cleanup = initOrientationLock();
    mockLock.mockClear();

    cleanup();
    cleanup = null;

    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("click"));
    expect(mockLock).not.toHaveBeenCalled();
  });
});
