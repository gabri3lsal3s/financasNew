import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HelpModal } from "./help-modal";
import { getDemoSessionState, resetDemoSession } from "@/state/demo-mode";

describe("HelpModal", () => {
  it("renderiza o diálogo de ajuda com título e bloco de simulação quando aberto", () => {
    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Central de Ajuda & Suporte")).toBeInTheDocument();
    expect(screen.getByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore as telas e motores do aplicativo com dados realistas em memória/i),
    ).toBeInTheDocument();
  });

  it("não renderiza quando open é false", () => {
    render(
      <MemoryRouter>
        <HelpModal open={false} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("permite expandir e recolher tópicos de dúvidas frequentes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

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
      <MemoryRouter>
        <HelpModal
          open={true}
          onOpenChange={onOpenChange}
          onOpenDemoSelect={onOpenDemoSelect}
        />
      </MemoryRouter>,
    );

    const tourBtn = screen.getByRole("button", { name: /Rever Tour Guiado/i });
    expect(tourBtn).toBeInTheDocument();

    await user.click(tourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenDemoSelect).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    resetDemoSession();
  });

  it("inicia demo padrão diretamente via fallback quando onOpenDemoSelect não é fornecido", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );

    const tourBtn = screen.getByRole("button", { name: /Rever Tour Guiado/i });
    await user.click(tourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(true);
    expect(getDemoSessionState().activeTrack).toBe("finances");
  });
});
