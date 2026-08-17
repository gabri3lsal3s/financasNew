import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";
import { Modal } from "./modal";

describe("Modal", () => {
  it("exibe título, descrição e conteúdo quando aberto", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa" description="Preencha os dados">
        <p>Formulário</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nova despesa")).toBeInTheDocument();
    expect(screen.getByText("Formulário")).toBeInTheDocument();
  });

  it("renderiza o botão de calculadora ao lado do botão de fechar e abre a calculadora", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const calcButton = screen.getByRole("button", { name: "Abrir calculadora" });
    expect(calcButton).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();

    await user.click(calcButton);
  });

  it("permite ocultar o botão de calculadora com hideCalculator ou elevated", () => {
    const { rerender } = render(
      <Modal open onOpenChange={vi.fn()} title="Calculadora" elevated>
        <p>Conteúdo</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Abrir calculadora" })).not.toBeInTheDocument();

    rerender(
      <Modal open onOpenChange={vi.fn()} title="Modal sem calculadora" hideCalculator>
        <p>Conteúdo</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Abrir calculadora" })).not.toBeInTheDocument();
  });

  it("F25: exibe a alça do bottom sheet no mobile (lg:hidden)", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    // Base mobile + override lg: o conteúdo é full-width inferior com slide-up.
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("animate-sheet-in");
    expect(dialog.className).toContain("lg:animate-none");
    // Alça visível apenas no mobile.
    const handle = dialog.querySelector("[aria-hidden='true']");
    expect(handle).not.toBeNull();
    expect(handle?.className).toContain("lg:hidden");
  });

  it("F25: arrastar para baixo além do threshold fecha o modal (drag-to-close)", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.pointerDown(dialog, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(dialog, { pointerId: 1, pointerType: "touch", clientY: 240, clientX: 50 });
    fireEvent.pointerUp(dialog, { pointerId: 1, pointerType: "touch", clientY: 240, clientX: 50 });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("F25: arrasto curto (abaixo do threshold) não fecha o modal", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.pointerDown(dialog, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(dialog, { pointerId: 1, pointerType: "touch", clientY: 130, clientX: 50 });
    fireEvent.pointerUp(dialog, { pointerId: 1, pointerType: "touch", clientY: 130, clientX: 50 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("F25: toque com mouse (desktop) não inicia o drag-to-close", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.pointerDown(dialog, {
      pointerId: 1,
      pointerType: "mouse",
      clientY: 100,
      clientX: 50,
      button: 0,
      isPrimary: true,
    });
    fireEvent.pointerMove(dialog, { pointerId: 1, pointerType: "mouse", clientY: 300, clientX: 50 });
    fireEvent.pointerUp(dialog, { pointerId: 1, pointerType: "mouse", clientY: 300, clientX: 50 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog", () => {
  it("chama onConfirm ao confirmar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir transação?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("notifica fechamento ao cancelar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Excluir?" onConfirm={vi.fn()} />);

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

