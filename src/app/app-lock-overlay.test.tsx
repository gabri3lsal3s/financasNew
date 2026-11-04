import { render, screen } from "@testing-library/react";
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
});
