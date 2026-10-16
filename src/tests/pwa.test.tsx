import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyPWAUpdate, refreshPWAInstallState, registerPWA } from "@/app/pwa";
import { InstallAppButton } from "@/components/modules/install-app-button";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";
import { Toaster } from "@/components/ui/toast";

/**
 * F5.6 — PWA polish (PWA_GUIDELINES §6):
 * - instalação via beforeinstallprompt (botão no menu, nunca popup);
 * - atualização automática (autoUpdate) anunciada por toast, sem reload automático.
 */
describe("PWA — instalação (beforeinstallprompt)", () => {
  it("oculta sem evento, mostra ao receber beforeinstallprompt e consome no clique", async () => {
    const user = userEvent.setup();
    registerPWA();

    render(<InstallAppButton />);
    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(event);

    const button = await screen.findByRole("button", { name: "Instalar app" });
    await user.click(button);

    expect(prompt).toHaveBeenCalledTimes(1);
    // O evento de instalação é de uso único — o botão some após o prompt.
    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
  });

  it("não registra Service Worker e não permite instalação em ambiente nativo", async () => {
    const nativeModule = await import("@/services/native");
    const spy = vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);

    registerPWA();

    render(<InstallAppButton />);
    const event = new Event("beforeinstallprompt");
    window.dispatchEvent(event);

    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("PWA — atualização automática (autoUpdate → toast)", () => {
  it("anuncia nova versão, consome no fechar e recarrega ao clicar em Atualizar", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      configurable: true,
      writable: true,
    });

    render(
      <Toaster>
        <PWAUpdateToast />
      </Toaster>,
    );
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
    notifyPWAUpdate();
    expect(await screen.findByText("Nova versão disponível", {}, { timeout: 2000 })).toBeInTheDocument();

    // Fechar consome o anúncio (não fica preso).
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();

    // Uma nova versão volta a anunciar.
    notifyPWAUpdate();
    expect(await screen.findByText("Nova versão disponível")).toBeInTheDocument();

    // "Atualizar" recarrega a página (ação explícita do usuário).
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("PWA — suporte e guia para iOS Safari", () => {
  const originalUserAgent = navigator.userAgent;
  const originalPlatform = navigator.platform;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  const setNavigator = (ua: string, platform = "iPhone", maxTouchPoints = 5) => {
    Object.defineProperty(navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: platform,
      configurable: true,
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: maxTouchPoints,
      configurable: true,
    });
    refreshPWAInstallState();
  };

  afterEach(() => {
    setNavigator(originalUserAgent, originalPlatform, originalMaxTouchPoints);
  });

  it("detecta iPhone e abre o IosPwaInstallDialog ao clicar no botão", async () => {
    const user = userEvent.setup();
    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "iPhone", 5);

    render(<InstallAppButton />);

    const button = await screen.findByRole("button", { name: "Instalar app" });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Como instalar no iOS")).toBeInTheDocument();

    await user.click(button);

    expect(await screen.findByRole("heading", { name: "Instalar no iPhone ou iPad" })).toBeInTheDocument();
    expect(screen.getByText("Toque em Compartilhar")).toBeInTheDocument();
  });

  it("detecta iPad moderno (MacIntel com touchscreen)", async () => {
    const { isIOS } = await import("@/app/pwa");
    setNavigator(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      "MacIntel",
      5,
    );

    expect(isIOS()).toBe(true);
  });

  it("renderiza a variante card com título estruturado e badge de disponibilidade", async () => {
    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5);

    render(<InstallAppButton variant="card" />);

    expect(screen.getByText("Aplicativo Web Instalável (PWA)")).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Como instalar no iOS/i })).toBeInTheDocument();
  });
});

