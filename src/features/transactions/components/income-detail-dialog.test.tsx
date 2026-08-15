import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomeDetailDialog } from "./income-detail-dialog";
import type { Income } from "@/types";

const updateIncomeMock = vi.fn();
const deleteIncomeMock = vi.fn();
const createIncomeMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat1", name: "Salário", icon: "Briefcase", color: "#10B981" },
      { id: "cat2", name: "Freelance", icon: "Laptop", color: "#3B82F6" },
    ],
  }),
  useUpdateIncome: () => ({ mutateAsync: updateIncomeMock, isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: deleteIncomeMock, isPending: false }),
  useCreateIncome: () => ({ mutateAsync: createIncomeMock, isPending: false }),
}));

function baseIncome(overrides: Partial<Income> = {}): Income {
  return {
    id: "i1",
    user_id: "u1",
    value: 3500,
    date: "2026-08-05",
    category_id: "cat1",
    receive_type: "pix",
    description: null,
    report_weight: 1,
    source_ref: null,
    created_at: "2026-08-05T10:00:00Z",
    ...overrides,
  };
}

describe("IncomeDetailDialog", () => {
  it("repete a receita no mês atual com data ajustada (F21)", async () => {
    createIncomeMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IncomeDetailDialog open={true} onOpenChange={vi.fn()} income={baseIncome()} />);

    await user.click(screen.getByRole("button", { name: /Repetir no mês atual/ }));

    expect(createIncomeMock).toHaveBeenCalledTimes(1);
    const input = createIncomeMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      value: 3500,
      category_id: "cat1",
      receive_type: "pix",
      report_weight: 1,
    });
    // Data ajustada para hoje (não a original).
    expect(input.date).not.toBe("2026-08-05");
  });

  it("exibe o nome da categoria quando a receita não tiver descrição", () => {
    render(<IncomeDetailDialog income={baseIncome()} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Detalhes da receita" })).toBeInTheDocument();
  });

  it("permite editar a receita e altera a forma de recebimento", async () => {
    updateIncomeMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IncomeDetailDialog income={baseIncome()} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));
    expect(screen.getByRole("heading", { name: "Editar receita" })).toBeInTheDocument();

    const receiveSelect = screen.getByLabelText("Forma de recebimento");
    await user.click(receiveSelect);
    await user.click(await screen.findByRole("option", { name: "Transferência" }));

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateIncomeMock).toHaveBeenCalledTimes(1);
    expect(updateIncomeMock).toHaveBeenCalledWith({
      id: "i1",
      input: expect.objectContaining({
        receive_type: "transfer",
        category_id: "cat1",
        value: 3500,
      }),
    });
  });

  it("exclui a receita com confirmação", async () => {
    deleteIncomeMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IncomeDetailDialog income={baseIncome()} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /excluir receita/i }));
    expect(screen.getByRole("heading", { name: "Excluir receita?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteIncomeMock).toHaveBeenCalledTimes(1);
    expect(deleteIncomeMock).toHaveBeenCalledWith("i1");
  });

  it("rendas automáticas (source_ref) são somente-leitura — sem editar/excluir", () => {
    render(
      <IncomeDetailDialog
        income={baseIncome({ source_ref: "[REFUND]e1", description: "Estorno" })}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir receita/i })).not.toBeInTheDocument();
    expect(screen.getByText("Renda automática — somente leitura")).toBeInTheDocument();
  });
});
