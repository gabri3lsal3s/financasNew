import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionsAlertBanner } from "./permissions-alert-banner";

describe("PermissionsAlertBanner", () => {
  it("renderiza aviso para leitor bancário e dispara callbacks", async () => {
    const handleAction = vi.fn();
    const handleDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <PermissionsAlertBanner
        type="bank_listener"
        onAction={handleAction}
        onDismiss={handleDismiss}
      />,
    );

    expect(screen.getByText("Acesso a Notificações Bancárias Bloqueado")).toBeInTheDocument();
    expect(screen.getByText("Assistente Bancário")).toBeInTheDocument();

    const actionBtn = screen.getByRole("button", { name: /habilitar/i });
    await user.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);

    const dismissBtn = screen.getByRole("button", { name: /não ativar agora/i });
    await user.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("renderiza aviso para alertas de contas no dispositivo", () => {
    render(
      <PermissionsAlertBanner
        type="push_due"
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Alertas no Dispositivo Desativados")).toBeInTheDocument();
    expect(screen.getByText("Avisos de Contas")).toBeInTheDocument();
  });

  it("renderiza aviso combinado quando ambos estiverem pendentes", () => {
    render(
      <PermissionsAlertBanner
        type="both"
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Permissões de Notificação e Banco Pendentes")).toBeInTheDocument();
    expect(screen.getByText("2 Pendências")).toBeInTheDocument();
  });
});
