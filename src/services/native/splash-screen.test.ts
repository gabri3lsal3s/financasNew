import { SplashScreen } from "@capacitor/splash-screen";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import { hideNativeSplashScreen } from "./splash-screen";

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: vi.fn(),
  },
}));

describe("Gateway Nativo — Splash Screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não chama SplashScreen.hide em ambiente Web/PWA", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    await hideNativeSplashScreen(300);

    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });

  it("chama SplashScreen.hide com duração configurada em ambiente nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await hideNativeSplashScreen(250);

    expect(SplashScreen.hide).toHaveBeenCalledWith({ fadeOutDuration: 250 });
  });
});
