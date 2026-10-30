import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast, Toaster } from "./toast";

describe("Toast & Toaster — Stacking Context & Pointer Events (§4.4)", () => {
  it("renderiza o Viewport com pointer-events-none e classe z-toast", () => {
    const { container } = render(
      <Toaster>
        <div>Filho do Toaster</div>
      </Toaster>,
    );

    const viewport = container.querySelector("ol");
    expect(viewport).not.toBeNull();
    expect(viewport?.className).toContain("pointer-events-none");
    expect(viewport?.className).toContain("z-toast");
  });

  it("permite interações com elementos de fundo sem bloqueio de ponteiro pelo Viewport", async () => {
    const user = userEvent.setup();
    const handleBackgroundClick = vi.fn();

    render(
      <div>
        <button
          type="button"
          onClick={handleBackgroundClick}
          className="relative z-10"
        >
          Botão no Fundo
        </button>
        <Toaster>
          {/* Nenhum toast ativo; viewport montado */}
        </Toaster>
      </div>,
    );

    const backgroundBtn = screen.getByRole("button", { name: "Botão no Fundo" });
    await user.click(backgroundBtn);

    expect(handleBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza o Toast com data-toast='true', pointer-events-auto quando aberto e data-[state=closed]:pointer-events-none", () => {
    render(
      <Toaster>
        <Toast
          open={true}
          onOpenChange={vi.fn()}
          title="Notificação Ativa"
          description="Descrição da notificação"
        />
      </Toaster>,
    );

    const toastEl = screen.getByText("Notificação Ativa").closest('[data-toast="true"]');
    expect(toastEl).not.toBeNull();
    expect(toastEl?.className).toContain("pointer-events-auto");
    expect(toastEl?.className).toContain("data-[state=closed]:pointer-events-none");
  });

  it("executa ação primária ao clicar no botão de ação", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();

    render(
      <Toaster>
        <Toast
          open={true}
          onOpenChange={vi.fn()}
          title="Ação Disponível"
          action={{
            label: "Executar",
            onClick: handleAction,
          }}
        />
      </Toaster>,
    );

    const actionBtn = screen.getByRole("button", { name: "Executar" });
    await user.click(actionBtn);

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("fecha o toast ao clicar no botão Fechar", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <Toaster>
        <Toast
          open={true}
          onOpenChange={handleOpenChange}
          title="Fechar me"
        />
      </Toaster>,
    );

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    await user.click(closeBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
