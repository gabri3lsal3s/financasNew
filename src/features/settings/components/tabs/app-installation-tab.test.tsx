import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppInstallationTab } from "./app-installation-tab";
import * as platformModule from "@/services/native/platform";
import * as appUpdateHookModule from "@/hooks/use-app-update";
import * as toastModule from "@/services/toast";

vi.mock("@/hooks/use-pwa-install", () => ({
  usePWAInstall: vi.fn(() => ({
    isInstalled: false,
    isIOS: false,
  })),
}));

describe("AppInstallationTab", () => {
  const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockImplementation(() => 1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza status 'Android Pro Nativo' quando em plataforma nativa", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(appUpdateHookModule, "useAppUpdate").mockReturnValue({
      status: "up-to-date",
      isChecking: false,
      hasUpdate: false,
      updateInfo: {
        hasUpdate: false,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 4,
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    render(<AppInstallationTab />);

    expect(screen.getAllByText("Android Pro Nativo")[0]).toBeInTheDocument();
    expect(screen.getByText("v0.1.0 (Build 4)")).toBeInTheDocument();
    expect(screen.getByText("Seu aplicativo Android está atualizado com a versão mais recente.")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível verificar/i)).not.toBeInTheDocument();
  });

  it("exibe mensagem de erro e NUNCA diz 'está atualizado' quando ocorre erro de rede", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(appUpdateHookModule, "useAppUpdate").mockReturnValue({
      status: "error",
      isChecking: false,
      hasUpdate: false,
      updateInfo: null,
      error: "Failed to fetch",
      checkForUpdates: vi.fn(),
      installUpdate: vi.fn(),
    });

    render(<AppInstallationTab />);

    // Deve exibir o erro com ação de tentar novamente
    expect(screen.getByText(/Não foi possível verificar atualizações: Failed to fetch/i)).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();

    // NÃO deve exibir a mensagem de que está atualizado
    expect(screen.queryByText("Seu aplicativo Android está atualizado com a versão mais recente.")).not.toBeInTheDocument();
  });

  it("exibe card de nova versão quando há atualização disponível", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const installUpdateMock = vi.fn();
    vi.spyOn(appUpdateHookModule, "useAppUpdate").mockReturnValue({
      status: "available",
      isChecking: false,
      hasUpdate: true,
      updateInfo: {
        hasUpdate: true,
        isMandatory: false,
        currentVersion: "0.1.0",
        currentVersionCode: 4,
        latestVersion: "0.1.0",
        latestVersionCode: 5,
        manifest: {
          version: "0.1.0",
          versionCode: 5,
          releaseDate: "2026-10-22T01:23:08Z",
          apkUrl: "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/axis-pro.apk",
          changelog: ["Assistente bancário aprimorado"],
        },
      },
      error: null,
      checkForUpdates: vi.fn(),
      installUpdate: installUpdateMock,
    });

    render(<AppInstallationTab />);

    expect(screen.getByText("Nova versão disponível: v0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Build 5")).toBeInTheDocument();
    expect(screen.getByText("Assistente bancário aprimorado")).toBeInTheDocument();

    const updateButton = screen.getByText("Atualizar agora (sem desinstalar)");
    fireEvent.click(updateButton);
    expect(installUpdateMock).toHaveBeenCalled();
  });

  it("dispara toast de erro ao fazer verificação manual e receber falha", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const checkForUpdatesMock = vi.fn().mockResolvedValue({
      hasUpdate: false,
      isMandatory: false,
      currentVersion: "0.1.0",
      currentVersionCode: 4,
      error: "Falha de conexão com Cloudflare R2",
    });

    vi.spyOn(appUpdateHookModule, "useAppUpdate").mockReturnValue({
      status: "idle",
      isChecking: false,
      hasUpdate: false,
      updateInfo: null,
      error: null,
      checkForUpdates: checkForUpdatesMock,
      installUpdate: vi.fn(),
    });

    render(<AppInstallationTab />);

    const checkButton = screen.getByText("Verificar atualizações");
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(checkForUpdatesMock).toHaveBeenCalledWith(false);
      expect(pushToastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha na verificação",
          description: "Falha de conexão com Cloudflare R2",
          variant: "destructive",
        })
      );
    });
  });
});
