import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLockOverlay } from "./app-lock-overlay";
import * as nativeModule from "@/services/native";

describe("AppLockOverlay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    nativeModule.setAppLocked(false);
  });

  it("não renderiza nada quando o app não estiver bloqueado", () => {
    render(<AppLockOverlay />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renderiza a tela de bloqueio quando isAppLocked for true", () => {
    nativeModule.setAppLocked(true);
    render(<AppLockOverlay />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Bloqueado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Desbloquear com Biometria/i }),
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
});
