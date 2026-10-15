import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound } from "./audio-fx";
import { triggerHaptic } from "./haptics";
import { sensory, triggerSensory } from "./sensory";

const { mockSoundManager, mockHapticsManager } = vi.hoisted(() => ({
  mockSoundManager: {
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn(() => false),
    toggleMute: vi.fn(),
    reset: vi.fn(),
  },
  mockHapticsManager: {
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn(() => false),
    toggleMute: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("./haptics", () => ({
  triggerHaptic: vi.fn(),
  isHapticsSupported: vi.fn(() => true),
  hapticsManager: mockHapticsManager,
}));

vi.mock("./audio-fx", () => ({
  playSound: vi.fn(),
  soundManager: mockSoundManager,
}));

describe("sensory service", () => {
  beforeEach(() => {
    vi.mocked(triggerHaptic).mockReset();
    vi.mocked(playSound).mockReset();
    vi.clearAllMocks();
    mockSoundManager.isMuted.mockReturnValue(false);
    mockHapticsManager.isMuted.mockReturnValue(false);
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

  it("não dispara nem som nem haptic para categorias presentes em disabledSensoryIntents", () => {
    updateVisualCustomization({
      soundEnabled: true,
      hapticEnabled: true,
      disabledSensoryIntents: ["warning", "error"],
    });

    triggerSensory("warning");
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();

    triggerSensory("error");
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();

    // Outras categorias permitidas continuam disparando normalmente
    triggerSensory("success");
    expect(triggerHaptic).toHaveBeenCalledWith("success");
    expect(playSound).toHaveBeenCalledWith("success", true);
  });

  it("controla mudo global em conjunto para som e haptics via sensory.mute/unmute", () => {
    sensory.mute();
    expect(mockSoundManager.mute).toHaveBeenCalledTimes(1);
    expect(mockHapticsManager.mute).toHaveBeenCalledTimes(1);

    sensory.unmute();
    expect(mockSoundManager.unmute).toHaveBeenCalledTimes(1);
    expect(mockHapticsManager.unmute).toHaveBeenCalledTimes(1);
  });

  it("sensory.isMuted reflete estado dos managers", () => {
    mockSoundManager.isMuted.mockReturnValue(false);
    mockHapticsManager.isMuted.mockReturnValue(false);
    expect(sensory.isMuted()).toBe(false);

    mockSoundManager.isMuted.mockReturnValue(true);
    expect(sensory.isMuted()).toBe(true);

    mockSoundManager.isMuted.mockReturnValue(false);
    mockHapticsManager.isMuted.mockReturnValue(true);
    expect(sensory.isMuted()).toBe(true);
  });
});
