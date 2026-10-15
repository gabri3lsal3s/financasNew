import { PrivacyScreen } from "@capacitor-community/privacy-screen";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import { disablePrivacyShield, enablePrivacyShield } from "./privacy-shield";

vi.mock("@capacitor-community/privacy-screen", () => ({
  PrivacyScreen: {
    enable: vi.fn(),
    disable: vi.fn(),
  },
}));

describe("Gateway Nativo — Privacy Shield", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não chama PrivacyScreen em ambiente Web/PWA", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    await enablePrivacyShield();
    await disablePrivacyShield();

    expect(PrivacyScreen.enable).not.toHaveBeenCalled();
    expect(PrivacyScreen.disable).not.toHaveBeenCalled();
  });

  it("chama PrivacyScreen.enable em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await enablePrivacyShield();

    expect(PrivacyScreen.enable).toHaveBeenCalledTimes(1);
  });

  it("chama PrivacyScreen.disable em plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    await disablePrivacyShield();

    expect(PrivacyScreen.disable).toHaveBeenCalledTimes(1);
  });
});
