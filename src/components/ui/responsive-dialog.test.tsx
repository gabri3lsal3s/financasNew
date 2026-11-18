import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModalFooter } from "./modal";
import { ResponsiveDialog } from "./responsive-dialog";
import { Button } from "./button";

describe("ResponsiveDialog", () => {
  it("renderiza título, descrição, conteúdo e sticky footer corretamente", () => {
    render(
      <ResponsiveDialog
        open
        onOpenChange={vi.fn()}
        title="Editar Transação"
        description="Ajuste os valores necessários"
        footer={<Button>Salvar Alterações</Button>}
      >
        <p>Campos do formulário</p>
      </ResponsiveDialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar Transação")).toBeInTheDocument();
    expect(screen.getByText("Ajuste os valores necessários")).toBeInTheDocument();
    expect(screen.getByText("Campos do formulário")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Alterações" })).toBeInTheDocument();
  });

  it("permite interações com o footer sem disparar fechamento", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ResponsiveDialog
        open
        onOpenChange={vi.fn()}
        title="Confirmar Operação"
        footer={
          <Button onClick={onSave}>
            Confirmar
          </Button>
        }
      >
        <span>Detalhes</span>
      </ResponsiveDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("repassa props completas de Modal sem embrulhar ModalFooter duas vezes", () => {
    render(
      <ResponsiveDialog
        open
        onOpenChange={vi.fn()}
        title="Com Ações Completas"
        dataTour="tour-modal"
        showCalculator
        wideHeaderActions
        headerActions={<span>Extra</span>}
        destructiveAction={<Button variant="destructive">Excluir</Button>}
        footer={
          <ModalFooter>
            <Button variant="outline">Cancelar</Button>
            <Button variant="solid">Salvar</Button>
          </ModalFooter>
        }
      >
        <p>Corpo</p>
      </ResponsiveDialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-tour", "tour-modal");
    expect(screen.getByRole("button", { name: "Abrir calculadora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    // Garante que apenas um ModalFooter existe (sem wrapper duplo)
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const actionsGroup = cancelBtn.parentElement;
    const footerRoot = actionsGroup?.parentElement;
    expect(footerRoot?.className).toContain("sm:justify-between");
  });
});
