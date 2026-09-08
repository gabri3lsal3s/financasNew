import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashKpiCard } from "./cash-kpi-card";

describe("CashKpiCard", () => {
  it("renderiza o formato banner por padrão com saldo, badge de Pólvora Seca e ações de ajustar e aportar", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAporte = vi.fn();

    render(
      <CashKpiCard
        cashBRL={5000}
        cashPct={25}
        hasCashAsset={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onAporte={onAporte}
      />,
    );

    expect(screen.getByText(/Saldo em Caixa & Liquidez/i)).toBeInTheDocument();
    expect(screen.getByText("Pólvora Seca")).toBeInTheDocument();
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/\(25\.0% do patrimônio\)/i)).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Editar saldo em caixa/i });
    const deleteBtn = screen.getByRole("button", { name: /Excluir ativo de caixa/i });
    const aporteBtn = screen.getByRole("button", { name: /Simular aporte com caixa/i });

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
    expect(aporteBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(aporteBtn);
    expect(onAporte).toHaveBeenCalledTimes(1);
  });

  it("renderiza botão de cadastrar caixa quando hasCashAsset é false no formato banner", () => {
    const onEdit = vi.fn();

    render(
      <CashKpiCard
        cashBRL={0}
        hasCashAsset={false}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText(/Saldo em Caixa & Liquidez/i)).toBeInTheDocument();
    expect(screen.getByText("Não cadastrado")).toBeInTheDocument();

    const cadastrarBtn = screen.getByRole("button", { name: /Cadastrar saldo em caixa/i });
    expect(cadastrarBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir ativo de caixa/i })).not.toBeInTheDocument();

    fireEvent.click(cadastrarBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renderiza o formato card clássico quando variant='card'", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CashKpiCard
        variant="card"
        cashBRL={3000}
        cashPct={15}
        hasCashAsset={true}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Saldo em caixa")).toBeInTheDocument();
    expect(screen.getByText(/3\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("15.0% do patrimônio total")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Editar saldo em caixa/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renderiza skeleton durante o carregamento", () => {
    const onEdit = vi.fn();
    const { container } = render(
      <CashKpiCard
        cashBRL={0}
        isLoading={true}
        onEdit={onEdit}
      />,
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
