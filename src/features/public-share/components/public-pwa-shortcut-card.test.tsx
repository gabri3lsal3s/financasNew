import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicPwaShortcutCard } from "./public-pwa-shortcut-card";
import * as pwaInstallHook from "@/hooks/use-pwa-install";
import * as platformModule from "@/services/native/platform";

vi.mock("@/hooks/use-pwa-install");
vi.mock("@/services/native/platform");

describe("PublicPwaShortcutCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformModule.isNativePlatform).mockReturnValue(false);
  });

  it("não renderiza em Desktop Web quando não há prompt instalável nem iOS", () => {
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: false,
      isIOS: false,
      isInstalled: false,
      isNativePromptAvailable: false,
      install: vi.fn(),
    });

    const { container } = render(
      <PublicPwaShortcutCard
        title="Fixar no Celular"
        description="Adicione à tela inicial."
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("não renderiza quando o app já está instalado em modo standalone", () => {
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isIOS: false,
      isInstalled: true,
      isNativePromptAvailable: true,
      install: vi.fn(),
    });

    const { container } = render(
      <PublicPwaShortcutCard
        title="Fixar no Celular"
        description="Adicione à tela inicial."
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("exibe e aciona instalação quando canInstall for true", async () => {
    const user = userEvent.setup();
    const installMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isIOS: false,
      isInstalled: false,
      isNativePromptAvailable: true,
      install: installMock,
    });

    render(
      <PublicPwaShortcutCard
        title="Fixar no Celular"
        description="Adicione à tela inicial."
      />,
    );

    await user.click(screen.getByRole("button", { name: /Adicionar à Tela Inicial/i }));
    expect(installMock).toHaveBeenCalledTimes(1);
  });
});
