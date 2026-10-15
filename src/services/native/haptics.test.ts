import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerNativeHaptic } from "./haptics";
import * as platformModule from "./platform";

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    vibrate: vi.fn(),
  },
  ImpactStyle: {
    Heavy: "HEAVY",
    Medium: "MEDIUM",
    Light: "LIGHT",
  },
  NotificationType: {
    Success: "SUCCESS",
    Warning: "WARNING",
    Error: "ERROR",
  },
}));

describe("Gateway Nativo — Haptics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna false e não chama Haptics em ambiente Web/PWA", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const result = await triggerNativeHaptic("light");

    expect(result).toBe(false);
    expect(Haptics.impact).not.toHaveBeenCalled();
  });

  it("chama Haptics.impact com Light para padrão light", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    const result = await triggerNativeHaptic("light");

    expect(result).toBe(true);
    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  it("chama Haptics.impact com Medium para padrão medium", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    const result = await triggerNativeHaptic("medium");

    expect(result).toBe(true);
    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium });
  });

  it("chama Haptics.notification com Success para padrão success", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    const result = await triggerNativeHaptic("success");

    expect(result).toBe(true);
    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Success });
  });

  it("chama Haptics.notification com Warning para padrão warning", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    const result = await triggerNativeHaptic("warning");

    expect(result).toBe(true);
    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Warning });
  });

  it("chama Haptics.notification com Error para padrão destructive ou error", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    const resultDestructive = await triggerNativeHaptic("destructive");
    expect(resultDestructive).toBe(true);
    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Error });

    const resultError = await triggerNativeHaptic("error");
    expect(resultError).toBe(true);
  });
});
