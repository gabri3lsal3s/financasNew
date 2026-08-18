import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
// Tipos do matcher toHaveNoViolations: ver src/tests/vitest-axe.d.ts.

// Matcher toHaveNoViolations (axe-core) — auditoria a11y (F5.3).
expect.extend(axeMatchers);

// Limpa o DOM entre testes (vitest sem globals não faz cleanup automático).
afterEach(() => {
  cleanup();
});

// --- Polyfills de jsdom exigidos pelo Radix UI em testes ---
if (typeof window.PointerEvent === "undefined") {
  Object.defineProperty(window, "PointerEvent", { value: window.MouseEvent, configurable: true });
}

if (typeof window.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverStub;
}

if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

// Radix Select/popper usam Pointer Capture em interações de clique (jsdom não implementa).
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// Polyfill de matchMedia para testes de temas e media queries no jsdom
if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
