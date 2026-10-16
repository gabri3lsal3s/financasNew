import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import type { Category } from "@/types";

const createCategoryMock = vi.fn();
const updateCategoryMock = vi.fn();
const deleteCategoryMock = vi.fn();

vi.mock("@/state", () => ({
  useCreateCategory: () => ({ mutateAsync: createCategoryMock, isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: updateCategoryMock, isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: deleteCategoryMock, isPending: false }),
}));

const sampleCategory: Category = {
  id: "c1",
  user_id: "u1",
  name: "Alimentação",
  icon: "alimentacao",
  color: "#F59E0B",
  type: "expense",
  is_reserved: false,
  is_active: true,
};

const siblingCategory: Category = {
  id: "c2",
  user_id: "u1",
  name: "Lazer",
  icon: "lazer",
  color: null,
  type: "expense",
  is_reserved: false,
  is_active: true,
};

describe("CategoryFormDialog & DeleteCategoryDialog", () => {
  it("cria categoria de despesa aplicando a sugestão inteligente por nome", async () => {
    createCategoryMock.mockResolvedValue({ id: "c9" });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <CategoryFormDialog
        category={null}
        defaultType="expense"
        open={true}
        onOpenChange={onOpenChange}
        siblings={[siblingCategory]}
      />
    );

    expect(screen.getByRole("heading", { name: "Nova categoria" })).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Nome");
    await user.type(nameInput, "Transporte");

    // Sugestão inteligente por nome
    const iconTrigger = screen.getByRole("button", { name: "Ícone da categoria" });
    expect(iconTrigger).toHaveTextContent("transporte");

    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    expect(createCategoryMock).toHaveBeenCalledTimes(1);
    const params = createCategoryMock.mock.calls[0]?.[0];
    expect(params.type).toBe("expense");
    expect(params.name).toBe("Transporte");
    expect(params.icon).toBe("transporte");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("abre formulário de edição com dados pré-preenchidos e salva alterações", async () => {
    updateCategoryMock.mockResolvedValue({ id: "c1" });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <CategoryFormDialog
        category={sampleCategory}
        defaultType="expense"
        open={true}
        onOpenChange={onOpenChange}
        siblings={[siblingCategory]}
      />
    );

    expect(screen.getByRole("heading", { name: "Editar categoria" })).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Nome");
    expect(nameInput).toHaveValue("Alimentação");

    await user.clear(nameInput);
    await user.type(nameInput, "Alimentação & Mercado");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateCategoryMock).toHaveBeenCalledTimes(1);
    const params = updateCategoryMock.mock.calls[0]?.[0];
    expect(params.id).toBe("c1");
    expect(params.input.name).toBe("Alimentação & Mercado");
  });

  it("exclui categoria sem lançamentos diretamente pelo DeleteCategoryDialog", async () => {
    deleteCategoryMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <DeleteCategoryDialog
        category={siblingCategory}
        siblings={[sampleCategory]}
        usage={{ expenses: 0, incomes: 0 }}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText(/Esta categoria não tem lançamentos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir categoria" }));

    expect(deleteCategoryMock).toHaveBeenCalledWith({ id: "c2", migrateTo: null });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("com lançamentos, exige seleção da categoria de destino para migração", async () => {
    deleteCategoryMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <DeleteCategoryDialog
        category={sampleCategory}
        siblings={[siblingCategory]}
        usage={{ expenses: 5, incomes: 0 }}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    // Contagem de 5 lançamentos exibida no alerta
    expect(screen.getByText("5")).toBeInTheDocument();

    // Botão desabilitado sem destino
    const deleteBtn = screen.getByRole("button", { name: "Excluir categoria" });
    expect(deleteBtn).toBeDisabled();

    // Seleciona categoria destino
    await user.click(screen.getByRole("combobox", { name: "Categoria de destino da migração" }));
    await user.click(await screen.findByRole("option", { name: "Lazer" }));

    expect(deleteBtn).toBeEnabled();
    await user.click(deleteBtn);

    expect(deleteCategoryMock).toHaveBeenCalledWith({ id: "c1", migrateTo: "c2" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
