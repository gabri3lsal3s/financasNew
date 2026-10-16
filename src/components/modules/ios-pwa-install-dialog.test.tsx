import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IosPwaInstallDialog } from "./ios-pwa-install-dialog";

describe("IosPwaInstallDialog", () => {
  it("renderiza todos os passos de instalação no iOS quando aberto", () => {
    const handleOpenChange = vi.fn();
    render(<IosPwaInstallDialog open={true} onOpenChange={handleOpenChange} />);

    expect(screen.getByRole("heading", { name: "Instalar no iPhone ou iPad" })).toBeInTheDocument();
    expect(
      screen.getByText("Adicione o aplicativo à tela de início para desfrutar da experiência em tela cheia e acesso instantâneo."),
    ).toBeInTheDocument();

    // Valida os 3 passos obrigatórios
    expect(screen.getByText("Toque em Compartilhar")).toBeInTheDocument();
    expect(screen.getByText("Adicionar à Tela de Início")).toBeInTheDocument();
    expect(screen.getByText("Confirme em 'Adicionar'")).toBeInTheDocument();

    // Valida o card explicativo de benefícios
    expect(
      screen.getByText(/Após a instalação, o aplicativo abrirá como um app nativo/i),
    ).toBeInTheDocument();
  });

  it("chama onOpenChange(false) ao clicar no botão 'Entendi'", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(<IosPwaInstallDialog open={true} onOpenChange={handleOpenChange} />);

    const confirmButton = screen.getByRole("button", { name: "Entendi" });
    await user.click(confirmButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("não exibe o conteúdo quando open=false", () => {
    const handleOpenChange = vi.fn();
    render(<IosPwaInstallDialog open={false} onOpenChange={handleOpenChange} />);

    expect(screen.queryByRole("heading", { name: "Instalar no iPhone ou iPad" })).not.toBeInTheDocument();
  });
});
