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
});
