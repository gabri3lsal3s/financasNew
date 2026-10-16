import { SplashScreen } from "@capacitor/splash-screen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import { hideNativeSplashScreen, hideSplashScreen } from "./splash-screen";

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: vi.fn(),
  },
}));

describe("Gateway Nativo — Splash Screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById("app-splash")?.remove();
  });

  it("aciona fade-out suave no #app-splash em ambiente Web/PWA e não chama SplashScreen.hide nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const splash = document.createElement("div");
    splash.id = "app-splash";
    document.body.appendChild(splash);

    await hideSplashScreen(300);

    expect(splash.classList.contains("splash-fade-out")).toBe(true);
    expect(document.body.classList.contains("app-mounted")).toBe(true);
    expect(SplashScreen.hide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(document.getElementById("app-splash")).toBeNull();
  });

  it("chama SplashScreen.hide com duração configurada em ambiente nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await hideNativeSplashScreen(250);

    expect(SplashScreen.hide).toHaveBeenCalledWith({ fadeOutDuration: 250 });
  });
});
