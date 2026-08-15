import { render, screen } from "@testing-library/react";
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

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
