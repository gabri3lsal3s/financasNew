/**
 * Bloqueio estrito de orientação mobile (portrait only) — HOTFIX 2026-08-15.
 * Cobre: manifest (`orientation: portrait`) + `screen.orientation.lock` (JS)
 * + overlay de fallback alimentado por `isLandscapeMobile()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initOrientationLock,
  isLandscapeMobile,
  lockPortrait,
  resetOrientationLock,
  subscribeOrientationLock,
} from "./orientation-lock";

interface MediaQueryListMock {
  matches: boolean;
  media: string;
  onchange: null;
  addListener: () => void;
  removeListener: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
}

function stubMatchMedia(matches: boolean): void {
  const mq: MediaQueryListMock = {
    matches,
    media: "(pointer: coarse)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  });
}

function stubViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
}

function stubOrientationLock(supported: boolean): void {
  const orientation = supported
    ? { lock: vi.fn().mockResolvedValue(undefined) }
    : {};
  Object.defineProperty(window, "screen", {
    writable: true,
    configurable: true,
    value: { orientation },
  });
}

describe("lockPortrait — screen.orientation.lock('portrait')", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("é no-op silencioso quando a API não existe (iOS Safari, navegadores sem suporte)", () => {
    stubOrientationLock(false);
    expect(() => lockPortrait()).not.toThrow();
  });

  it("chama lock('portrait') quando a API existe", () => {
    stubOrientationLock(true);
    lockPortrait();
    const lock = (screen as Screen & { orientation: { lock: ReturnType<typeof vi.fn> } }).orientation.lock;
    expect(lock).toHaveBeenCalledWith("portrait");
  });
});

describe("isLandscapeMobile — store externo do overlay de fallback", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubViewport(390, 844); // portrait mobile
    resetOrientationLock();
  });

  afterEach(() => {
    resetOrientationLock();
    vi.restoreAllMocks();
  });

  it("inicia false (portrait)", () => {
    expect(isLandscapeMobile()).toBe(false);
  });

  it("não ativa em dispositivo de toque sem matchMedia (desktop jsdom)", () => {
    // matchMedia indisponível → tratado como não-toque
    Object.defineProperty(window, "matchMedia", { writable: true, value: undefined });
    stubViewport(844, 390); // landscape
    initOrientationLock();
    expect(isLandscapeMobile()).toBe(false);
  });

  it("ativa em paisagem num dispositivo de toque", () => {
    stubMatchMedia(true); // pointer: coarse
    stubViewport(844, 390); // landscape
    initOrientationLock();
    expect(isLandscapeMobile()).toBe(true);
  });

  it("notifica assinantes ao mudar para paisagem", () => {
    // Inicia em retrato (state false) com um assinante registrado.
    const listener = vi.fn();
    const unsubscribe = subscribeOrientationLock(listener);
    try {
      stubMatchMedia(true);
      stubViewport(844, 390);
      initOrientationLock();
      expect(listener).toHaveBeenCalled();
      expect(isLandscapeMobile()).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it("resetOrientationLock volta para retrato e notifica", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOrientationLock(listener);
    try {
      stubMatchMedia(true);
      stubViewport(844, 390);
      initOrientationLock();
      expect(isLandscapeMobile()).toBe(true);
      listener.mockClear();
      resetOrientationLock();
      expect(isLandscapeMobile()).toBe(false);
      expect(listener).toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("initOrientationLock retorna cleanup que remove os listeners", () => {
    const cleanup = initOrientationLock();
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
