import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLockOverlay } from "./app-lock-overlay";
import * as nativeModule from "@/services/native";

const mockSignOut = vi.fn();

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

describe("AppLockOverlay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
    nativeModule.setAppLocked(false);
  });

  it("não renderiza nada quando o app não estiver bloqueado", () => {
    render(<AppLockOverlay />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renderiza a tela de bloqueio com botão de biometria e desconexão de emergência", () => {
    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Bloqueado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Desbloquear com Biometria/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sair da conta e entrar com senha/i }),
    ).toBeInTheDocument();
  });

  it("aciona unlockAppWithBiometrics ao clicar no botão de desbloqueio", async () => {
    const user = userEvent.setup();
    const unlockSpy = vi
      .spyOn(nativeModule, "unlockAppWithBiometrics")
      .mockResolvedValue(true);

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    const button = screen.getByRole("button", { name: /Desbloquear com Biometria/i });
    await user.click(button);

    expect(unlockSpy).toHaveBeenCalled();
  });

  it("aciona signOut ao clicar no botão de desconexão de emergência", async () => {
    const user = userEvent.setup();
    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    const emergencyButton = screen.getByRole("button", {
      name: /Sair da conta e entrar com senha/i,
    });
    await user.click(emergencyButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("desabilita botões e exibe estado de carregamento durante a desconexão de emergência", async () => {
    const user = userEvent.setup();
    let resolveSignOut!: () => void;
    mockSignOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    const emergencyButton = screen.getByRole("button", {
      name: /Sair da conta e entrar com senha/i,
    });
    const unlockButton = screen.getByRole("button", {
      name: /Desbloquear com Biometria/i,
    });

    await user.click(emergencyButton);

    // Durante o sign out, deve exibir "Saindo..." e ambos os botões devem estar desabilitados
    expect(screen.getByText("Saindo...")).toBeInTheDocument();
    expect(emergencyButton).toBeDisabled();
    expect(unlockButton).toBeDisabled();

    // Conclui o sign out
    resolveSignOut();
  });

  it("renderiza o AppLockOverlay na Web/PWA quando a aba é minimizada/trocada por tempo superior à tolerância", () => {
    nativeModule.setBiometricLockEnabled(true);
    nativeModule.setAppLockGraceMinutes(1);
    const cleanup = nativeModule.initAppLockListener();

    render(<AppLockOverlay />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    const now = 500_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Usuário minimiza ou troca de aba no navegador
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Retorna 2 minutos depois (tolerância excedida)
    vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // O AppLockOverlay deve estar cobrindo a tela
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Bloqueado")).toBeInTheDocument();

    cleanup();
  });

  it("quando configurado PIN na Web/PWA, exibe input de PIN e desbloqueia com sucesso", async () => {
    const user = userEvent.setup();
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(true);
    const unlockPinSpy = vi.spyOn(nativeModule, "unlockAppWithPin").mockResolvedValue(true);

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    const pinInput = screen.getByLabelText(/PIN de Acesso/i);
    expect(pinInput).toBeInTheDocument();

    await user.type(pinInput, "1234");
    const submitButton = screen.getByRole("button", { name: /Desbloquear com PIN/i });
    await user.click(submitButton);

    expect(unlockPinSpy).toHaveBeenCalledWith("1234");
  });

  it("exibe mensagem de erro quando o PIN informado for incorreto", async () => {
    const user = userEvent.setup();
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(true);
    vi.spyOn(nativeModule, "unlockAppWithPin").mockResolvedValue(false);

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    const pinInput = screen.getByLabelText(/PIN de Acesso/i);
    await user.type(pinInput, "9999");
    const submitButton = screen.getByRole("button", { name: /Desbloquear com PIN/i });
    await user.click(submitButton);

    expect(await screen.findByText(/PIN incorreto. Tente novamente./i)).toBeInTheDocument();
  });

  it("não exibe o botão 'Usar PIN' quando nenhum PIN local estiver configurado", () => {
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(false);
    nativeModule.setAppLocked(true);

    render(<AppLockOverlay />);

    expect(screen.queryByRole("button", { name: /Usar PIN/i })).not.toBeInTheDocument();
  });

  it("aplica inert no #root, prende o foco com Tab/Shift+Tab e restaura foco ao desbloquear", async () => {
    const user = userEvent.setup();
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(false);

    const rootEl = document.createElement("div");
    rootEl.id = "root";
    const bgButton = document.createElement("button");
    bgButton.textContent = "Botão do App";
    rootEl.appendChild(bgButton);
    document.body.appendChild(rootEl);
    bgButton.focus();

    const unlockSpy = vi.spyOn(nativeModule, "unlockAppWithBiometrics").mockImplementation(async () => {
      nativeModule.setAppLocked(false);
      return true;
    });

    act(() => {
      nativeModule.setAppLocked(true);
    });
    render(<AppLockOverlay />);

    expect(rootEl.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).not.toBe(bgButton);

    const bioButton = screen.getByRole("button", { name: /Desbloquear com Biometria/i });
    const signOutButton = screen.getByRole("button", { name: /Sair da conta e entrar com senha/i });

    // Tab do último botão volta para o primeiro botão dentro do overlay
    signOutButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(bioButton);

    // Shift+Tab do primeiro botão volta para o último botão dentro do overlay
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(signOutButton);

    await user.click(bioButton);
    expect(unlockSpy).toHaveBeenCalled();
    expect(rootEl.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(bgButton);

    rootEl.remove();
  });

  it("oculta o botão 'Usar Biometria' na Web quando não há biometria disponível", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(true);
    vi.spyOn(nativeModule, "checkBiometricsAvailability").mockResolvedValue({
      isAvailable: false,
      biometryType: "none",
      deviceIsSecure: false,
    });

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    expect(screen.getByLabelText(/PIN de Acesso/i)).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: /Usar Biometria/i })).not.toBeInTheDocument();
  });

  it("exibe contagem regressiva do lockout de PIN e destaca CTA de saída após 10 falhas", () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(nativeModule, "isPinLockConfigured").mockReturnValue(true);
    vi.spyOn(nativeModule, "getPinLockoutState").mockReturnValue({
      failedAttempts: 10,
      lockedUntilMs: Date.now() + 45_000,
    });

    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Muitas tentativas incorretas\. Aguarde \d+s/);
    expect(screen.getByLabelText(/PIN de Acesso/i)).toBeDisabled();

    const emergencyButton = screen.getByRole("button", {
      name: /Sair da conta e entrar com senha/i,
    });
    expect(emergencyButton.className).toContain("text-critical-strong");
  });
});
