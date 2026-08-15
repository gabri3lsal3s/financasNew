/**
 * OrientationLockOverlay — fallback visual do bloqueio portrait only (HOTFIX).
 * Só renderiza quando `isLandscapeMobile()`; fora disso retorna null.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrientationLockOverlay } from "./orientation-lock-overlay";
import { initOrientationLock, resetOrientationLock } from "@/services/orientation-lock";

function stubMatchMedia(matches: boolean): void {
  const mq = {
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

let cleanup: (() => void) | null = null;

beforeEach(() => {
  stubMatchMedia(false);
  stubViewport(390, 844); // portrait mobile
  resetOrientationLock();
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  resetOrientationLock();
  vi.restoreAllMocks();
});

describe("OrientationLockOverlay (portrait only — HOTFIX)", () => {
  it("retorna null em retrato (mobile)", () => {
    cleanup = initOrientationLock();
    const { container } = render(<OrientationLockOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("retorna null em desktop/tablet sem pointer coarse", () => {
    stubMatchMedia(false);
    stubViewport(1280, 800); // landscape, mas não é touch
    cleanup = initOrientationLock();
    const { container } = render(<OrientationLockOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a tela 'Gire o dispositivo' em paisagem mobile", () => {
    stubMatchMedia(true);
    stubViewport(844, 390); // landscape + touch
    cleanup = initOrientationLock();
    render(<OrientationLockOverlay />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Gire o dispositivo")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade (axe)", async () => {
    stubMatchMedia(true);
    stubViewport(844, 390);
    cleanup = initOrientationLock();
    const { container } = render(<OrientationLockOverlay />);
    const { axe } = await import("vitest-axe");
    expect(await axe(container)).toHaveNoViolations();
  });
});
