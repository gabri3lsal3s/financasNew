import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashKpiCard } from "./cash-kpi-card";

describe("CashKpiCard", () => {
  it("renderiza o saldo e percentual do caixa quando hasCashAsset é true", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CashKpiCard
        cashBRL={5000}
        cashPct={25}
        hasCashAsset={true}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Saldo em caixa")).toBeInTheDocument();
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("25.0% do patrimônio total")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Editar saldo em caixa/i });
    const deleteBtn = screen.getByRole("button", { name: /Excluir ativo de caixa/i });

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renderiza botão de adicionar caixa quando hasCashAsset é false (caixa não cadastrado/zerado)", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CashKpiCard
        cashBRL={0}
        hasCashAsset={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Saldo em caixa")).toBeInTheDocument();
    expect(screen.getByText("Nenhum saldo em caixa cadastrado")).toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: /Adicionar ativo de caixa/i });
    expect(addBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir ativo de caixa/i })).not.toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
