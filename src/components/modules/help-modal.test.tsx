import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HelpModal } from "./help-modal";

describe("HelpModal", () => {
  it("renderiza o diálogo de ajuda com título e bloco de simulação quando aberto", () => {
    render(<HelpModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Central de Ajuda & Suporte")).toBeInTheDocument();
    expect(screen.getByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore as telas e motores do aplicativo com dados realistas em memória/i),
    ).toBeInTheDocument();
  });

  it("não renderiza quando open é false", () => {
    render(<HelpModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("permite expandir e recolher tópicos de dúvidas frequentes", async () => {
    const user = userEvent.setup();
    render(<HelpModal open={true} onOpenChange={vi.fn()} />);

    // Tópico inicial já expandido por padrão
    expect(
      screen.getByText(/O motor de rebalanceamento calcula a distância percentual/i),
    ).toBeInTheDocument();

    // Clicar em outro tópico (ex: faturas de cartão)
    const cardFaqBtn = screen.getByRole("button", {
      name: /Como são organizadas as Faturas de Cartão\?/i,
    });
    await user.click(cardFaqBtn);

    expect(
      screen.getByText(/As transações feitas com cartão de crédito são agrupadas/i),
    ).toBeInTheDocument();
  });

  it("chama onOpenDemoSelect e fecha o modal ao clicar em Rever Tour Guiado", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onOpenDemoSelect = vi.fn();

    render(
      <HelpModal
        open={true}
        onOpenChange={onOpenChange}
        onOpenDemoSelect={onOpenDemoSelect}
      />,
    );

    const tourBtn = screen.getByRole("button", { name: /Rever Tour Guiado/i });
    expect(tourBtn).toBeInTheDocument();

    await user.click(tourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenDemoSelect).toHaveBeenCalledTimes(1);
  });
});
