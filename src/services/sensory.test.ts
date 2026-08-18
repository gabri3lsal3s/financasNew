import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound } from "./audio-fx";
import { triggerHaptic } from "./haptics";
import { sensory, triggerSensory } from "./sensory";

vi.mock("./haptics", () => ({
  triggerHaptic: vi.fn(),
  isHapticsSupported: vi.fn(() => true),
}));

vi.mock("./audio-fx", () => ({
  playSound: vi.fn(),
}));

describe("sensory service", () => {
  beforeEach(() => {
    vi.mocked(triggerHaptic).mockReset();
    vi.mocked(playSound).mockReset();
    window.localStorage.clear();
    updateVisualCustomization({
      soundEnabled: false,
      hapticEnabled: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dispara haptic mas não som quando soundEnabled = false e hapticEnabled = true", () => {
    triggerSensory("action");

    expect(triggerHaptic).toHaveBeenCalledWith("light");
    expect(playSound).not.toHaveBeenCalled();
  });

  it("dispara som quando soundEnabled = true", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    triggerSensory("success");

    expect(triggerHaptic).toHaveBeenCalledWith("success");
    expect(playSound).toHaveBeenCalledWith("success", true);
  });

  it("não dispara haptic quando hapticEnabled = false", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: false });

    triggerSensory("destructive");

    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).toHaveBeenCalledWith("delete", true);
  });

  it("respeita opções skipHaptic e skipSound", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    triggerSensory("warning", { skipHaptic: true });
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).toHaveBeenCalledWith("warning", true);

    vi.mocked(triggerHaptic).mockClear();
    vi.mocked(playSound).mockClear();

    triggerSensory("warning", { skipSound: true });
    expect(triggerHaptic).toHaveBeenCalledWith("warning");
    expect(playSound).not.toHaveBeenCalled();
  });

  it("provê helpers utilitários convenientes (sensory.*)", () => {
    updateVisualCustomization({ soundEnabled: true, hapticEnabled: true });

    sensory.selection();
    expect(triggerHaptic).toHaveBeenLastCalledWith("light");
    expect(playSound).toHaveBeenLastCalledWith("click", true);

    sensory.toggle();
    expect(triggerHaptic).toHaveBeenLastCalledWith("light");
    expect(playSound).toHaveBeenLastCalledWith("pop", true);

    sensory.error();
    expect(triggerHaptic).toHaveBeenLastCalledWith("error");
    expect(playSound).toHaveBeenLastCalledWith("error", true);
  });
});
