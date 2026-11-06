import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HouseholdClusteringRanking } from "./household-clustering-ranking";
import type { FamilyConsolidationExpense } from "@/types";

const mockExpenses: FamilyConsolidationExpense[] = [
  {
    id: "exp-1",
    description: "Supermercado Semanal",
    date: "2026-11-02",
    amount_cents: 45000,
    category_id: "cat-1",
    category_name: "Supermercado",
    category_icon: "shopping-cart",
    category_color: "#10b981",
    user_id: "user-1",
    payer_name: "Gabriel",
    is_own: true,
    created_at: "2026-11-02T10:00:00Z",
  },
  {
    id: "exp-2",
    description: "Aluguel Apartamento",
    date: "2026-11-05",
    amount_cents: 200000,
    category_id: "cat-2",
    category_name: "Aluguel",
    category_icon: "home",
    category_color: "#3b82f6",
    user_id: "user-2",
    payer_name: "Mariana",
    is_own: false,
    created_at: "2026-11-05T10:00:00Z",
  },
];

describe("HouseholdClusteringRanking", () => {
  it("renderiza empty state quando não há despesas", () => {
    render(<HouseholdClusteringRanking expenses={[]} />);

    expect(screen.getByText("Ranking de Consumo por Categoria")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma despesa familiar registrada")).toBeInTheDocument();
  });

  it("renderiza os clusters ordenados por valor gasto", () => {
    render(<HouseholdClusteringRanking expenses={mockExpenses} />);

    expect(screen.getByText("Ranking de Consumo por Categoria")).toBeInTheDocument();
    expect(screen.getByText("2 categorias")).toBeInTheDocument();
    expect(screen.getByText("Moradia & Habitação")).toBeInTheDocument();
    expect(screen.getByText("Supermercado & Feira")).toBeInTheDocument();
    expect(screen.getByText("Gabriel:")).toBeInTheDocument();
    expect(screen.getByText("Mariana:")).toBeInTheDocument();
  });
});
