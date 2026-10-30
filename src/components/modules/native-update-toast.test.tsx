import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NativeUpdateToast } from "./native-update-toast";
import { WelcomeFeatureModal } from "./welcome-feature-modal";
import {
  UPDATE_DISMISSED_SESSION_KEY,
  resetUpdateDismissedForSession,
  isUpdateDismissedForSession,
} from "@/domain/native";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";
import { Toaster } from "@/components/ui/toast";
import * as platformModule from "@/services/native/platform";
import * as useAppUpdateModule from "@/hooks/use-app-update";

describe("NativeUpdateToast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    resetDemoSession();
    resetUpdateDismissedForSession();
    window.history.replaceState({}, "", "/");
  });

  it("não renderiza quando não é plataforma nativa", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "idle",
      isChecking: false,
      hasUpdate: true,
      updateInfo: null,
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
  });

  it("não renderiza quando não há atualização disponível", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "up-to-date",
      isChecking: false,
      hasUpdate: false,
      updateInfo: null,
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
  });

  it("renderiza o toast com botão Atualizar quando há atualização disponível em plataforma nativa", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const mockInstall = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: mockInstall,
    });

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );
    expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
    expect(screen.getByText(/A versão 0.2.0 já está disponível/)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Atualizar" });
    fireEvent.click(button);
    expect(mockInstall).toHaveBeenCalledTimes(1);
  });

  it("suprime o toast quando há um overlay bloqueante ativo (hasBlockingOverlay === true)", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    // Simula diálogo aberto no DOM
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );

    expect(screen.queryByText("Nova versão disponível")).toBeNull();

    document.body.removeChild(dialog);
  });

  it("exibe o toast após o fechamento do overlay bloqueante", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );

    expect(screen.queryByText("Nova versão disponível")).toBeNull();

    // Fecha o modal
    act(() => {
      document.body.removeChild(dialog);
    });

    await waitFor(() => {
      expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
    });
  });

  it("grava flag na sessionStorage e localStorage ao fechar o toast ([X]) e impede reexibição na mesma sessão", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    const { unmount } = render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );

    expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();

    // Fecha o toast pelo botão [X] (aria-label="Fechar")
    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);

    // Comprova que gravou na sessionStorage e localStorage
    expect(sessionStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).toBe("true");
    expect(localStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).not.toBeNull();
    expect(isUpdateDismissedForSession()).toBe(true);

    unmount();

    // Remonta o componente na mesma sessão
    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );

    // O toast não é mais exibido
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
  });

  it("suprime o toast quando o tour interativo de demonstração está ativo (isDemoActive = true)", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    startDemo("finances");

    render(
      <Toaster>
        <NativeUpdateToast />
      </Toaster>
    );

    expect(screen.queryByText("Nova versão disponível")).toBeNull();

    endDemo();
  });

  it("cenário integrado: simula nova versão disponível e abre o modal 'A Mágica da Captura Sem Fricção', comprovando que o banner NÃO aparece sobre o modal e que surge ao fechar o modal", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 1,
        latestVersion: "0.2.0",
        latestVersionCode: 2,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    const TestHost = () => {
      const [modalOpen, setModalOpen] = useState(true);
      return (
        <Toaster>
          <WelcomeFeatureModal open={modalOpen} onOpenChange={setModalOpen} forceShow />
          <NativeUpdateToast />
        </Toaster>
      );
    };

    render(<TestHost />);

    // 1. O modal "A Mágica da Captura Sem Fricção" está aberto
    expect(screen.getByText("A Mágica da Captura Sem Fricção")).toBeInTheDocument();

    // 2. O banner de atualização NÃO aparece sobre o modal (suprimido reativamente)
    await waitFor(() => {
      expect(screen.queryByText("Nova versão disponível")).toBeNull();
    });

    // 3. Fecha o modal clicando no botão Fechar
    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);

    // 4. Ao fechar o modal, o toast de atualização aparece calmamente na tela
    await waitFor(() => {
      expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
    });
  });
});
