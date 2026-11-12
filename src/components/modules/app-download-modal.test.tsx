import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppDownloadModal } from "./app-download-modal";
import * as pwaInstallHook from "@/hooks/use-pwa-install";
import * as platformService from "@/services/native/platform";

describe("AppDownloadModal — Diálogo Unificado de Instalação e Download", () => {
  const mockInstall = vi.fn().mockResolvedValue(undefined);
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isNativePromptAvailable: true,
      isIOS: false,
      isInstalled: false,
      install: mockInstall,
    });
    vi.spyOn(platformService, "isIOSDevice").mockReturnValue(false);
    vi.spyOn(platformService, "isStandaloneDisplay").mockReturnValue(false);
  });

  it("renderiza opções de PWA e APK quando o usuário está no navegador tradicional", () => {
    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Baixar aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Web (PWA)")).toBeInTheDocument();
    expect(screen.getByText("App Android Pro (APK)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Instalar App Web/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar APK/i })).toBeInTheDocument();
  });

  it("oculta a opção de PWA quando o usuário já está no PWA (modo standalone)", () => {
    vi.spyOn(platformService, "isStandaloneDisplay").mockReturnValue(true);

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText("Aplicativo Web (PWA)")).not.toBeInTheDocument();
    expect(screen.getByText("App Android Pro (APK)")).toBeInTheDocument();
    expect(
      screen.getByText("Você já está utilizando a versão Web (PWA) instalada neste dispositivo."),
    ).toBeInTheDocument();
  });

  it("oculta a opção de PWA quando isInstalled da store do PWA for true", () => {
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: false,
      isNativePromptAvailable: false,
      isIOS: false,
      isInstalled: true,
      install: mockInstall,
    });

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText("Aplicativo Web (PWA)")).not.toBeInTheDocument();
    expect(screen.getByText("App Android Pro (APK)")).toBeInTheDocument();
    expect(
      screen.getByText("Você já está utilizando a versão Web (PWA) instalada neste dispositivo."),
    ).toBeInTheDocument();
  });

  it("dispara o prompt de instalação do PWA ao clicar em Instalar App Web", async () => {
    const user = userEvent.setup();

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    const pwaBtn = screen.getByRole("button", { name: /Instalar App Web/i });
    await user.click(pwaBtn);

    expect(mockInstall).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("exibe 'Como instalar no iOS' e abre o guia do Safari em dispositivos Apple", async () => {
    const user = userEvent.setup();
    vi.spyOn(platformService, "isIOSDevice").mockReturnValue(true);

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    const iosBtn = screen.getByRole("button", { name: /Como instalar no iOS/i });
    expect(iosBtn).toBeInTheDocument();

    await user.click(iosBtn);

    expect(await screen.findByRole("heading", { name: "Instalar no iPhone ou iPad" })).toBeInTheDocument();
  });

  it("abre o guia de instalação do APK ao clicar em 'Como instalar'", async () => {
    const user = userEvent.setup();

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    const apkGuideBtn = screen.getByRole("button", { name: /Como instalar/i });
    await user.click(apkGuideBtn);

    expect(
      await screen.findByRole("heading", { name: "Instalação do Aplicativo Android (Beta)" }),
    ).toBeInTheDocument();
  });

  it("executa o download do arquivo .apk ao clicar em Baixar APK", async () => {
    const user = userEvent.setup();
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    render(<AppDownloadModal open={true} onOpenChange={mockOnOpenChange} />);

    const downloadBtn = screen.getByRole("button", { name: "Baixar APK" });
    await user.click(downloadBtn);

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
