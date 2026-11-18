import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HouseholdExpenseFeed } from "./household-expense-feed";
import type { FamilyConsolidationExpense } from "@/types";

const mockExpenses: FamilyConsolidationExpense[] = [
  {
    id: "exp-1",
    description: "Compras do Mercado",
    date: "2026-11-04",
    amount_cents: 32000,
    category_id: "cat-1",
    category_name: "Supermercado",
    category_icon: "shopping-cart",
    category_color: "#10b981",
    user_id: "user-1",
    payer_name: "Gabriel",
    is_own: true,
    created_at: "2026-11-04T12:00:00Z",
  },
  {
    id: "exp-2",
    description: "Internet Fibra",
    date: "2026-11-02",
    amount_cents: 14990,
    category_id: "cat-2",
    category_name: "Serviços",
    category_icon: "wifi",
    category_color: "#3b82f6",
    user_id: "user-2",
    payer_name: "Mariana",
    is_own: false,
    created_at: "2026-11-02T10:00:00Z",
  },
];

describe("HouseholdExpenseFeed", () => {
  it("renderiza lista completa e permite filtrar por pagador", async () => {
    const user = userEvent.setup();
    render(<HouseholdExpenseFeed expenses={mockExpenses} currentUserId="user-1" />);

    expect(screen.getByText("Extrato Familiar")).toBeInTheDocument();
    expect(screen.getByText("Compras do Mercado")).toBeInTheDocument();
    expect(screen.getByText("Internet Fibra")).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /Todas da Casa/i })).toBeInTheDocument();

    // Filtra para 'Pagas por Você'
    const ownTab = screen.getByRole("tab", { name: /Pagas por Você/i });
    await user.click(ownTab);

    expect(screen.getByText("Compras do Mercado")).toBeInTheDocument();
    expect(screen.queryByText("Internet Fibra")).not.toBeInTheDocument();

    // Filtra para 'Demais Membros'
    const partnerTab = screen.getByRole("tab", { name: /Demais Membros/i });
    await user.click(partnerTab);

    expect(screen.queryByText("Compras do Mercado")).not.toBeInTheDocument();
    expect(screen.getByText("Internet Fibra")).toBeInTheDocument();
  });

  it("renderiza empty state quando não há despesas no filtro selecionado", () => {
    render(<HouseholdExpenseFeed expenses={[]} />);

    expect(
      screen.getByText("Nenhuma despesa familiar registrada neste mês"),
    ).toBeInTheDocument();
  });

  it("pagina resultados a cada 50 itens e permite carregar mais", async () => {
    const user = userEvent.setup();
    const manyExpenses: FamilyConsolidationExpense[] = Array.from({ length: 65 }, (_, i) => ({
      id: `exp-${i + 1}`,
      description: `Lançamento Familiar ${String(i + 1).padStart(2, "0")}`,
      date: "2026-11-04",
      amount_cents: 1000,
      category_id: "cat-1",
      category_name: "Supermercado",
      category_icon: "shopping-cart",
      category_color: "#10b981",
      user_id: "user-1",
      payer_name: "Gabriel",
      is_own: true,
      created_at: `2026-11-04T${String(23 - Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}:00Z`,
    }));

    render(<HouseholdExpenseFeed expenses={manyExpenses} currentUserId="user-1" />);

    const loadMoreBtn = screen.getByRole("button", { name: /Carregar mais \(15 restantes\)/i });
    expect(loadMoreBtn).toBeInTheDocument();
    expect(screen.queryByText("Lançamento Familiar 65")).not.toBeInTheDocument();

    await user.click(loadMoreBtn);

    expect(screen.getByText("Lançamento Familiar 65")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carregar mais/i })).not.toBeInTheDocument();
  });
});
