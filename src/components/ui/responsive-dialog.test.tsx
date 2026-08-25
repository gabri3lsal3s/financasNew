import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
});
