import { App } from "@capacitor/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isCalculatorOpen, setCalculatorOpen } from "@/services/calculator-open";
import {
  handleHardwareBackButton,
  initHardwareBackButton,
  registerBackHandler,
} from "./back-button";
import * as platformModule from "./platform";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
    minimizeApp: vi.fn(),
  },
}));

describe("Gateway Nativo — Hardware Back Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCalculatorOpen(false);
    document.body.innerHTML = "";
  });

  it("prioriza handlers customizados registrados e permite desregistrar", async () => {
    const handler1 = vi.fn().mockReturnValue(false);
    const handler2 = vi.fn().mockReturnValue(true);

    const unregister1 = registerBackHandler(handler1);
    const unregister2 = registerBackHandler(handler2);

    await handleHardwareBackButton();

    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler1).not.toHaveBeenCalled();

    unregister2();
    await handleHardwareBackButton();

    expect(handler1).toHaveBeenCalledTimes(1);
    unregister1();
  });

  it("fecha a calculadora flutuante quando estiver aberta", async () => {
    setCalculatorOpen(true);
    expect(isCalculatorOpen()).toBe(true);

    await handleHardwareBackButton();

    expect(isCalculatorOpen()).toBe(false);
  });

  it("despacha evento Escape quando houver diálogo aberto no DOM", async () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    let escapeTriggered = false;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        escapeTriggered = true;
      }
    });

    await handleHardwareBackButton();

    expect(escapeTriggered).toBe(true);
  });

  it("chama window.history.back quando estiver em rota diferente da raiz", async () => {
    const historyBackSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { pathname: "/transacoes" },
      writable: true,
      configurable: true,
    });

    await handleHardwareBackButton(true);

    expect(historyBackSpy).toHaveBeenCalledTimes(1);
  });

  it("chama App.minimizeApp quando estiver na raiz", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/" },
      writable: true,
      configurable: true,
    });

    await handleHardwareBackButton(false);

    expect(App.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it("em plataforma Web/PWA, initHardwareBackButton opera como no-op", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const cleanup = initHardwareBackButton();
    expect(App.addListener).not.toHaveBeenCalled();
    cleanup();
  });

  it("em plataforma nativa, initHardwareBackButton registra listener", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(App.addListener).mockResolvedValue({
      remove: vi.fn(),
    } as unknown as { remove: () => Promise<void> });

    const cleanup = initHardwareBackButton();
    expect(App.addListener).toHaveBeenCalledWith("backButton", expect.any(Function));
    cleanup();
  });
});
