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

  it("renderiza o atalho direto para o tour compartilhado", () => {
    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    const sharedTourBtn = screen.getByRole("button", { name: /Tour Compartilhado/i });
    expect(sharedTourBtn).toBeInTheDocument();
  });

  it("chama onStartSharedTour e fecha o modal ao clicar no atalho do tour compartilhado", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onStartSharedTour = vi.fn();

    render(
      <MemoryRouter>
        <HelpModal
          open={true}
          onOpenChange={onOpenChange}
          onStartSharedTour={onStartSharedTour}
        />
      </MemoryRouter>,
    );

    const sharedTourBtn = screen.getByRole("button", { name: /Tour Compartilhado/i });
    await user.click(sharedTourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStartSharedTour).toHaveBeenCalledTimes(1);
  });

  it("inicia a trilha de finanças compartilhadas (shared_finances) via fallback quando onStartSharedTour não é fornecido", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );

    const sharedTourBtn = screen.getByRole("button", { name: /Tour Compartilhado/i });
    await user.click(sharedTourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(true);
    expect(getDemoSessionState().activeTrack).toBe("shared_finances");
  });

  it("permite expandir o tópico de dúvidas frequentes sobre finanças compartilhadas", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HelpModal open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    const sharedFaqBtn = screen.getByRole("button", {
      name: /Como funciona a divisão de despesas e o Modo Família\?/i,
    });
    await user.click(sharedFaqBtn);

    expect(
      screen.getByText(/No lançamento ou detalhe de uma despesa, você pode dividi-la entre participantes/i),
    ).toBeInTheDocument();
  });
});
