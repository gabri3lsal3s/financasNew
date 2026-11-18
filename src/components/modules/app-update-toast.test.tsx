import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyPWAUpdate, _resetPWAStateForTesting } from "@/app/pwa";
import { Toaster } from "@/components/ui/toast";
import {
  TWELVE_HOURS_MS,
  UPDATE_DISMISSED_SESSION_KEY,
  isUpdateDismissedForSession,
  resetUpdateDismissedForSession,
} from "@/domain/native";
import * as useAppUpdateModule from "@/hooks/use-app-update";
import * as platformModule from "@/services/native/platform";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";
import { AppUpdateToast } from "./app-update-toast";
import { NativeUpdateToast } from "./native-update-toast";

describe("AppUpdateToast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    resetDemoSession();
    resetUpdateDismissedForSession();
    _resetPWAStateForTesting();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    endDemo();
    resetUpdateDismissedForSession();
    _resetPWAStateForTesting();
  });

  it("na Web (PWA), exibe toast de nova versão, suprime durante modal/tour e reexibe ao fechar overlay", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    render(
      <Toaster>
        <AppUpdateToast />
      </Toaster>,
    );

    act(() => {
      notifyPWAUpdate();
    });

    // Suprimido enquanto o diálogo bloqueante está aberto
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();

    act(() => {
      document.body.removeChild(dialog);
    });

    await waitFor(() => {
      expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
    });

    // Suprimido durante tour de demonstração
    act(() => {
      startDemo("finances");
    });

    await waitFor(() => {
      expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
    });
  });

  it("na Web (PWA), respeita a janela de supressão de 12 horas ao fechar o toast", async () => {
    const user = userEvent.setup();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const { unmount } = render(
      <Toaster>
        <AppUpdateToast />
      </Toaster>,
    );

    act(() => {
      notifyPWAUpdate();
    });

    expect(await screen.findByText("Nova versão disponível")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
    expect(isUpdateDismissedForSession()).toBe(true);
    expect(localStorage.getItem(UPDATE_DISMISSED_SESSION_KEY)).not.toBeNull();

    unmount();

    // Mesmo que uma atualização seja anunciada novamente dentro das 12h, permanece suprimido
    act(() => {
      notifyPWAUpdate();
    });

    render(
      <Toaster>
        <AppUpdateToast />
      </Toaster>,
    );

    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
  });

  it("na Web (PWA), volta a anunciar após expirar a janela de 12 horas", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const expiredTs = Date.now() - (TWELVE_HOURS_MS + 60_000);
    localStorage.setItem(UPDATE_DISMISSED_SESSION_KEY, String(expiredTs));

    render(
      <Toaster>
        <AppUpdateToast />
      </Toaster>,
    );

    act(() => {
      notifyPWAUpdate();
    });

    expect(await screen.findByText("Nova versão disponível")).toBeInTheDocument();
  });

  it("em plataforma nativa, utiliza o fluxo nativo e não duplica quando NativeUpdateToast também está montado", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const mockInstall = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAppUpdateModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "3.9.0",
        currentVersionCode: 39,
        latestVersion: "3.10.0",
        latestVersionCode: 40,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: mockInstall,
    });

    // Simula anúncio PWA simultâneo — deve ser ignorado no nativo
    act(() => {
      notifyPWAUpdate();
    });

    render(
      <Toaster>
        <AppUpdateToast />
        <NativeUpdateToast />
      </Toaster>,
    );

    const titles = screen.getAllByText("Nova versão disponível");
    expect(titles).toHaveLength(1);
    expect(screen.getByText(/A versão 3\.10\.0 já está disponível/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(mockInstall).toHaveBeenCalledTimes(1);
  });
});
