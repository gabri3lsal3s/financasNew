import { afterEach, describe, expect, it, vi } from "vitest";
import { isHapticsSupported, triggerHaptic } from "./haptics";

const vibrateMock = vi.fn();

function stubVibrate(): void {
  Object.defineProperty(navigator, "vibrate", {
    value: vibrateMock,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe("haptics (F8 — Decisão 3)", () => {
  it("retorna false sem suporte a navigator.vibrate (jsdom/desktop)", () => {
    expect(isHapticsSupported()).toBe(false);
    expect(triggerHaptic("light")).toBe(false);
  });

  it("dispara o padrão correto quando suportado", () => {
    vibrateMock.mockReturnValue(true);
    stubVibrate();
    expect(isHapticsSupported()).toBe(true);

    expect(triggerHaptic("light")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith(8);

    expect(triggerHaptic("success")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([12, 40, 24]);
  });

  it("nunca lança se navigator.vibrate falhar", () => {
    vibrateMock.mockImplementation(() => {
      throw new Error("NotAllowedError");
    });
    stubVibrate();

    expect(() => triggerHaptic("warning")).not.toThrow();
    expect(triggerHaptic("warning")).toBe(false);
  });
});
