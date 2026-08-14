import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { notifyPWAUpdate, registerPWA } from "@/app/pwa";
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
