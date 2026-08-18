import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import * as audioFx from "./audio-fx";
import * as haptics from "./haptics";
import { sensory, triggerSensory } from "./sensory";

describe("sensory service", () => {
  const triggerHapticSpy = vi.spyOn(haptics, "triggerHaptic");
  const playSoundSpy = vi.spyOn(audioFx, "playSound");

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    updateVisualCustomization({
      soundEnabled: false,
      hapticEnabled: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispara haptic mas não som quando soundEnabled = false e hapticEnabled = true", () => {
    triggerSensory("action");

    expect(triggerHapticSpy).toHaveBeenCalledWith("light");
    expect(playSoundSpy).not.toHaveBeenCalled();
  });

  it("dispara som quando soundEnabled = true", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    triggerSensory("success");

    expect(triggerHapticSpy).toHaveBeenCalledWith("success");
    expect(playSoundSpy).toHaveBeenCalledWith("success", true);
  });

  it("não dispara haptic quando hapticEnabled = false", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: false });

    triggerSensory("destructive");

    expect(triggerHapticSpy).not.toHaveBeenCalled();
    expect(playSoundSpy).toHaveBeenCalledWith("delete", true);
  });

  it("respeita opções skipHaptic e skipSound", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    triggerSensory("warning", { skipHaptic: true });
    expect(triggerHapticSpy).not.toHaveBeenCalled();
    expect(playSoundSpy).toHaveBeenCalledWith("warning", true);

    vi.clearAllMocks();
    triggerSensory("warning", { skipSound: true });
    expect(triggerHapticSpy).toHaveBeenCalledWith("warning");
    expect(playSoundSpy).not.toHaveBeenCalled();
  });

  it("provê helpers utilitários convenientes (sensory.*)", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    sensory.selection();
    expect(triggerHapticSpy).toHaveBeenLastCalledWith("light");
    expect(playSoundSpy).toHaveBeenLastCalledWith("click", true);

    sensory.toggle();
    expect(triggerHapticSpy).toHaveBeenLastCalledWith("light");
    expect(playSoundSpy).toHaveBeenLastCalledWith("pop", true);

    sensory.error();
    expect(triggerHapticSpy).toHaveBeenLastCalledWith("error");
    expect(playSoundSpy).toHaveBeenLastCalledWith("error", true);
  });
});
