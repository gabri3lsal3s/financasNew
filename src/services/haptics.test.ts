import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import { isHapticsSupported, triggerHaptic, hapticsManager, HapticsManager } from "./haptics";

const vibrateMock = vi.fn();

function stubVibrate(): void {
  Object.defineProperty(navigator, "vibrate", {
    value: vibrateMock,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vibrateMock.mockReset();
  hapticsManager.reset();
  hapticsManager.unmute();
  updateVisualCustomization({ hapticEnabled: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe("haptics (F8 — Decisão 3)", () => {
  it("retorna false sem suporte a navigator.vibrate (jsdom/desktop)", () => {
    expect(isHapticsSupported()).toBe(false);
    expect(triggerHaptic("light")).toBe(false);
  });

  it("retorna true e dispara nativamente quando em plataforma nativa", async () => {
    const nativeModule = await import("./native");
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    const nativeSpy = vi.spyOn(nativeModule, "triggerNativeHaptic").mockResolvedValue(true);

    expect(isHapticsSupported()).toBe(true);
    expect(triggerHaptic("light", true)).toBe(true);
    expect(nativeSpy).toHaveBeenCalledWith("light");
  });

  it("dispara o padrão correto quando suportado", () => {
    vibrateMock.mockReturnValue(true);
    stubVibrate();
    expect(isHapticsSupported()).toBe(true);

    expect(triggerHaptic("light")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith(8);

    expect(triggerHaptic("success")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([12, 40, 24]);

    expect(triggerHaptic("destructive")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([40, 60, 40]);

    expect(triggerHaptic("error")).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([50, 40, 50, 40]);
  });

  it("não dispara quando enabled é false", () => {
    vibrateMock.mockReturnValue(true);
    stubVibrate();

    expect(triggerHaptic("light", false)).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("não dispara quando a preferência global hapticEnabled é false", () => {
    vibrateMock.mockReturnValue(true);
    stubVibrate();
    updateVisualCustomization({ hapticEnabled: false });

    expect(triggerHaptic("light")).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("nunca lança se navigator.vibrate falhar", () => {
    vibrateMock.mockImplementation(() => {
      throw new Error("NotAllowedError");
    });
    stubVibrate();

    expect(() => triggerHaptic("warning")).not.toThrow();
    expect(triggerHaptic("warning")).toBe(false);
  });

  describe("HapticsManager", () => {
    beforeEach(() => {
      hapticsManager.reset();
      hapticsManager.unmute();
    });

    it("controla mudo global corretamente (mute, unmute, toggleMute)", () => {
      const manager = new HapticsManager();
      vibrateMock.mockReturnValue(true);
      stubVibrate();

      expect(manager.isMuted()).toBe(false);
      manager.mute();
      expect(manager.isMuted()).toBe(true);
      expect(manager.trigger("light", true)).toBe(false);
      expect(vibrateMock).not.toHaveBeenCalled();

      manager.unmute();
      expect(manager.isMuted()).toBe(false);

      const toggled = manager.toggleMute();
      expect(toggled).toBe(true);
      expect(manager.isMuted()).toBe(true);

      const toggledBack = manager.toggleMute();
      expect(toggledBack).toBe(false);
      expect(manager.isMuted()).toBe(false);
    });

    it("aplica throttle anti-concorrência para disparos sucessivos rápidos", () => {
      const manager = new HapticsManager();
      vibrateMock.mockReturnValue(true);
      stubVibrate();

      // Primeiro disparo passa
      const first = manager.trigger("light", true);
      expect(first).toBe(true);
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Segundo disparo consecutivo antes do intervalo mínimo é throttled
      const second = manager.trigger("light", true);
      expect(second).toBe(false);
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Padrões de alta prioridade (warning, destructive, error, success) furam throttle
      const urgent = manager.trigger("warning", true);
      expect(urgent).toBe(true);
      expect(vibrateMock).toHaveBeenCalledTimes(2);
    });

    it("reset limpa o histórico de timestamps", () => {
      const manager = new HapticsManager();
      vibrateMock.mockReturnValue(true);
      stubVibrate();

      manager.trigger("light", true);
      expect(manager.trigger("light", true)).toBe(false);

      manager.reset();
      expect(manager.trigger("light", true)).toBe(true);
    });
  });
});
