import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NativeUpdateToast } from "./native-update-toast";
import { Toaster } from "@/components/ui/toast";
import * as platformModule from "@/services/native/platform";
import * as useAppUpdateModule from "@/hooks/use-app-update";

describe("NativeUpdateToast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
